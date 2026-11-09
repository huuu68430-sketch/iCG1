/**
 * iCG1 — طبقة البيانات للعبة المافيا (Supabase)
 * كل شيء يُخزَّن: الغرفة، الحالة، الأدوار، الأوامر، الشات، الأحداث، النتائج.
 * يوجد احتياط محلي (localStorage) يعمل تلقائياً إذا لم تكن جداول قاعدة البيانات جاهزة،
 * حتى لا تتوقف اللعبة أبداً — لكن الوضع الكامل (بين الأجهزة) يحتاج تشغيل mafia_setup.sql.
 */
import { supabase } from '../../services/supabase';
import { GameState, Role, createRoomState } from './mafiaEngine';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const rnd = (n: number) => Math.floor(Math.random() * n);

export const newRoomCode = (len = 6) =>
  Array.from({ length: len }, () => CODE_CHARS[rnd(CODE_CHARS.length)]).join('');

export interface PlayerIdentity {
  id: string;
  handle: string;
  name: string;
  avatar?: string | null;
}

/* ===== مخزن احتياطي ===== */
const KEY = (k: string) => `mf_${k}`;
const lsGet = <T,>(k: string, fb: T): T => {
  try {
    const raw = localStorage.getItem(KEY(k));
    return raw ? (JSON.parse(raw) as T) : fb;
  } catch { return fb; }
};
const lsSet = (k: string, v: any) => {
  try { localStorage.setItem(KEY(k), JSON.stringify(v)); } catch {}
};

/* ===== الغرفة ===== */
export async function createRoom(hostHandle: string, code = newRoomCode()): Promise<{ code: string; state: GameState; synced: boolean } | null> {
  const state = createRoomState();
  lsSet(`room_${code}`, state);
  let synced = false;
  try {
    // upsert حتى تُنشأ الغرفة إن لم تكن موجودة (ويعمل تلقائياً لو أُنشئت الجداول بعد فتح الشاشة)
    const { error } = await supabase.from('mafia_rooms').upsert([{
      code, host_handle: hostHandle || null, state,
    }], { onConflict: 'code' });
    if (error) console.warn('[Mafia] createRoom (وضع محلي):', error.message);
    else synced = true;
  } catch (e) {
    console.warn('[Mafia] createRoom failed, local mode', e);
  }
  return { code, state, synced };
}

export async function loadRoom(code: string): Promise<GameState | null> {
  let state: GameState | null = null;
  try {
    const { data, error } = await supabase
      .from('mafia_rooms')
      .select('state')
      .eq('code', code)
      .maybeSingle();
    if (!error && data?.state && (data.state as any).ph) state = data.state as GameState;
  } catch {}
  if (!state) {
    const local = lsGet<GameState | null>(`room_${code}`, null);
    state = local && local.ph ? local : null;
  }
  if (state && Array.isArray(state.P)) {
    // حماية من أي تكرار قديم في المقاعد
    const seen: Record<string, true> = {};
    state.P = state.P.filter(p => (seen[p.id] ? false : ((seen[p.id] = true), true)));
  }
  return state;
}

export async function saveRoom(code: string, state: GameState): Promise<boolean> {
  lsSet(`room_${code}`, state);
  try {
    // upsert وليس update: لو الغرفة أُنشئت محلياً (قبل تهيئة الجداول) تُنشأ عند أول نجاح
    const { error } = await supabase.from('mafia_rooms').upsert([{
      code, host_handle: 'stage', state, updated_at: new Date().toISOString(),
    }], { onConflict: 'code' });
    return !error;
  } catch {
    return false;
  }
}

/* ===== الأدوار ===== */
export async function saveRoles(code: string, roles: Record<string, Role>, names: Record<string, string>) {
  const map: Record<string, Role> = { ...roles };
  lsSet(`roles_${code}`, map);
  const rows = Object.entries(roles).map(([user_id, role]) => ({
    room_code: code, user_id, username: names[user_id] || null, role,
  }));
  if (!rows.length) return;
  try {
    await supabase.from('mafia_roles').upsert(rows, { onConflict: 'room_code,user_id' });
  } catch {}
}

export async function loadRole(code: string, userId: string): Promise<Role | null> {
  try {
    const { data, error } = await supabase
      .from('mafia_roles')
      .select('role')
      .eq('room_code', code)
      .eq('user_id', userId)
      .maybeSingle();
    if (!error && data?.role) return data.role as Role;
  } catch {}
  const map = lsGet<Record<string, Role>>(`roles_${code}`, {});
  return map[userId] || null;
}

export async function loadRoles(code: string): Promise<Record<string, Role>> {
  try {
    const { data, error } = await supabase
      .from('mafia_roles')
      .select('user_id,role')
      .eq('room_code', code);
    if (!error && data?.length) {
      const map: Record<string, Role> = {};
      data.forEach((r: any) => { map[r.user_id] = r.role; });
      return map;
    }
  } catch {}
  return lsGet<Record<string, Role>>(`roles_${code}`, {});
}

