// ============================================================
//  Botrix leaderboard — المصدر الموحد لأهل الشات
//  يستخدمه: BotrixLeaderboard (العرض) + AIChat (أسئلة الشات)
//  كاش 5 دقائق (ذاكرة + localStorage) عشان ما نضرب الـ API مع كل رسالة
// ============================================================

export interface BotrixEntry {
  level: number;
  watchtime: number; // بالثواني
  xp: number;
  points: number;
  name: string;
}

const API_URL =
  '/api/kick?endpoint=' +
  encodeURIComponent('https://botrix.live//api/public/leaderboard?platform=kick&user=iCG1');

const CACHE_KEY = 'icg1_botrix_cache_v1';
const TTL_MS = 5 * 60 * 1000;

let memCache: { at: number; data: BotrixEntry[] } | null = null;
let inflight: Promise<BotrixEntry[]> | null = null;

function toNum(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v);
  if (typeof v === 'string') {
    const n = parseInt(v.replace(/[^\d]/g, ''), 10);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function normalize(json: unknown): BotrixEntry[] {
  if (!Array.isArray(json)) return [];
  return (json as any[])
    .filter((e) => e && typeof e.name === 'string' && e.name.trim().length > 0)
    .map((e) => ({
      name: String(e.name).trim(),
      level: toNum(e.level),
      watchtime: toNum(e.watchtime),
      xp: toNum(e.xp),
      points: toNum(e.points),
    }));
}

function readCache(): BotrixEntry[] | null {
  if (memCache && Date.now() - memCache.at < TTL_MS) return memCache.data;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { at, data } = JSON.parse(raw);
    if (!Array.isArray(data) || Date.now() - at > TTL_MS) return null;
    memCache = { at, data };
    return data;
  } catch {
    return null;
  }
}

function writeCache(data: BotrixEntry[]) {
  memCache = { at: Date.now(), data };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data }));
  } catch {}
}

