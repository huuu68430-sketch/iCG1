import { build } from 'esbuild';
import { readFileSync, rmSync, readdirSync, statSync } from 'node:fs';

const FILES = {
  MAHMAH_GAME: ['components/Mafia', 'public/mafia.html'],
  EMOJI_CODE: ['components/EmojiCode.tsx', 'public/codenames.html'],
  CUP_SHUFFLE: ['components/CupShuffle.tsx'],
  MUSICAL_CHAIRS: ['components/MusicalChairsGame.tsx', 'public/musical-chairs.html'],
  SPIN_WHEEL: ['components/Roulette.tsx'],
  FLAG_QUIZ: ['components/FlagQuiz.tsx'],
  HIGHER_LOWER: ['components/HigherLowerGame.tsx'],
  BLUR_GUESS: ['components/BlurGuess.tsx'],
  DRAWING_CHALLENGE: ['components/DrawingChallenge.tsx'],
  GLASS_BRIDGE_V2: ['components/GlassBridgeV2.tsx'],
  LETTER_GAME: ['components/LetterHexagonGame.tsx'],
  TIME_BOMB: ['components/TimeBomb.tsx'],
  MAP_GUESSER: ['components/MapGuesser.tsx'],
  TYPING_RACE: ['components/TypingRace.tsx'],
  SAFE_CODE: ['components/SafeCode.tsx'],
  TRUTH_OR_LIE: ['components/TruthOrLie.tsx'],
};

const read = (p, re = /\.(tsx?|html|js)$/) => {
  if (statSync(p).isFile()) return re.test(p) ? readFileSync(p, 'utf8') + '\n' : '';
  const st = readdirSync(p, { withFileTypes: true });
  let out = '';
  for (const e of st) {
    const f = p + '/' + e.name;
    if (e.isDirectory()) { if (e.name !== 'tutorials') out += read(f, re); }
    else if (re.test(e.name) && statSync(f).size < 3_000_000) out += readFileSync(f, 'utf8') + '\n';
  }
  return out;
};

const CORPUS = {};
for (const [id, paths] of Object.entries(FILES))
  CORPUS[id] = paths.map(p => (statSync(p).isDirectory() ? read(p) : readFileSync(p, 'utf8'))).join('\n');

const GLOBAL_RAW = [read('components'), read('public'), read('data'), read('services'), read('constants.ts')].join('\n');

await build({ entryPoints: ['data/game_tutorials.ts'], outfile: 'scripts/.lbl.mjs', bundle: true, format: 'esm', platform: 'node', logLevel: 'error' });
const mod = await import(new URL('../scripts/.lbl.mjs', import.meta.url).href);
rmSync('scripts/.lbl.mjs', { force: true });

const norm = (s) => s.replace(/[’‘‏‎]/g, '').replace(/\s+/g, ' ').trim();
const GLOBAL = norm(GLOBAL_RAW);
const quoted = (s) => (s || '').match(/«([^»]+)»/g)?.map(q => q.slice(1, -1)) || [];

let warn = 0;
for (const [id, t] of Object.entries(mod.GAME_TUTORIALS)) {
  const corpus = norm(CORPUS[id] || '');
  const need = new Map();
  const add = (s, where) => { if (s && s.length > 1 && s.length < 40) need.set(norm(s), where); };
  t.steps.forEach((s, i) => {
    quoted(s.narration).forEach(q => add(q, `step${i} narration`));
    const walk = (p) => {
      if (!p) return;
      if (p.t === 'row') return p.parts.forEach(walk);
      if (p.t === 'cta') add(p.text, `step${i} cta`);
      if (p.t === 'bigText' || p.t === 'note' || p.t === 'headline') quoted(p.text).forEach(q => add(q, `step${i} ${p.t}`));
      if (p.t === 'tiles') p.items.forEach(it => quoted(it.label).forEach(q => add(q, `step${i} tile`)));
    };
    s.parts.forEach(walk);
    if (s.phone) { quoted(s.phone.title).forEach(q => add(q, `step${i} phone`)); add(s.phone.primary, `step${i} phone btn`); }
  });
  for (const [s, where] of need) {
    if (corpus.includes(s)) continue;
    const inGlobal = GLOBAL.includes(s);
    if (inGlobal && /narration|tile|note|headline|bigText/.test(where)) continue;
    warn++;
    console.log(`${inGlobal ? 'INFO' : 'HIGH'} ${id.padEnd(18)} ${where.padEnd(18)} «${s}»`);
  }
}
console.log(warn ? `\n${warn} labels not found verbatim in the real game source` : '\nall labels verbatim');
