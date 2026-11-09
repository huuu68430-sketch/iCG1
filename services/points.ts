import { leaderboardService, gameLeaderboardService } from './supabase';

export type AwardKind = 'round' | 'match';

// جدول المكافآت في ملف صافي (gameRewards) يقرؤه المتصفح والسيرفر معاً.
export { GAME_POINTS, pointsFor } from './gameRewards';
import { pointsFor } from './gameRewards';

const IGNORED_USERS = new Set(['', 'host', 'unknown', 'bot', 'system', 'time up!', 'timeup', 'النظام']);

export const isAwardableUser = (username?: string | null) => {
    if (!username) return false;
    const key = String(username).trim().toLowerCase();
    return key.length > 0 && !IGNORED_USERS.has(key);
};

/**
 * Credits a winner. Fire-and-forget by design, but never silent: a rejected
 * credit is logged so a broken game shows up instead of quietly losing points.
 * Returns the amount awarded so callers can display it.
 */
export const awardPoints = (
    gameId: string,
    username: string | null | undefined,
    avatarUrl: string,
    kind: AwardKind = 'match',
    multiplier: number = 1
): number => {
    if (!isAwardableUser(username)) return 0;
    const base = pointsFor(gameId, kind);
    const points = Math.max(1, Math.round(base * (multiplier > 0 ? multiplier : 1)));
    const user = String(username).trim();
    leaderboardService
        .addScore(user, avatarUrl || '', points, kind === 'match')
        .catch(err => console.error(`[points] ${gameId}/${kind} failed for ${username}`, err));
    // اللوحة الخاصة باللعبة: سطر في السجل، والتركيبي في Supabase يحدّث المجمّع
    gameLeaderboardService
        .logEvent(gameId, user, points, kind)
        .then(res => { if (res?.error) console.error(`[points] ${gameId} board log failed`, res.error); })
        .catch(err => console.error(`[points] ${gameId} board log failed`, err));
    return points;
};

/** Credits several winners of the same round/match in one call. */
export const awardPointsToMany = (
    gameId: string,
    winners: Array<{ username: string; avatar?: string }>,
    kind: AwardKind = 'match',
    multiplier: number = 1
): number => {
    let amount = 0;
    winners.forEach(w => {
        const awarded = awardPoints(gameId, w.username, w.avatar || '', kind, multiplier);
        if (awarded) amount = awarded;
    });
    return amount;
};
