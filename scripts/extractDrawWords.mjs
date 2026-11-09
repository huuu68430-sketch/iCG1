// أدوات مساعدة مؤقتة: استخراج قائمة كلمات الرسم القديمة حرفياً من DrawingChallenge.tsx
// حتى لا نعيد كتابة 590 كلمة يدوياً (مصدر الأخطاء الإملائية).
import fs from 'fs';

const src = fs.readFileSync('components/DrawingChallenge.tsx', 'utf8');
const start = src.indexOf('const WORDS_TO_DRAW = [');
const end = src.indexOf('];', start);
if (start < 0 || end < 0) {
    console.error('WORDS_TO_DRAW not found');
    process.exit(1);
}
const body = src.slice(start + 'const WORDS_TO_DRAW = ['.length, end);

const blocks = { easy: [], mid: [], hard: [] };
let cur = 'easy';
for (const line of body.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith('//')) {
        const c = t.replace(/^\/\/\s*/, '');
        if (c.includes('سهل')) cur = 'easy';
        else if (c.includes('متوسط')) cur = 'mid';
        else if (c.includes('صعب')) cur = 'hard';
        continue;
    }
    for (const m of t.matchAll(/'((?:[^'\\]|\\.)*)'/g)) blocks[cur].push(m[1]);
}

const fmt = (arr) => {
    const out = [];
    let line = '    ';
    for (const w of arr) {
        const piece = `'${w}', `;
        if (line.length + piece.length > 100) { out.push(line.trimEnd()); line = '    '; }
        line += piece;
    }
    out.push(line.trimEnd());
    return out.join('\n');
};

const ts = `// مكتبة الكلمات الأصلية للعبة الرسم — مستخرجة حرفياً من النسخة السابقة.
// التصنيف هنا على مستوى الصعوبة فقط؛ التلميح يُشتق من الفئة/المستوى.

export type LegacyTier = 1 | 2 | 3;

export const LEGACY_EASY: string[] = [
${fmt(blocks.easy)}
];

export const LEGACY_MID: string[] = [
${fmt(blocks.mid)}
];

export const LEGACY_HARD: string[] = [
${fmt(blocks.hard)}
];

export const LEGACY_TOTAL = LEGACY_EASY.length + LEGACY_MID.length + LEGACY_HARD.length;
`;

fs.writeFileSync('data/drawLegacy.ts', ts);
console.log('easy', blocks.easy.length, 'mid', blocks.mid.length, 'hard', blocks.hard.length, 'total', blocks.easy.length + blocks.mid.length + blocks.hard.length);
