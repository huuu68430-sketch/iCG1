import type { GameTutorial } from '../../components/tutorial/types';
import { P } from '../tutorial_players';

/**
 * صادق أم كذاب — مطابق لـ components/TruthOrLie.tsx: بطاقة تحدي وصورة وتصويت جمهور.
 * المتابع ما يحتاج كلمة دخول — يكتب «صادق» أو «كذاب» أثناء التصويت فقط.
 */
export const truthOrLie: GameTutorial = {
  viewId: 'TRUTH_OR_LIE',
  title: 'صادق أم كذاب',
  tagline: 'موضوع غريب على الشاشة، والجمهور يقرر: حقيقة ولا كذبة — صوت واحد لكل شخص.',
  emoji: '🤥',
  join: 'chat',
  rules: [
    'ما فيه كلمة دخول: أول ما يبين «تصويت جاري» صوّت مباشرة في الشات.',
    'اكتب «!صادق» أو «صادق» للحقيقة، و«!كذاب» أو «كذاب» للكذبة.',
    'صوت واحد لكل شخص في الجولة — التكرار والثاني ما يحس.',
    'الهوست يولّد التحدي ويحدد الصح تحت «اختر الإجابة» قبل «ابدأ التصويت»، و«إلغاء» يرجّعه.',
    'البطاقة الصح تكبر وتتنور بالذهبي مع «إجابة صحيحة!» والغلط تُظلَّم، وكل مصوّت على الصح ياخذ نقاطه.',
  ],
  scoring: 'كل مصوّت على الجهة الصح ياخذ نقاطه: ١٥٠ نقطة للمباراة و٤٠ للجولة.',
  steps: [
    {
      chip: 'البداية',
      narration: 'من لوحة الهوست اضغط «توليد تحدي جديد» — بدونه يقولك «يرجى توليد تحدي أولاً!».',
      parts: [
        { t: 'kicker', text: 'TRUTH OR LIE • IDLE' },
        { t: 'headline', text: 'صادق أم كذاب', sub: 'بانتظار بدء التحدي…' },
        { t: 'chips', items: [{ text: 'الحالة: واقف', tone: 'dim' }, { text: '٣٠ ثانية للتصويت', tone: 'cream' }] },
        { t: 'cta', id: 'gen', text: 'توليد تحدي جديد', hint: 'يبين «جاري التحميل...» أثناء التوليد' },
      ],
      click: 'gen',
      ms: 5400,
    },
    {
      chip: 'الحقيقة',
      narration: 'التحدي نزل مع صورته — الهوست هو اللي يحدد الجواب تحت «اختر الإجابة» بـ«صادق» أو «كذاب».',
      parts: [
        { t: 'headline', text: 'الأخطبوط يغيّر لونه حسب المكان' },
        { t: 'art', emoji: '🐙', caption: 'صورة الكارت على المسرح', tone: 'cream' },
        { t: 'tiles', cols: 2, caption: 'اختر الإجابة', items: [
          { label: 'صادق', state: 'pick', tone: 'green' },
          { label: 'كذاب', state: 'idle', tone: 'red' },
        ] },
        { t: 'cta', id: 'truth', text: 'صادق' },
      ],
      click: 'truth',
      ms: 5600,
    },
    {
      chip: 'التصويت',
      narration: 'بعد ما تختار الصح اضغط «ابدأ التصويت» — الحالة تتحول «تصويت جاري» والعدّاد يمسك ٣٠ ثانية.',
      parts: [
        { t: 'headline', text: 'تصويت جاري', sub: 'صوت واحد لكل شخص' },
        { t: 'tally', rows: [
          { label: 'صادق', pct: 52, tone: 'green', votes: 7 },
          { label: 'كذاب', pct: 48, tone: 'red', votes: 6 },
        ] },
        { t: 'ring', seconds: 30, label: 'ثانية' },
        { t: 'cta', id: 'vote', text: 'ابدأ التصويت', hint: '«إلغاء» توقف الجولة وترجعك' },
      ],
      click: 'vote',
      chat: [{ player: P('mishal'), text: 'هذي واضحة 😏', kind: 'say' }],
      ms: 5800,
    },
    {
      chip: 'أصواتكم',
      narration: 'اكتب «!صادق» أو «!كذاب» في الشات — النِسَب تتحرك وشريط «آخر المصوتين» يملأ على اليمين.',
      parts: [
        { t: 'bigText', text: 'صوّت: !صادق أو !كذاب', sub: 'الرسالة الأولى فقط تُحسب لك', tone: 'cream' },
        { t: 'tally', rows: [
          { label: 'صادق', pct: 64, tone: 'green', votes: 12, players: [P('aboReem'), P('lulu'), P('nourah')] },
          { label: 'كذاب', pct: 36, tone: 'red', votes: 7, players: [P('saqr'), P('dani')] },
        ] },
        { t: 'note', text: 'اللوحة على اليمين تُظهر «تصويت الجمهور (١٩)» و«آخر المصوتين».' },
      ],
      at: 'chat',
      chat: [
        { player: P('aboReem'), text: '!صادق', kind: 'answer' },
        { player: P('lulu'), text: 'صادق', kind: 'answer' },
        { player: P('saqr'), text: '!كذاب 👀', kind: 'answer' },
      ],
      ms: 6400,
    },
    {
      chip: 'الكشف',
      narration: 'الهوست يضغط «كشف النتيجة» — الكارت الصح يكبر ويتذهّب وبادج «إجابة صحيحة!» يدور فوقه.',
      parts: [
        { t: 'headline', text: 'إجابة صحيحة!', sub: 'الكارت الصح يتنور بالذهبي والثاني يُظلَّم', tone: 'gold' },
        { t: 'tiles', cols: 2, caption: 'بطاقتا التحدي', items: [
          { label: 'صادق', sub: 'إجابة صحيحة!', state: 'good', tone: 'gold' },
          { label: 'كذاب', sub: 'جهة خاطئة', state: 'bad', tone: 'dim' },
        ] },
        { t: 'chips', items: [{ text: '١٢ مصوّت على الصح', tone: 'green' }, { text: '٤٠ نقطة للجولة', tone: 'gold' }] },
        { t: 'cta', id: 'reveal', text: 'كشف النتيجة' },
      ],
      click: 'reveal',
      chat: [{ player: P('dani'), text: 'طلعت حقيقة والله 😲', kind: 'say' }],
      ms: 5600,
      zoom: 1.08,
    },
    {
      chip: 'الختام',
      narration: 'نقاط الجولة تنزل لكل من صوّت على الصح، ثم «جولة جديدة» تولّد تحدياً آخر من نفس اللوحة.',
      parts: [
        { t: 'headline', text: 'انتهت الجولة', sub: 'المصوّتون على الجهة الصح ياخذون ١٥٠ أو ٤٠' },
        { t: 'podium', players: [P('aboReem'), P('lulu'), P('nourah')], points: ['١٥٠ نقطة', '٩٥', '٧٠'] },
        { t: 'cta', id: 'fresh', text: 'جولة جديدة' },
      ],
      click: 'fresh',
      chat: [{ player: P('turbo'), text: 'جولتي جاية أكيد 🔥', kind: 'say' }],
      ms: 5000,
    },
  ],
};
