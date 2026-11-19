/**
 * iCG1 — حانة الكذابين: بروتوكول القنوات والتوقيع.
 * لا يمرّ أي سرّ (seat_token) عبر قناة بث؛ التوكن يبقى في ذاكرة القشرة فقط
 * ويُستخدم مفتاحاً لتوقيع أفعال ذلك المقعد (HMAC-SHA-256).
 */

export const LD_SEATS = [
  { name: 'الداهية', en: 'THE MASTERMIND', sym: '♠', color: '#e8c07a' },
  { name: 'الجوهرة', en: 'THE JEWEL', sym: '♥', color: '#e0584a' },
  { name: 'الدكتور', en: 'THE DOCTOR', sym: '♦', color: '#6ec6a0' },
  { name: 'الجنرال', en: 'THE GENERAL', sym: '♣', color: '#b8c46a' },
] as const;

export const LD_TURN_MS = 30000;
export const LD_MAX_PLAY = 3;

export type SeatIndex = 0 | 1 | 2 | 3;

export interface SeatSlot {
  taken: boolean;
  name?: string;
}

export interface LdAct {
  t: 'act';
  ix?: number[];
  call?: boolean;
}

export interface ActEnvelope {
  type: 'act';
  seat: number;
  tid: number;
  seq: number;
  act: LdAct;
  sig: string;
  ts: number;
}

export const pubChannel = (code: string) => `ld:${String(code).toUpperCase()}`;
export const seatChannel = (code: string, topic: string) =>
  `ld:${String(code).toUpperCase()}:p:${topic}`;

const HEX = '0123456789abcdef';

export const randomHex = (bytes: number): string => {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
};

export const newMatchId = (): string => {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const h = randomHex(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

export const sha256Hex = async (text: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), b => HEX[b >> 4] + HEX[b & 15]).join('');
};

export const hmacHex = async (keyText: string, msg: string): Promise<string> => {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(keyText),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(sig), b => HEX[b >> 4] + HEX[b & 15]).join('');
};

/** نفس الشكل على الطرفين — لا نعتمد على ترتيب مفاتيح JSON القادم من القناة */
export const canonicalAct = (act: LdAct): string =>
  JSON.stringify([act?.t || '', Array.isArray(act?.ix) ? act.ix : null, act?.call ? 1 : 0]);

export const actPayload = (seat: number, tid: number, seq: number, act: LdAct): string =>
  `${seat}|${tid}|${seq}|${canonicalAct(act)}`;

export const signAct = (token: string, seat: number, tid: number, seq: number, act: LdAct) =>
  hmacHex(token, actPayload(seat, tid, seq, act));

export const isValidAct = (act: any): act is LdAct => {
  if (!act || act.t !== 'act') return false;
  if (act.call === true) return !Array.isArray(act.ix);
  if (!Array.isArray(act.ix) || act.ix.length < 1 || act.ix.length > LD_MAX_PLAY) return false;
  const seen = new Set<number>();
  for (const i of act.ix) {
    if (!Number.isInteger(i) || i < 0 || i > 4 || seen.has(i)) return false;
    seen.add(i);
  }
  return true;
};

export const sameHex = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

export const buildJoinLink = (code: string): string =>
  `${window.location.origin}/ld=${String(code || '').trim().toUpperCase()}`;
