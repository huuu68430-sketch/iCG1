/**
 * iCG1 — محرّك لعبة المافيا v4
 * منطق اللعبة كامل (أدوار، ليل/نهار، تصويت، فوز) — منقول من تصميم المافيا v4.
 * المحرّك يعمل على شاشة العرض (Stage) ويُخزَّن في قاعدة البيانات.
 */

export type Role = 'mafia' | 'doctor' | 'elder' | 'detective' | 'joker' | 'citizen';
export type Phase = 'join' | 'deal' | 'reveal' | 'night' | 'day' | 'end';
export type Step =
  | ''
  | 'nightfall' | 'mafia' | 'm_sleep' | 'doctor' | 'd_sleep'
  | 'elder' | 'e_sleep' | 'detective' | 'det_sleep' | 'op1' | 'op2' | 'op3'
  | 'talk' | 'vote' | 'res';

export type DetResult = 'mafia' | 'clean' | 'sus';

export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 20;
/** الجوكر يدخل من 6 لاعبين، والمحقق من 7 */
export const JOKER_MIN = 6;
export const DETECTIVE_MIN = 7;

export const ROLE_INFO: Record<Role, { n: string; d: string; team: string }> = {
  mafia: {
    n: 'مافيا',
    d: 'أنت من العصابة. بالليل تتفق مع زميلك على من تقتلون، وبالنهار تتظاهر أنك مواطن بريء.',
    team: 'المافيا',
  },
  doctor: {
    n: 'الدكتور',
    d: 'كل ليلة تحمي لاعباً واحداً. إذا اختاره القاتل تفشل العملية وينجو.',
    team: 'المواطنون',
  },
  elder: {
    n: 'الشايب',
    d: 'كل ليلة تُسكِت لاعباً عن الكلام في نقاش اليوم التالي، أو تحقق مرة واحدة من هوية لاعب.',
    team: 'المواطنون',
  },
  detective: {
    n: 'المحقق',
    d: 'بعد الشايب، تحقق في لاعب واحد (ليس نفسك، ولا تعيد نفس الاسم). النتيجة لك وحدك: مافيا أو بريء أو مشبوه. لا تكشف نفسك بدري وإلا قتلتك المافيا.',
    team: 'المواطنون',
  },
  joker: {
    n: 'الجوكر',
    d: 'ما لك فعل في الليل، وتنام مثل أي مواطن. مهمتك في النهار: اجعل القرية تقتنع أنك المافيا واطردك بالتصويت. لا تقل إنك الجوكر أبداً.',
    team: 'فردي',
  },
  citizen: {
    n: 'مواطن',
    d: 'ابحث عن المافيا بالنقاش والتصويت قبل أن يتساووا معكم بالعدد.',
    team: 'المواطنون',
  },
};

export const NIGHT_STEPS: Step[] = [
  'nightfall', 'mafia', 'm_sleep', 'doctor', 'd_sleep',
  'elder', 'e_sleep', 'detective', 'det_sleep', 'op1', 'op2', 'op3',
];

const DUR: Partial<Record<Step, number>> = {
  nightfall: 4, m_sleep: 3, d_sleep: 2.5, e_sleep: 2.5, det_sleep: 2.5,
  op1: 6, op2: 5, op3: 6, res: 6,
};

export const PHASE_LABEL: Record<Phase, string> = {
  join: 'اللوبي', deal: 'توزيع الأدوار', reveal: 'كشف الأدوار', night: 'الليل', day: 'النهار', end: 'النهاية',
};

export const STEP_LABEL: Partial<Record<Step, string>> = {
  nightfall: 'حلول الليل', mafia: 'المافيا تقرر', m_sleep: 'المافيا تنام', doctor: 'الدكتور',
  d_sleep: 'الدكتور ينام', elder: 'الشايب', e_sleep: 'الشايب ينام', detective: 'المحقق',
  det_sleep: 'المحقق ينام', op1: 'العملية', op2: 'التشويق',
  op3: 'النتيجة', talk: 'النقاش', vote: 'التصويت', res: 'نتيجة التصويت',
};

export const DET_RESULT_LABEL: Record<DetResult, string> = {
  mafia: 'من المافيا',
  clean: 'بريء',
  sus: 'مشبوه',
};

export type WinSide = 'town' | 'mafia' | 'joker' | null;

export const WIN_TEXT: Record<Exclude<WinSide, null>, string> = {
  town: 'فاز المواطنون',
  mafia: 'فازت المافيا',
  joker: 'فاز الجوكر وحده',
};

