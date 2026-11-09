/**
 * مواصفات شروحات الألعاب — «فيديو كيف تلعب».
 * الشرح يعيد بناء شاشة الهوست بأسلوب مبسّط مطابق للأصل، مع ماوس متحرك يضغط
 * الأزرار الحقيقية بالاسم، وشات يشرح ما يكتبه المتابعون، وجوال للاعبين الهاتفيين.
 */

export type Tone = 'gold' | 'cream' | 'red' | 'green' | 'blue' | 'ember' | 'dim' | 'ghost';

export interface TutPlayer {
  name: string;
  avatar: string;
  /** معرّف الإطار من data/frames.ts */
  frame: string;
  /** شارة صغيرة فوق الاسم (دور، رقم، لقب) */
  tag?: string;
  tone?: Tone;
}

export interface TileItem {
  id?: string;
  label: string;
  sub?: string;
  state?: 'idle' | 'good' | 'bad' | 'hot' | 'dim' | 'pick';
  tone?: Tone;
  players?: TutPlayer[];
}

export interface TallyRow {
  label: string;
  pct: number;
  tone?: Tone;
  votes?: number;
  players?: TutPlayer[];
}

/** عناصر شاشة الهوست الوهمية */
export type Part =
  | { t: 'kicker'; text: string }
  | { t: 'headline'; text: string; sub?: string; tone?: Tone }
  | { t: 'bigText'; text: string; sub?: string; tone?: Tone; id?: string }
  | { t: 'art'; emoji: string; caption?: string; blur?: number; id?: string; tone?: Tone }
  | { t: 'tiles'; id?: string; cols?: number; items: TileItem[]; caption?: string }
  | { t: 'tally'; rows: TallyRow[]; caption?: string; id?: string }
  | { t: 'bar'; pct: number; label?: string; tone?: Tone; id?: string }
  | { t: 'ring'; seconds: number; total?: number; label?: string; id?: string }
  | { t: 'chips'; items: { text: string; tone?: Tone }[] }
  | { t: 'roster'; players: TutPlayer[]; caption?: string; id?: string; cols?: number }
  | { t: 'podium'; players: TutPlayer[]; points?: string[]; caption?: string }
  | { t: 'portrait'; player: TutPlayer; caption?: string; tone?: Tone; id?: string }
  | { t: 'cta'; text: string; id: string; tone?: Tone; hint?: string }
  | { t: 'code'; digits: string[]; revealed?: boolean; id?: string }
  | { t: 'wheel'; numbers: string[]; active?: string; id?: string; caption?: string }
  | { t: 'note'; text: string; tone?: Tone; id?: string }
  | { t: 'row'; parts: Part[] };

export interface ChatLine {
  player: TutPlayer;
  text: string;
  /** join = انضمام، answer = إجابة، say = كلام عادي، sys = النظام */
  kind?: 'join' | 'answer' | 'say' | 'sys';
}

/** شاشة الجوال (لعبة المافيا وكود نيمز فقط) */
export interface PhoneScene {
  kind: 'qr' | 'boot' | 'lobby' | 'shuffle' | 'role' | 'night' | 'vote' | 'talk' | 'board' | 'out' | 'win';
  title: string;
  sub?: string;
  code?: string;
  primary?: string;
  /** ما الذي يلمسه الإبهام: الزر الأساسي أو بلاطة برقمها */
  tap?: 'primary' | number;
  tiles?: TileItem[];
  cols?: number;
  players?: TutPlayer[];
  role?: { name: string; team: 'town' | 'mafia' | 'neutral'; desc: string };
  hint?: string;
  note?: string;
  tone?: Tone;
}

export interface Step {
  /** الشريط السفلي: الجملة التي تُقال في هذه اللحظة */
  narration: string;
  /** اسم المرحلة على الخط الزمني، مثل «اللوبي» */
  chip: string;
  parts: Part[];
  /** معرّف العنصر الذي يطير إليه الموس ويضغطه */
  click?: string;
  /** الموس يقف عند هذه الجهة بدل عنصر محدد */
  at?: 'chat' | 'phone' | 'stage' | 'none';
  /** رسائل الشات التي تصل أثناء هذه الخطوة */
  chat?: ChatLine[];
  /** شاشة الجوال المقابلة (لألعاب الهاتف) */
  phone?: PhoneScene;
  /** مدة الخطوة بالميلي ثانية */
  ms?: number;
  /** تكبير الكاميرا على العنصر المضغوط */
  zoom?: number;
  /** لا تُظهر الموس في هذه الخطوة */
  noCursor?: boolean;
}

export interface GameTutorial {
  viewId: string;
  title: string;
  tagline: string;
  emoji: string;
  /** كيف يدخل المتابع: شات أو جوال أو الاثنين */
  join: 'chat' | 'phone' | 'both';
  joinWord?: string;
  rules: string[];
  scoring: string;
  steps: Step[];
  /** لمحة سريعة عن جولة كاملة نموذجية */
  example?: string;
}
