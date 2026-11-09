import type { GameTutorial } from '../../components/tutorial/types';
import { P } from '../tutorial_players';

/**
 * سباق الكتابة — أزرار ونصوص مطابقة لـ components/TypingRace.tsx.
 * المتابع ما يحتاج كلمة دخول: يكتب الكلمة نفسها في الشات بأقل وقت.
 */
export const typingRace: GameTutorial = {
  viewId: 'TYPING_RACE',
  title: 'سباق الكتابة',
  tagline: 'كلمة عربية طويلة تنزل على الشاشة — أول من يكتبها حرفياً بأسرع وقت يكسب الجولة.',
  emoji: '⌨️',
  join: 'chat',
  rules: [
    'ما تحتاج كلمة دخول: أول ما تنزل الكلمة اكتبها في الشات على طول.',
    'رسالتك لازم تساوي الكلمة بالضبط بعد حذف الفراغ الزايد — حرف ناقص واحد ما يحسب.',
    'العدّاد يطلع من الصفر فوق الكلمة، وأيقونة الساعة تزيد دوران بعد ١٠ ثواني.',
    'الكلمات ما تتكرر إلا بعد نفاذ البنك كله، و«إعادة خلط» تعيد تعبئته.',
    'الهوست يقدر يتجاوز الكلمة الصعبة أو يقفل الجلسة بـ«خروج».',
  ],
  scoring: 'أسرع من كتب الكلمة كاملة ياخذ الجولة: ١٠٠ نقطة للمباراة و٣٠ للجولة.',
  steps: [
    {
      chip: 'البداية',
      narration: 'من «لوحة التحكم» اضغط «ابـدأ الـسـبـاق» — الكلمة تنزل وما تحتاج انضمام.',
      parts: [
        { t: 'kicker', text: 'TYPING RACE • IDLE' },
        { t: 'art', emoji: '⌨️', caption: 'سباق الكتابة — محرك السرعة', tone: 'gold' },
        { t: 'headline', text: 'سباق الكتابة', sub: 'الكلمات الجاهزة في البنك تنتظر أول ضغط' },
        { t: 'cta', id: 'start', text: 'ابـدأ الـسـبـاق' },
      ],
      click: 'start',
      ms: 5200,
    },
    {
      chip: 'الكلمة',
      narration: 'تنزل كلمة كبيرة مائلة مع انعكاس تحتها، والعدّاد يبدأ يطلع من الصفر.',
      parts: [
        { t: 'bigText', text: 'الاستراتيجية', sub: 'اكتب الكلمة بأسرع ما يمكن!', tone: 'cream' },
        { t: 'art', emoji: '⏱️', caption: 'العدّاد فوق الكلمة: ٠٫٠٠', tone: 'gold' },
        { t: 'tiles', cols: 5, caption: 'آخر الكلمات', items: [
          { label: 'الديماغوجية', state: 'dim' },
          { label: 'الببليوغرافيا', state: 'dim' },
          { label: 'الديمقراطية', state: 'dim' },
          { label: 'النوستالجيا', state: 'dim' },
          { label: 'الاستراتيجية', state: 'hot' },
        ] },
        { t: 'chips', items: [{ text: 'بلا كلمة دخول', tone: 'dim' }, { text: 'مطابقة تامة', tone: 'cream' }] },
      ],
      at: 'stage',
      ms: 5000,
      zoom: 1.07,
    },
    {
      chip: 'الكتابة',
      narration: 'اكتب الكلمة في الشات مثل «الببليوغرافيا» بالضبط — الخطأ حرف واحد يطلعك من السباق.',
      parts: [
        { t: 'headline', text: 'اكتب الكلمة كما هي', sub: 'بدون همزة زائدة ولا مسافة ناقصة' },
        { t: 'note', text: 'الفراغ قبل الكلمة وبعدها يُحذف تلقائياً — الباقي لازم يطابق.' },
        { t: 'bigText', text: 'الببليوغرافيا', tone: 'gold' },
      ],
      at: 'chat',
      chat: [
        { player: P('turbo'), text: 'الببليوغرافيا', kind: 'answer' },
        { player: P('mishal'), text: 'الببليوغرافي', kind: 'answer' },
        { player: P('nourah'), text: 'طلعت مني الراء 😩', kind: 'say' },
      ],
      ms: 6400,
    },
    {
      chip: 'التجاوز',
      narration: '«تجاوز الكلمة» يرمي كلمة جديدة، و«إعادة خلط» تعبّئ البنك وتقول «تم إعادة تعبئة الكلمات!».',
      parts: [
        { t: 'headline', text: 'لوحة التحكم', sub: 'الأزرار تتبدل حسب حالة الكلمة على الشاشة' },
        { t: 'tiles', cols: 3, items: [
          { label: 'تجاوز الكلمة', sub: 'والكلمة ظاهرة', state: 'hot' },
          { label: 'إعادة خلط', sub: 'تعبئة البنك من جديد', state: 'idle' },
          { label: 'خروج', state: 'idle' },
        ] },
        { t: 'note', text: 'أثناء التوليد يبان «جاري التوليد...» بدل الزر.' },
        { t: 'cta', id: 'skip', text: 'تجاوز الكلمة' },
      ],
      click: 'skip',
      ms: 5600,
    },
    {
      chip: 'الفائز',
      narration: 'اللوحة تهتز مع الكأس وكونفيتي من حواف الشاشة، والوقت يبان مثل ١٫٢٣ ثانية.',
      parts: [
        { t: 'headline', text: 'أسرع أصابع', sub: '١٫٢٣ ثانية', tone: 'gold' },
        { t: 'art', emoji: '🏆', caption: 'الكأس يقفز فوق اللوحة', tone: 'gold' },
        { t: 'portrait', player: P('turbo'), caption: '١٫٢٣٤ ثانية', tone: 'gold' },
        { t: 'cta', id: 'next', text: 'الجولة التالية', hint: 'أو «خروج» لإنهاء السباق' },
      ],
      click: 'next',
      chat: [{ player: P('turbo'), text: 'ما حسيت بشي 😂', kind: 'say' }],
      ms: 5400,
      zoom: 1.08,
    },
    {
      chip: 'الختام',
      narration: '«خروج» يقفل الجلسة بعد آخر كلمة — ١٠٠ نقطة للمباراة و٣٠ لكل كلمة صحيحة.',
      parts: [
        { t: 'headline', text: 'انتهى السباق', sub: 'لوحة أسرع الأصابع' },
        { t: 'podium', players: [P('turbo'), P('aboReem'), P('lulu')], points: ['١٠٠ نقطة', '٦٥', '٤٥'] },
        { t: 'cta', id: 'exit', text: 'خروج' },
      ],
      click: 'exit',
      chat: [{ player: P('aboReem'), text: 'جولة ثانية على السرعة 🔥', kind: 'say' }],
      ms: 4800,
    },
  ],
};