export const WIN_TITLE: Record<Exclude<WinSide, null>, string> = {
  town: 'فاز المواطنون!',
  mafia: 'فازت المافيا!',
  joker: 'فاز الجوكر! القرية طردته بنفسها',
};

/** من يستحق نقاط الفوز — الجوكر لا يحسب مع المواطنين */
export function winningSeats(s: GameState, roles: Record<string, Role>): Seat[] {
  if (s.win === 'joker') return s.P.filter(p => roles[p.id] === 'joker');
  if (s.win === 'mafia') return s.P.filter(p => roles[p.id] === 'mafia');
  if (s.win === 'town') return s.P.filter(p => roles[p.id] !== 'mafia' && roles[p.id] !== 'joker');
  return [];
}

export interface Seat {
  id: string;            // معرف العضو (kick_username)
  name: string;          // الاسم الظاهر
  handle: string;        // اسم الحساب في Kick
  avatar?: string | null;
  alive: boolean;
  ready: boolean;
  muted: boolean;
  joinedAt: number;
}

export interface Cfg {
  auto: boolean;
  mafia: number;
  doctor: boolean;
  elder: boolean;
  detective: boolean;
  joker: boolean;
  invest: boolean;
  reveal: boolean;
  /** الجوكر لا يفوز إذا أُقصي في أول يوم */
  jokerSafeDay1: boolean;
  /** المحقق يحقق كل ليلتين */
  detEveryOther: boolean;
  tMafia: number; tDoc: number; tElder: number; tDet: number; tDay: number; tVote: number;
}

export interface Night {
  mv: Record<string, string>;
  protect: string | null;
  silence: string | null;
  invest: string | null;
  /** نتيجة تحقيق الشايب للّيلة الحالية — تصل للشايب وحده */
  investRes: 'mafia' | 'clean' | null;
  det: string | null;
  kill: string | null;
}

/** ملاحظة تحقيق واحدة من سجل المحقق */
export interface DetNote {
  by: string;
  rd: number;
  id: string;
  name: string;
  res: DetResult;
}

export interface Result {
  ok?: boolean; id?: string; name?: string; ej?: boolean; tie?: boolean; joker?: boolean;
}

export interface GameState {
  v: 4;
  ph: Phase;
  st: Step;
  rd: number;
  cfg: Cfg;
  P: Seat[];
  nt: Night;
  votes: Record<string, string>;
  tEnd: number;
  tTot: number;
  pause: boolean;
  res: Result | null;
  win: 'town' | 'mafia' | 'joker' | null;
  crit: boolean;
  usedInv: boolean;
  detLog: DetNote[];
  log: string[];
  startedAt: number;
  updatedAt: number;
}

export const defaultCfg = (): Cfg => ({
  auto: true, mafia: 1, doctor: true, elder: true, detective: true, joker: true,
  invest: true, reveal: false, jokerSafeDay1: false, detEveryOther: false,
  tMafia: 60, tDoc: 20, tElder: 20, tDet: 20, tDay: 120, tVote: 40,
});

const emptyNight = (): Night => ({
  mv: {}, protect: null, silence: null, invest: null, investRes: null, det: null, kill: null,
});

export function createRoomState(): GameState {
  const now = Date.now();
  return {
    v: 4, ph: 'join', st: '', rd: 0, cfg: defaultCfg(), P: [],
    nt: emptyNight(), votes: {}, tEnd: 0, tTot: 0, pause: false, res: null,
    win: null, crit: false, usedInv: false, detLog: [],
    log: [], startedAt: now, updatedAt: now,
  };
}

/* ===== أدوات ===== */
export const rnd = (n: number) => Math.floor(Math.random() * n);
export const shuffle = <T,>(a: T[]): T[] => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const cls = (s: GameState) => JSON.parse(JSON.stringify(s)) as GameState;

export const seatPos = (i: number, n: number) => {
  const a = (2 * Math.PI * i) / n;
  return { x: 50 + 44 * Math.sin(a), y: 50 - 41 * Math.cos(a) };
};

export const aliveSeats = (s: GameState) => s.P.filter(p => p.alive);
export const roleSeats = (s: GameState, roles: Record<string, Role>, role: Role) =>
  aliveSeats(s).filter(p => roles[p.id] === role);