export async function clearRoles(code: string) {
  lsSet(`roles_${code}`, {});
  try {
    await supabase.from('mafia_roles').delete().eq('room_code', code);
  } catch {}
}

/* ===== الأوامر ===== */
export interface RoomAction {
  id: number;
  user_id: string | null;
  kind: string;
  payload: any;
}

const nextLocalId = (key: string) => {
  // عدّاد تصاعدي مستقل حتى لا يعود للبداية بعد الحذف
  const ck = `seq_${key}`;
  const n = (lsGet<number>(ck, 0) || 0) + 1;
  lsSet(ck, n);
  return n;
};

export async function pushAction(code: string, userId: string | null, kind: string, payload: any = {}) {
  try {
    const { error } = await supabase.from('mafia_actions').insert([{
      room_code: code, user_id: userId, kind, payload,
    }]);
    if (!error) return;
  } catch {}
  const key = `act_${code}`;
  const list = lsGet<any[]>(key, []);
  list.push({ id: nextLocalId(key), user_id: userId, kind, payload });
  lsSet(key, list.slice(-400));
}

export async function latestActionId(code: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('mafia_actions')
      .select('id')
      .eq('room_code', code)
      .order('id', { ascending: false })
      .limit(1);
    if (!error) return data?.[0]?.id || 0;
  } catch {}
  const list = lsGet<RoomAction[]>(`act_${code}`, []);
  return list.length ? list[list.length - 1].id : 0;
}

export async function pullActions(code: string, afterId: number): Promise<RoomAction[]> {
  try {
    const { data, error } = await supabase
      .from('mafia_actions')
      .select('id,user_id,kind,payload')
      .eq('room_code', code)
      .gt('id', afterId)
      .order('id', { ascending: true })
      .limit(200);
    if (!error && data) return data as RoomAction[];
  } catch {}
  const list = lsGet<RoomAction[]>(`act_${code}`, []);
  return list.filter(a => a.id > afterId);
}

export async function deleteActions(ids: number[]) {
  if (!ids.length) return;
  try {
    const { error } = await supabase.from('mafia_actions').delete().in('id', ids);
    if (!error) return;
  } catch {}
  const prefix = 'act_';
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith('mf_' + prefix)) continue;
    const code = k.slice(('mf_' + prefix).length);
    const list = lsGet<RoomAction[]>(`${prefix}${code}`, []).filter(a => !ids.includes(a.id));
    lsSet(`${prefix}${code}`, list);
  }
}

/* ===== الرسائل ===== */
export type ChatChannel = 'village' | 'mafia' | 'system';

export interface ChatRow {
  id: number;
  channel: ChatChannel;
  user_id: string | null;
  username: string | null;
  body: string;
  round: number;
  created_at: string;
}

export async function sendMessage(
  code: string,
  channel: ChatChannel,
  user: { id?: string | null; name?: string | null } | null,
  body: string,
  round = 0,
  phase = '',
) {
  const text = String(body || '').trim().slice(0, 160);
  if (!text) return;
  try {
    const { error } = await supabase.from('mafia_messages').insert([{
      room_code: code, channel,
      user_id: user?.id || null, username: user?.name || null,
      body: text, round, phase,
    }]);
    if (!error) return;
  } catch {}
  const key = `msg_${code}`;
  const list = lsGet<any[]>(key, []);
  list.push({
    id: nextLocalId(key), channel,
    user_id: user?.id || null, username: user?.name || null,
    body: text, round, created_at: new Date().toISOString(),
  });
  lsSet(key, list.slice(-300));
}

export async function pullMessages(code: string, channels: ChatChannel[], afterId: number): Promise<ChatRow[]> {
  try {
    const { data, error } = await supabase
      .from('mafia_messages')
      .select('id,channel,user_id,username,body,round,created_at')
      .eq('room_code', code)
      .in('channel', channels)
      .gt('id', afterId)
      .order('id', { ascending: true })
      .limit(120);
    if (!error && data) return data as ChatRow[];
  } catch {}
  const list = lsGet<ChatRow[]>(`msg_${code}`, []);
  return list.filter(m => m.id > afterId && channels.includes(m.channel));
}

/* ===== الأحداث والنتائج ===== */
export async function logEvent(code: string, kind: string, payload: any = {}) {
  try {
    await supabase.from('mafia_events').insert([{ room_code: code, kind, payload }]);
  } catch {}
  const key = `evt_${code}`;
  const list = lsGet<any[]>(key, []);
  list.push({ id: nextLocalId(key), kind, payload, created_at: new Date().toISOString() });
  lsSet(key, list.slice(-300));
}

export async function saveMatch(code: string, winner: string, rounds: number, players: any[]) {
  try {
    await supabase.from('mafia_matches').insert([{ room_code: code, winner, rounds, players }]);
  } catch {}
  const key = `matches`;
  const list = lsGet<any[]>(key, []);
  list.push({ code, winner, rounds, players, ended_at: new Date().toISOString() });
  lsSet(key, list.slice(-50));
}
