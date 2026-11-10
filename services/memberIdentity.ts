/**
 * iCG1 — هوية العضو للألعاب الخارجية (iframe مثل المافيا).
 * تقرأ الجلسة المتحققة من النظام، وتوفر مفتاح اللعبة ومفتاح الانضمام المرتبط بالغرفة،
 * وتحلّ إطار الموقع المجهّز للعضو حتى يظهر صورته على الشاشة الكبيرة.
 */
import { supabase } from './supabase';
import { isFrameId } from '../data/frames';

const SESSION_KEYS = ['site_access_granted', 'admin_access_granted'];

export interface MemberIdentity {
  handle: string;
  name: string;
  avatar: string;
  frameId: string;
  frameUrl: string;
  /** مفتاح عضلة مشتق من كلمة السر، يبقى في هذا المتصفح ولا يُرسل للقناة */
  gameKey: string;
  /** حالة مفتاح الإثبات: ok = مفتاح هذا الحساب تحديداً · unsynced = لم يُمحَّب بعد · missing = لا حساب بهذا الاسم */
  keyState: 'ok' | 'unsynced' | 'missing';
  isAdmin: boolean;
}

const parse = (raw: string | null): any => {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
};

/** جلسة صالحة حسب شكلها وتواريخها — نفس فحص App.tsx */
const readSession = (key: string): any | null => {
  const s = parse(localStorage.getItem(key));
  if (!s?.valid || !s.token || !s.pinHash || !s.issuedAt) return null;
  if (Date.now() > (s.expiresAt || 0)) return null;
  return s;
};

export const isAdminSession = (): boolean =>
  SESSION_KEYS.some(k => readSession(k)?.role === 'admin');

const userRow = () => parse(localStorage.getItem('iabs_user'));

/** شكل مفتاح العضو كما يُخزَّن في users.password_hash (sha256 قديم أو scrypt/bcrypt جديد) */
const KEY_SHAPE = /^[A-Za-z0-9$/+=._-]{20,200}$/;
let syncedHandle = '';

/**
 * المفتاح المحلي صالح فقط إن كان مُوسَماً باسم هذا الحساب بالذات.
 * بدون الوسام كان المتصفح الذي انتقل بين حسابين يُثبت ملكية الحساب الجديد
 * بمفتاح الحساب القديم، فترفض المافيا الانضمام برسالة «المفتاح لا يطابق» إلى الأبد.
 */
const pairedKey = (handle: string): string => {
  if (localStorage.getItem('iabs_game_key_for') !== handle) return '';
  const k = String(localStorage.getItem('iabs_game_key') || '');
  return KEY_SHAPE.test(k) ? k : '';
};

export const readMember = (): Omit<MemberIdentity, 'frameId' | 'frameUrl'> | null => {
  const session = readSession('site_access_granted') || readSession('admin_access_granted');
  if (!session) return null;
  const u = userRow();
  const handle = String(u?.kick_username || u?.id || '').toLowerCase().trim();
  if (!handle || handle === 'guest') return null;
  const gameKey = pairedKey(handle);
  return {
    handle,
    name: String(u?.display_name || u?.kick_username || handle).slice(0, 24),
    avatar: String(u?.avatar || ''),
    gameKey,
    keyState: gameKey ? 'ok' : (lastState[handle] || 'unsynced'),
    isAdmin: session.role === 'admin',
  };
};

const frameMemCache = new Map<string, { frameId: string; frameUrl: string }>();

/** آخر حالة معروفة لكل حساب — تُعرض على الهاتف بدل رسالة «المفتاح لا يطابق» الغامضة */
const lastState: Record<string, 'ok' | 'unsynced' | 'missing'> = {};

/**
 * يزامن مفتاح اللعبة مع المخزّن في قاعدة البيانات.
 * المتصفحات التي سجّلت الدخول قبل وجود هذا المفتاح كانت تدخل بلا إثبات،
 * والمتصفح الذي انتقل بين حسابين يجب ألا يحمل مفتاح الحساب السابق.
 * force = إعادة القراءة من قاعدة البيانات حتى لو زُومِن هذا الحساب في الجلسة الحالية.
 */
export const syncGameKey = async (handle: string, force = false): Promise<string> => {
  if (!force && syncedHandle === handle) {
    const k = pairedKey(handle);
    lastState[handle] = k ? 'ok' : (lastState[handle] || 'unsynced');
    return k;
  }
  try {
    const { data, error } = await supabase
      .from('users')
      .select('password_hash')
      .eq('kick_username', handle)
      .limit(1);
    if (error) { syncedHandle = ''; lastState[handle] = 'unsynced'; return pairedKey(handle); }
    const stored = String((data as any)?.[0]?.password_hash || '');
    if (!stored) {
      // لا حساب بهذا الاسم: المفتاح المحلي ليس مفتاحه — نُبقي وسام الحساب القديم كما هو
      syncedHandle = handle;
      lastState[handle] = 'missing';
      return '';
    }
    if (KEY_SHAPE.test(stored)) {
      try {
        localStorage.setItem('iabs_game_key', stored);
        localStorage.setItem('iabs_game_key_for', handle);
      } catch { /* التخزين ممتلئ */ }
      syncedHandle = handle;
      lastState[handle] = 'ok';
      return stored;
    }
    syncedHandle = '';
    lastState[handle] = 'unsynced';
  } catch { /* القراءة غير مسموحة — يبقى المفتاح المحلي المُوسَم لهذا الحساب فقط */ }
  return pairedKey(handle);
};

/** الإطار المجهّز: من الكاش فوراً، ثم من قاعدة البيانات */
export const resolveMemberFrame = async (handle: string) => {
  const cached = () => {
    const id = localStorage.getItem(`frameid_${handle}`);
    const url = localStorage.getItem(`frame_${handle}`);
    return { frameId: id && id !== 'none' ? id : '', frameUrl: url && url !== 'none' ? url : '' };
  };
  const known = frameMemCache.get(handle);
  if (known) return known;

  const seed = cached();
  if (seed.frameId || seed.frameUrl) {
    frameMemCache.set(handle, seed);
    return seed;
  }

  let out = { frameId: '', frameUrl: '' };
  try {
    const { data } = await supabase
      .from('profiles')
      .select('active_frame_id, active_frame_url')
      .eq('username', handle)
      .limit(1);
    const row: any = data?.[0];
    const id = row?.active_frame_id && isFrameId(row.active_frame_id) ? row.active_frame_id : '';
    out = { frameId: id, frameUrl: row?.active_frame_url || '' };
    if (!out.frameId && !out.frameUrl) {
      const owned = await supabase
        .from('user_frames')
        .select('frame_id')
        .eq('is_equipped', true)
        .eq('username', handle)
        .limit(1);
      const ownId = owned.data?.[0]?.frame_id;
      if (ownId && isFrameId(ownId)) out.frameId = ownId;
    }
  } catch { /* الجدول لم يُحدَّث بعد — بدون إطار */ }

  frameMemCache.set(handle, out);
  try {
    localStorage.setItem(`frameid_${handle}`, out.frameId || 'none');
    localStorage.setItem(`frame_${handle}`, out.frameUrl || 'none');
  } catch { /* التخزين ممتلئ */ }
  return out;
};