/* ===== التوزيع ===== */
export function plan(s: GameState) {
  const n = s.P.length;
  const c = s.cfg;
  const m = c.auto ? Math.max(1, Math.round(n / 3.5)) : Math.max(1, c.mafia);
  const d = c.doctor ? 1 : 0;
  const e = c.elder ? 1 : 0;
  const t = c.detective && n >= DETECTIVE_MIN ? 1 : 0;
  const j = c.joker && n >= JOKER_MIN ? 1 : 0;
  const ct = n - m - d - e - t - j;
  let err = '';
  if (n < MIN_PLAYERS) err = `الحد الأدنى ${MIN_PLAYERS} لاعبين`;
  else if (m < 1) err = 'يلزم مافيا واحد على الأقل';
  else if (m * 2 >= n) err = 'عدد المافيا كبير: يجب أن يكون أقل من نصف اللاعبين';
  else if (ct < 0) err = 'الأدوار الخاصة أكثر من اللاعبين';
  return { m, d, e, t, j, ct, err };
}

export function dealRoles(s: GameState): { state: GameState; roles: Record<string, Role>; err: string } {
  const st = cls(s);
  const pn = plan(st);
  if (pn.err) return { state: s, roles: {}, err: pn.err };

  const bag: Role[] = [
    ...Array(pn.m).fill('mafia'),
    ...Array(pn.d).fill('doctor'),
    ...Array(pn.e).fill('elder'),
    ...Array(pn.t).fill('detective'),
    ...Array(pn.j).fill('joker'),
    ...Array(pn.ct).fill('citizen'),
  ] as Role[];
  shuffle(bag);
  shuffle(st.P);

  const roles: Record<string, Role> = {};
  st.P.forEach((p, i) => {
    roles[p.id] = bag[i];
    p.alive = true;
    p.ready = false;
    p.muted = false;
  });

  st.rd = 0;
  st.win = null;
  st.res = null;
  st.usedInv = false;
  st.detLog = [];
  st.log = [];
  st.nt = emptyNight();
  st.votes = {};
  st.ph = 'deal';
  st.st = '';
  st.tTot = 5;
  st.tEnd = Date.now() + 5000;
  st.P.forEach(p => st.log.push(`${p.name}: ${ROLE_INFO[roles[p.id]].n}`));
  st.updatedAt = Date.now();
  return { state: st, roles, err: '' };
}

/* ===== نتيجة تحقيق المحقق ===== */
export const detResultOf = (role?: Role | null): DetResult =>
  role === 'mafia' ? 'mafia' : role === 'joker' ? 'sus' : 'clean';

/** هل يحق للمحقق التحقيق هذه الليلة؟ (خيار كل ليلتين) */
export const detCanAct = (s: GameState) => !s.cfg.detEveryOther || s.rd % 2 === 1;

/** غرف قديمة لا تحمل السجل — لا نفترض شيئاً */
export const detNotes = (s: GameState): DetNote[] => (Array.isArray(s.detLog) ? s.detLog : []);

export const detNotesFor = (s: GameState, userId: string): DetNote[] =>
  detNotes(s).filter(n => n.by === userId);

/* ===== المراحل ===== */
function dur(s: GameState, st: Step, roles: Record<string, Role>) {
  const c = s.cfg;
  if (st === 'mafia') return c.tMafia;
  if (st === 'doctor') return roleSeats(s, roles, 'doctor').length ? c.tDoc : 7;
  if (st === 'elder') return roleSeats(s, roles, 'elder').length ? c.tElder : 7;
  if (st === 'detective') {
    return roleSeats(s, roles, 'detective').length && detCanAct(s) ? c.tDet : 7;
  }
  if (st === 'talk') return c.tDay;
  if (st === 'vote') return c.tVote;
  return DUR[st] || 5;
}

function checkWin(s: GameState, roles: Record<string, Role>): 'town' | 'mafia' | null {
  const m = aliveSeats(s).filter(p => roles[p.id] === 'mafia').length;
  const other = aliveSeats(s).length - m;
  if (m === 0) return 'town';
  if (m >= other) return 'mafia';
  return null;
}

