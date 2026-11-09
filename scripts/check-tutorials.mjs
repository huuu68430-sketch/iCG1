import { build } from 'esbuild';
import { writeFileSync, rmSync, readFileSync } from 'node:fs';

const entry = 'data/game_tutorials.ts';
const out = 'scripts/.tut-bundle.mjs';

await build({
  entryPoints: [entry],
  outfile: out,
  bundle: true,
  format: 'esm',
  platform: 'node',
  logLevel: 'warning',
});

const mod = await import(new URL('../' + out, import.meta.url).href);
rmSync(out, { force: true });
const T = mod.GAME_TUTORIALS;
const EXPECT = [
  'MAHMAH_GAME', 'EMOJI_CODE', 'CUP_SHUFFLE', 'MUSICAL_CHAIRS', 'SPIN_WHEEL', 'FLAG_QUIZ',
  'HIGHER_LOWER', 'BLUR_GUESS', 'DRAWING_CHALLENGE', 'GLASS_BRIDGE_V2', 'LETTER_GAME',
  'TIME_BOMB', 'MAP_GUESSER', 'TYPING_RACE', 'SAFE_CODE', 'TRUTH_OR_LIE',
];

const src = readFileSync('services/points.ts', 'utf8');
const GAME_POINTS = {};
for (const m of src.matchAll(/^\s*([A-Z0-9_]+):\s*\{\s*match:\s*(\d+),\s*round:\s*(\d+)\s*\}/gm))
  GAME_POINTS[m[1]] = { match: +m[2], round: +m[3] };
console.log(`GAME_POINTS parsed: ${Object.keys(GAME_POINTS).length}`);

const AR = /[\u0600-\u06FF]/;
const LATIN_WORDS = /\b(the|and|you|click|start|press|winner|round|game)\b/i;

const idsOfStep = (step) => {
  const ids = new Set();
  const walk = (p) => {
    if (!p) return;
    if (p.t === 'row') return (p.parts || []).forEach(walk);
    if (p.id) ids.add(p.id);
    if (p.t === 'tiles') (p.items || []).forEach(it => it && it.id && ids.add(it.id));
  };
  (step.parts || []).forEach(walk);
  return ids;
};

let fail = 0;
const bad = (viewId, msg) => { fail++; console.log(`FAIL ${viewId}: ${msg}`); };

for (const id of EXPECT) {
  const t = T[id];
  if (!t) { bad(id, 'missing from registry'); continue; }
  if (t.viewId.toUpperCase() !== id) bad(id, `viewId is "${t.viewId}"`);
  if (!t.title || !AR.test(t.title)) bad(id, 'title not arabic');
  if (!t.tagline || !AR.test(t.tagline)) bad(id, 'tagline not arabic');
  if (!Array.isArray(t.rules) || t.rules.length < 3) bad(id, 'rules < 3');
  (t.rules || []).forEach((r, i) => { if (!AR.test(r)) bad(id, `rule ${i} not arabic: ${r}`); });
  if (!t.scoring || !AR.test(t.scoring)) bad(id, 'scoring not arabic');
  const gp = GAME_POINTS[id];
  if (gp) {
    const nums = (t.scoring.match(/\d+/g) || []).map(Number);
    const known = new Set([gp.match, gp.round]);
    const odd = nums.filter(n => !known.has(n) && n > 10);
    if (odd.length) bad(id, `scoring numbers not in GAME_POINTS(${gp.match}/${gp.round}): ${odd.join(',')}`);
  }
  if (!Array.isArray(t.steps) || t.steps.length < 5) bad(id, `steps=${(t.steps || []).length}`);
  t.steps.forEach((s, i) => {
    const tag = `step ${i}`;
    if (!s.narration || !AR.test(s.narration)) bad(id, `${tag} narration not arabic`);
    if (LATIN_WORDS.test((s.narration || '').replace(/«[^»]*»/g, ''))) bad(id, `${tag} narration has english words: ${s.narration}`);
    if (!s.chip) bad(id, `${tag} no chip`);
    if (!Array.isArray(s.parts) || !s.parts.length) bad(id, `${tag} no parts`);
    if (s.click) {
      const ids = idsOfStep(s);
      if (!ids.has(s.click)) bad(id, `${tag} click "${s.click}" not found in parts (${[...ids].join(',') || 'none'})`);
    }
    if (!s.click && !s.at && !s.noCursor) bad(id, `${tag} has no click and no at/noCursor`);
    (s.chat || []).forEach((c, n) => {
      if (!c.player || !c.player.name) bad(id, `${tag} chat ${n} missing player`);
      if (!c.player.avatar) bad(id, `${tag} chat ${n} missing avatar`);
      if (!c.player.frame) bad(id, `${tag} chat ${n} missing frame`);
      if (!c.text) bad(id, `${tag} chat ${n} empty text`);
    });
    (s.parts || []).forEach(p => {
      if (p.t === 'phone') bad(id, `${tag} used unsupported part "phone"`);
    });
  });
  const hasPhone = t.steps.some(s => s.phone);
  if ((t.join === 'phone' || t.join === 'both') && !hasPhone) bad(id, 'join says phone but no step has phone scene');
  if (t.join === 'chat' && hasPhone) bad(id, 'join=chat but a phone scene exists');
  console.log(`ok   ${id.padEnd(18)} steps=${String(t.steps.length).padStart(2)} rules=${t.rules.length} join=${t.join}${hasPhone ? ' +phone' : ''} ms=${t.steps.reduce((a, s) => a + (s.ms || 0), 0)}`);
}
console.log(fail ? `\n${fail} problems` : '\nall clean');
