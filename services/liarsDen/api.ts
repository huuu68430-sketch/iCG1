/**
 * iCG1 — حانة الكذابين: نداءات RPC فقط.
 * كل الكتابة تمرّ بدوال SECURITY DEFINER تتحقق من الهوية في السيرفر؛
 * لا توجد سياسات RLS مباشرة على الجداول.
 */
import { supabase } from '../supabase';
import type { SeatSlot } from './protocol';

const call = async <T>(name: string, args: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message || 'rpc_failed');
  return data as T;
};

export interface CreatedRoom {
  code: string;
  host_token: string;
  expires_at: string;
}

export interface RoomInfo {
  code: string;
  status: 'lobby' | 'playing' | 'closed';
  match_id: string | null;
  seats: { taken: boolean; n?: string | null }[];
}

export interface ClaimResult {
  seat: number | null;
  name?: string;
  token?: string;
  topic?: string;
  status: 'lobby' | 'playing' | 'closed';
  match_id: string | null;
}

export interface HostSeat {
  seat: number;
  taken: boolean;
  u?: string;
  n?: string;
  token?: string;
  topic?: string;
}

export interface HostSecrets {
  code: string;
  status: 'lobby' | 'playing' | 'closed';
  match_id: string | null;
  seats: HostSeat[];
}

export interface StartResult {
  ok: boolean;
  match_id: string;
  humans: number;
  start_uids: (string | null)[];
  duplicate?: boolean;
}

export interface FinishResult {
  ok: boolean;
  duplicate: boolean;
  human_count?: number;
  awards?: { u: string | null; rounds: number; points: number }[];
}

export const ldApi = {
  createRoom: (handle: string, nonce: string, token: string) =>
    call<CreatedRoom>('ld_create_room', { p_handle: handle, p_nonce: nonce, p_token: token }),

  getRoom: (code: string) => call<RoomInfo>('ld_get_room', { p_code: code }),

  claimSeat: (code: string, handle: string, nonce: string, token: string, seat: number) =>
    call<ClaimResult>('ld_claim_seat', {
      p_code: code, p_handle: handle, p_nonce: nonce, p_token: token, p_seat: seat,
    }),

  leaveSeat: (code: string, handle: string, nonce: string, token: string) =>
    call<{ ok: boolean; seat?: number }>('ld_leave_seat', {
      p_code: code, p_handle: handle, p_nonce: nonce, p_token: token,
    }),

  hostSecrets: (code: string, hostToken: string) =>
    call<HostSecrets>('ld_host_secrets', { p_code: code, p_host_token: hostToken }),

  hostDropSeat: (code: string, hostToken: string, seat: number) =>
    call<{ ok: boolean }>('ld_host_drop_seat', { p_code: code, p_host_token: hostToken, p_seat: seat }),

  startMatch: (code: string, hostToken: string, matchId: string) =>
    call<StartResult>('ld_start_match', { p_code: code, p_host_token: hostToken, p_match_id: matchId }),

  finishMatch: (
    code: string,
    hostToken: string,
    matchId: string,
    winnerSeat: number,
    roundWins: number[],
    rounds: number
  ) =>
    call<FinishResult>('ld_finish_match', {
      p_code: code,
      p_host_token: hostToken,
      p_match_id: matchId,
      p_winner_seat: winnerSeat,
      p_round_wins: roundWins,
      p_rounds: rounds,
    }),

  closeRoom: (code: string, hostToken: string) =>
    call<{ ok: boolean }>('ld_close_room', { p_code: code, p_host_token: hostToken }),
};

export const toSeatSlots = (seats: HostSeat[] | RoomInfo['seats']): SeatSlot[] => {
  const out: SeatSlot[] = [
    { taken: false }, { taken: false }, { taken: false }, { taken: false },
  ];
  seats.forEach((s: any, i: number) => {
    const seat = typeof s?.seat === 'number' ? s.seat : i;
    if (seat < 0 || seat > 3) return;
    out[seat] = { taken: !!s?.taken, name: String(s?.n || '') };
  });
  return out;
};

/** رسالة خطأ عربية قصيرة لشاشة اللعبة */
export const ldErrorText = (message: string): string => {
  if (message.includes('seat_taken')) return 'المقعد محجوز — اختر غيره';
  if (message.includes('match_started')) return 'المباراة بدأت — انتظر انتهاءها';
  if (message.includes('room_closed') || message.includes('room_expired')) return 'انتهت الغرفة — اطلب رابطاً جديداً';
  if (message.includes('room_not_found')) return 'لا توجد غرفة بهذا الرمز';
  if (message.includes('bad_identity')) return 'تعذّر التحقق من حسابك — سجّل الدخول من جديد';
  if (message.includes('bad_host')) return 'انتهت صلاحية غرفة المستضيف — أعد فتح اللعبة';
  if (message.includes('stale_match')) return 'انتهت هذه المباراة مسبقاً';
  return 'حدث خطأ — حاول مرة أخرى';
};