/* الخطوات التي تُنفّذ لحظة الدخول إليها (نفس تصميم v4) */
function enterStep(s: GameState, roles: Record<string, Role>, ph: Phase, st: Step): string[] {
  const notes: string[] = [];
  if (st === 'nightfall') {
    s.nt = emptyNight();
    s.log.push(`— الليلة ${s.rd} —`);
  }
  if (st === 'm_sleep') resolveKill(s, roles);
  if (st === 'op3') resolveOp(s);
  if (ph === 'day' && st === 'talk') {
    const silenced = s.nt.silence;
    if (silenced) {
      const p = s.P.find(x => x.id === silenced);
      if (p && p.alive) {
        p.muted = true;
        s.log.push(`أُسكِت ${p.name} هذه الجولة`);
        notes.push(p.id);
      }
    }
  }
  if (st === 'vote') s.votes = {};
  if (st === 'res') resolveVote(s, roles);
  return notes;
}

function setStep(s: GameState, roles: Record<string, Role>, ph: Phase, st: Step): GameState {
  s.ph = ph;
  s.st = st;
  const secs = dur(s, st, roles);
  s.tTot = secs;
  s.tEnd = Date.now() + secs * 1000;
  enterStep(s, roles, ph, st);
  s.updatedAt = Date.now();
  return s;
}

function resolveKill(s: GameState, roles: Record<string, Role>) {
  const proposals = Object.values(s.nt.mv).filter(id => {
    const p = s.P.find(x => x.id === id);
    return p && p.alive;
  });
  let target: string | undefined;
  if (proposals.length) {
    const counts: Record<string, number> = {};
    proposals.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
    const max = Math.max(...Object.values(counts));
    target = shuffle(Object.keys(counts).filter(k => counts[k] === max))[0];
  } else {
    const civ = aliveSeats(s).filter(p => roles[p.id] !== 'mafia');
    target = civ.length ? civ[rnd(civ.length)].id : undefined;
  }
  s.nt.kill = target || null;
  const p = s.P.find(x => x.id === target);
  if (p) s.log.push(`المافيا اختارت: ${p.name}`);
}

function resolveOp(s: GameState) {
  const killId = s.nt.kill;
  if (!killId) { s.res = null; return; }
  const victim = s.P.find(x => x.id === killId);
  if (!victim) { s.res = null; return; }
  const saved = killId === s.nt.protect;
  s.res = { ok: !saved, id: victim.id, name: victim.name };
  if (!saved) {
    victim.alive = false;
    s.log.push(`${victim.name} قُتل`);
  } else {
    s.log.push(`الدكتور أنقذ ${victim.name}`);
  }
}

export function voteCounts(s: GameState) {
  const c: Record<string, number> = {};
  Object.values(s.votes).forEach(t => {
    if (t !== 'skip') c[t] = (c[t] || 0) + 1;
  });
  return c;
}

function resolveVote(s: GameState, roles: Record<string, Role>) {
  const c = voteCounts(s);
  let skip = 0;
  Object.values(s.votes).forEach(t => { if (t === 'skip') skip++; });
  const max = Math.max(0, ...Object.values(c));
  const tops = Object.keys(c).filter(k => c[k] === max);
  if (max > 0 && tops.length === 1 && skip < max) {
    const p = s.P.find(x => x.id === tops[0]);
    if (p && p.alive) {
      p.alive = false;
      const isJoker = roles[p.id] === 'joker';
      const jokerWins = isJoker && !(s.cfg.jokerSafeDay1 && s.rd <= 1);
      s.res = { ej: true, name: p.name, id: p.id, joker: jokerWins || undefined };
      s.log.push(`أُقصي بالتصويت: ${p.name}${s.cfg.reveal ? ` (${ROLE_INFO[roles[p.id]].n})` : ''}`);
      if (jokerWins) s.log.push(`كان ${p.name} هو الجوكر — فاز وحده`);
      return;
    }
  }
  s.res = { ej: false, tie: max > 0 };
  s.log.push('لم يُقصَ أحد');
}

function startNight(s: GameState, roles: Record<string, Role>) {
  s.rd += 1;
  s.nt = emptyNight();
  s.P.forEach(p => { p.muted = false; });
  s.votes = {};
  s.res = null;
  s.crit = false;
  return setStep(s, roles, 'night', 'nightfall');
}

function endGame(s: GameState, win: WinSide) {
  s.ph = 'end';
  s.st = '';
  s.win = win;
  s.tEnd = 0;
  s.log.push(WIN_TEXT[win as 'town' | 'mafia' | 'joker']);
  s.updatedAt = Date.now();
  return s;
}

function afterDeal(s: GameState, roles: Record<string, Role>) {
  s.ph = 'reveal';
  s.st = '';
  s.tTot = 45;
  s.tEnd = Date.now() + 45000;
  s.updatedAt = Date.now();
  return s;
}

