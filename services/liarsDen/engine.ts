/**
 * iCG1 — حانة الكذابين: قواعد مشتركة بين القشرة والمسار.
 * محرّك اللعب نفسه (توزيع/دور/كشف/رصاصة) يعمل داخل مسرح iframe
 * لأنه يحمل مشهد three.js كاملاً؛ هنا القواعد التي تحتاجها القشرة فقط.
 */
export {
  LD_SEATS, LD_TURN_MS, LD_MAX_PLAY, isValidAct,
  newMatchId, randomHex, sha256Hex, signAct, sameHex, buildJoinLink,
} from './protocol';
export type { LdAct, SeatSlot } from './protocol';

export const LD_POINTS = { match: 200, round: 35 } as const;

export const clampRoundWins = (wins: unknown): number[] => {
  const src = Array.isArray(wins) ? wins : [];
  return [0, 1, 2, 3].map(i => {
    const n = Number(src[i]);
    return Number.isFinite(n) ? Math.max(0, Math.min(30, Math.floor(n))) : 0;
  });
};

export const clampRounds = (rounds: unknown): number => {
  const n = Number(rounds);
  return Number.isFinite(n) ? Math.max(0, Math.min(60, Math.floor(n))) : 0;
};

/** لقطة حالة الغرفة كما تُبثّ — بلا أيدي ولا أسرار */
export interface LdSeatView {
  taken: boolean;
  name: string;
}
