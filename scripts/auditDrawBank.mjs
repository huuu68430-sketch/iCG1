// تدقيق بنك كلمات الرسم: أحرف لاتينية داخل النص العربي + تكرار الكلمات + تلميح فارغ.
import fs from 'fs';

const src = fs.readFileSync('data/drawBank.ts', 'utf8');
const lines = src.split('\n');

const ROW = /^\s*\['([^']*)',\s*([123]),\s*'([^']*)'(?:,\s*'([^']*)')?\],?\s*$/;
const bad = /[A-Za-z\u0590-\u05FF\u3040-\uFFDC\u4e00-\u9fff]/;

let parsed = 0, issues = 0, dups = 0;
const seen = new Map();

lines.forEach((line, i) => {
    const m = line.match(ROW);
    if (!m) {
        if (/\['.*',\s*[123],/.test(line)) { console.log('SHAPE ' + (i + 1) + ': ' + line.trim()); issues++; }
        return;
    }
    parsed++;
    const ar = m[1], hint = m[3], alt = m[4] || '';
    const hits = [];
    if (bad.test(ar)) hits.push('word: ' + ar);
    if (bad.test(hint)) hits.push('hint: ' + hint);
    if (bad.test(alt)) hits.push('alt: ' + alt);
    if (hits.length) { console.log('LATIN ' + (i + 1) + '  ' + ar + '  ->  ' + hits.join(' | ')); issues++; }
    if (seen.has(ar)) { console.log('DUP   ' + (i + 1) + '  ' + ar + '  (first ' + seen.get(ar) + ')'); dups++; }
    else seen.set(ar, i + 1);
});

console.log('--- parsed:', parsed, 'issues:', issues, 'dups:', dups);