function afterNight(s: GameState, roles: Record<string, Role>) {
  const w = checkWin(s, roles);
  if (w) return endGame(s, w);
  const m = aliveSeats(s).filter(p => roles[p.id] === 'mafia').length;
  s.crit = aliveSeats(s).length - m === m + 1;
  return setStep(s, roles, 'day', 'talk');
}

function afterDay(s: GameState, roles: Record<string, Role>) {
  if (s.res?.joker) return endGame(s, 'joker');
  const w = checkWin(s, roles);
  return w ? endGame(s, w) : startNight(s, roles);
}

/** الانتقال للمرحلة التالية */
export function nextPhase(prev: GameState, roles: Record<string, Role>): GameState {
  const s = cls(prev);
  if (s.ph === 'deal') return afterDeal(s, roles);
  if (s.ph === 'reveal') return startNight(s, roles);
  if (s.ph === 'night') {
    const i = NIGHT_STEPS.indexOf(s.st);
    if (i < NIGHT_STEPS.length - 1) return setStep(s, roles, 'night', NIGHT_STEPS[i + 1]);
    return afterNight(s, roles);
  }
  if (s.ph === 'day') {
    if (s.st === 'talk') return setStep(s, roles, 'day', 'vote');
    if (s.st === 'vote') return setStep(s, roles, 'day', 'res');
    return afterDay(s, roles);
  }
  return s;
}

/** هل انتهى وقت المرحلة الحالية؟ */
export function timeUp(s: GameState) {
  return !!s.tEnd && !s.pause && s.ph !== 'join' && s.ph !== 'end' && Date.now() >= s.tEnd;
}

export function resetToLobby(prev: GameState): GameState {
  const s = cls(prev);
  s.ph = 'join';
  s.st = '';
  s.rd = 0;
  s.win = null;
  s.res = null;
  s.tEnd = 0;
  s.tTot = 0;
  s.nt = emptyNight();
  s.votes = {};
  s.crit = false;
  s.usedInv = false;
  s.detLog = [];
  s.P.forEach(p => { p.alive = true; p.ready = false; p.muted = false; });
  s.log = [];
  s.updatedAt = Date.now();
  return s;
}

/** يبني المعلومة الخاصة للاعب (دوره وما يستطيع فعله الآن) */
export function playerAct(s: GameState, role: Role, me: Seat) {
  if (!me.alive) return null;
  if (s.ph === 'night' && s.st === 'mafia' && role === 'mafia') {
    const targets = aliveSeats(s).filter(p => p.id !== me.id);
    return { k: 'mafia' as const, targets, my: s.nt.mv[me.id] || null };
  }
  if (s.ph === 'night' && s.st === 'doctor' && role === 'doctor') {
    return { k: 'doctor' as const, targets: aliveSeats(s), my: s.nt.protect };
  }
  if (s.ph === 'night' && s.st === 'elder' && role === 'elder') {
    return {
      k: 'elder' as const,
      targets: aliveSeats(s).filter(p => p.id !== me.id),
      my: s.nt.silence || s.nt.invest,
      investLeft: s.cfg.invest && !s.usedInv,
    };
  }
  if (s.ph === 'night' && s.st === 'detective' && role === 'detective') {
    if (!detCanAct(s)) return null;
    const tried = new Set(detNotes(s).map(n => n.id));
    return {
      k: 'detective' as const,
      targets: aliveSeats(s).filter(p => p.id !== me.id && !tried.has(p.id)),
      my: s.nt.det,
      everyOther: s.cfg.detEveryOther,
    };
  }
  if (s.ph === 'day' && s.st === 'vote') {
    return {
      k: 'vote' as const,
      targets: aliveSeats(s).filter(p => p.id !== me.id),
      my: s.votes[me.id] || null,
    };
  }
  return null;
}

/** كل لاعب صوّت أو مافيا اتفقت (لإنهاء المرحلة مبكراً) */
export function everyoneActed(s: GameState, roles: Record<string, Role>) {
  if (s.ph === 'day' && s.st === 'vote') {
    return aliveSeats(s).every(p => !!s.votes[p.id]);
  }
  if (s.ph === 'night' && s.st === 'mafia') {
    const mafia = aliveSeats(s).filter(p => roles[p.id] === 'mafia');
    if (!mafia.length) return false;
    return mafia.every(p => !!s.nt.mv[p.id]) &&
      new Set(mafia.map(p => s.nt.mv[p.id])).size === 1;
  }
  return false;
}
