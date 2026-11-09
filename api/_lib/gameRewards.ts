export type AwardKind = 'round' | 'match';

/**
 * جدول المكافآت — ملف صافي بلا استيرادات حتى يقرأه السيرفر (مركز التحكم)
 * والمتصفح (services/points.ts) من نفس المصدر، فما ينكسر اتفاق أبداً.
 * tiers تتبع الجهد: حظ < رد فعل < معرفة < مهارة < بقاء.
 */
export const GAME_POINTS: Record<string, { match: number; round: number }> = {
    // حظ بحت
    SPIN_WHEEL: { match: 60, round: 20 },
    // رد فعل وسرعة
    CUP_SHUFFLE: { match: 100, round: 30 },
    TYPING_RACE: { match: 100, round: 30 },
    FLAG_QUIZ: { match: 110, round: 35 },
    TIME_BOMB: { match: 120, round: 35 },
    // معرفة وتخمين
    BLUR_GUESS: { match: 140, round: 40 },
    MAP_GUESSER: { match: 140, round: 40 },
    HIGHER_LOWER: { match: 140, round: 40 },
    EMOJI_CODE: { match: 150, round: 45 },
    SAFE_CODE: { match: 160, round: 45 },
    TRUTH_OR_LIE: { match: 150, round: 40 },
    LETTER_GAME: { match: 160, round: 45 },
    // مهارة وإبداع
    DRAWING_CHALLENGE: { match: 180, round: 60 },
    // بقاء وتحمل
    MUSICAL_CHAIRS: { match: 200, round: 50 },
    GLASS_BRIDGE_V2: { match: 220, round: 50 },
    MAHMAH_GAME: { match: 250, round: 40 },
};

export const DEFAULT_POINTS = { match: 120, round: 35 };

export const pointsFor = (gameId: string, kind: AwardKind) => (GAME_POINTS[gameId] || DEFAULT_POINTS)[kind];