/** يجلب المتصدرين (كاش 5 دقائق + دمج الطلبات المتزامنة). يرجع [] عند الفشل. */
export async function fetchBotrixLeaderboard(force = false): Promise<BotrixEntry[]> {
  if (!force) {
    const hit = readCache();
    if (hit) return hit;
  }
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const data = normalize(json);
      if (data.length > 0) writeCache(data);
      return data.length > 0 ? data : readCache() || [];
    } catch {
      return readCache() || [];
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** الأعلى مشاهدة */
export function getTopByWatchtime(data: BotrixEntry[], n = 10): BotrixEntry[] {
  return [...data].sort((a, b) => b.watchtime - a.watchtime).slice(0, n);
}

/** الأعلى نقاطاً */
export function getTopByPoints(data: BotrixEntry[], n = 10): BotrixEntry[] {
  return [...data].sort((a, b) => b.points - a.points).slice(0, n);
}

/** اختيار عشوائي حقيقي من التوب (للترشيح والطقطقة) */
export function pickRandomFromTop(data: BotrixEntry[], poolSize = 10): BotrixEntry | null {
  const pool = getTopByWatchtime(data, poolSize);
  if (pool.length === 0) return null;
  let idx = 0;
  try {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    idx = buf[0] % pool.length;
  } catch {
    idx = Math.floor(Math.random() * pool.length);
  }
  return pool[idx];
}

/** يطبيع اسم المستخدم للمقارنة */
export function cleanName(s: string): string {
  return s.toLowerCase().trim().replace(/^@/, '');
}

/** يبحث عن شخص بالاسم (يتجاهل @ وحالة الأحرف) */
export function findChatter(data: BotrixEntry[], username: string): BotrixEntry | null {
  const target = cleanName(username);
  if (!target) return null;
  return data.find((e) => cleanName(e.name) === target) || null;
}

/** هل ذُكر اسم من المتصدرين داخل نص السؤال؟ (أول 50) */
export function extractMentionedChatter(question: string, data: BotrixEntry[]): BotrixEntry | null {
  const q = question.toLowerCase();
  const top = getTopByWatchtime(data, 50);
  // الأطول أولاً عشان ما يلقط اسم قصير داخل اسم أطول
  const sorted = [...top].sort((a, b) => b.name.length - a.name.length);
  for (const e of sorted) {
    const n = e.name.toLowerCase();
    if (n.length < 3) continue;
    // حد كلمات بسيط: الاسم محاط بغير حروف/أرقام
    const re = new RegExp(`(^|[^a-z0-9_])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9_]|$)`, 'i');
    if (re.test(q)) return e;
  }
  return null;
}

export function formatWatchtime(seconds: number, lang: 'ar' | 'en' = 'ar'): string {
  const s = Math.max(0, Math.round(seconds || 0));
  const days = Math.floor(s / 86400);
  const hrs = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  if (days > 0) return lang === 'ar' ? `${days} يوم و${hrs} ساعة` : `${days}d ${hrs}h`;
  if (hrs > 0) return lang === 'ar' ? `${hrs} ساعة` : `${hrs}h`;
  return lang === 'ar' ? `${mins} دقيقة` : `${mins}m`;
}

export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n || 0}`;
}

function line(e: BotrixEntry, lang: 'ar' | 'en'): string {
  return `${e.name} — ${formatWatchtime(e.watchtime, lang)} مشاهدة | لفله ${e.level} | ${formatCompact(e.xp)} XP | ${formatCompact(e.points)} نقطة`;
}

// ---------- كشف نية السؤال ----------
const RE_RANDOM = /اختار|اختر|رشح|عشوائ|واحد من|من الشات|ضحية|مين|منو|pick|random|choose/i;
const RE_TOP =
  /اكثر|أكثر|اكتر|احسن|أحسن|افضل|أفضل|متصدر|توب|ملك|اسوأ|أسوأ|ازعج|أزعج|هطف|ورع|اطول|أطول|مدمن|top|best|most/i;
const RE_STATS = /ساعات|ساعه|نقاط|نقط|مستو|لفل|xp|اكس بي|كم عنده|كم عنده|وش عنده|احصائ|إحصائ/i;
const RE_SELF = /ساعاتي|نقاطي|نقطي|كم عندي|انا كم|أنا كم|مستواي|لفلي|ساعات انا/i;

/**
 * يبني بلوك السياق الجاهز حسب نية السؤال:
 * - طلب اختيار/ترشيح → مرشح عشوائي محسوب مسبقاً (النموذج يستخدمه حرفياً وما يخترع)
 * - سؤال عن الأكثر/الأعلى → توب 10 + الأول محدد
 * - سؤال عن شخص مذكور → إحصائياته الدقيقة
 * - سؤال عن نفسه بدون اسم → يرجع تعليمات طلب الاسم فقط (بدون بلوك كبير)
 */
export function buildChatPeopleContext(
  question: string,
  data: BotrixEntry[],
  lang: 'ar' | 'en' = 'ar',
): string {
  if (!data || data.length === 0) {
    return `\n\n[بوتريكس]: البيانات غير متوفرة حالياً. قل: "البيانات غير متوفرة حالياً" ولا تخترع أسماء ولا أرقام أبداً.`;
  }

  const wantsRandom = RE_RANDOM.test(question);
  const wantsTop = RE_TOP.test(question);
  const wantsStats = RE_STATS.test(question) || wantsTop || wantsRandom;
  const asksSelf = RE_SELF.test(question);
  const mentioned = extractMentionedChatter(question, data);

  // سأل عن نفسه (ساعاتي/نقاطي) بدون ما يذكر اسمه → لازم يسأله عن اسمه أول
  if (asksSelf && !mentioned) {
    return `\n\n[بوتريكس]: المستخدم يسأل عن ساعات/نقاط نفسه ولم يذكر اسمه. اسأله أولاً بلطف عن اسمه في الكيك — ممنوع اختراع أي أرقام له.`;
  }

  // لا نية واضحة عن أهل الشات → بلوك مختصر يكفي
  if (!wantsStats && !mentioned) {
    const top3 = getTopByWatchtime(data, 3);
    return `\n\n[بوتريكس]: توب 3 أهل الشات حالياً: ${top3.map((e) => `${e.name} (${formatWatchtime(e.watchtime, lang)})`).join('، ')}. استخدمها فقط لو سُئلت عن الشات.`;
  }

  const top10 = getTopByWatchtime(data, 10);
  const lines = top10.map((e, i) => `${i + 1}. ${line(e, lang)}`).join('\n');
  let ctx = `\n\n[أهل الشات من بوتريكس — بيانات حية، هذول فقط أهل الشات]\n${lines}`;

  if (mentioned) {
    ctx += `\n\n⭐ الشخص المذكور في السؤال: ${line(mentioned, lang)} — أعطه أرقامه الحقيقية هذه مع تعليق ودود ومشجع.`;
  }

  if (wantsRandom) {
    const pick = pickRandomFromTop(data, 10);
    if (pick) {
      ctx += `\n\n🎲 الاختيار العشوائي المحسوم: ${line(pick, lang)}\nالقاعدة: إذا طلب منك اختيار/ترشيح شخص استخدم هذا الاسم حرفياً ولا تغيره ولا تخترع غيره، وقدّمه بأسلوب مهذب ومحايد دون أي سخرية أو إساءة.`;
    }
  }

  if (wantsTop && !wantsRandom) {
    const first = top10[0];
    if (first) ctx += `\n\n👑 الأول والأكثر: ${line(first, lang)} — هذا جواب أي سؤال عن "الأكثر/الأعلى/المتصدر".`;
  }

  ctx += `\n\nقواعد صارمة: (1) هذي الأسماء فقط هي أهل الشات — ممنوع تخترع اسم مو موجود هنا. (2) ممنوع تخترع أرقام — انسخها كما هي. (3) إذا سُئلت عن شخص مو موجود في القائمة قل إنك ما لقيته واطلب يتأكد من الاسم.`;
  return ctx;
}
