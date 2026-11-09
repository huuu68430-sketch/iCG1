import type { GameTutorial } from '../../components/tutorial/types';
import { P } from '../tutorial_players';

/**
 * خمن الدولة — مطابقة لـ components/MapGuesser.tsx: خريطة العالم ولوحة التلميحات.
 * المتابع ما يحتاج كلمة دخول — يكتب اسم الدولة في الشات مباشرة.
 */
export const mapGuesser: GameTutorial = {
  viewId: 'MAP_GUESSER',
  title: 'خمن الدولة',
  tagline: 'دولة واحدة تنور بالذهبي على الخريطة — أول من يكتب اسمها في الشات يكسب الجولة.',
  emoji: '🗺️',
  join: 'chat',
  rules: [
    'ما فيه كلمة دخول ولا أوامر: أول رسالة في الشات تحتوي اسم الدولة تاخذ الجولة.',
    'الهوست يحدد عدد الجولات من ١ إلى ٢٠ ويختار الصعوبة: سهل أو متوسط أو صعب.',
    'كل الدول غامقة إلا الدولة المطلوبة — تنور بالذهبي والكاميرا تقرب على مركزها.',
    'التلميحات بيد الهوست: «القارة» و«الحرف» و«العاصمة» و«موقعها (خريطة)» — وما فيه مؤقت.',
    'الكتابة تُفهم مهما كانت الهمزات: أ و إ و آ ترجع ا، و ة ترجع ه — و«لم يعرفها أحد» تغلق الجولة.',
  ],
  scoring: 'أول إجابة صحيحة تكسب الجولة: ١٤٠ نقطة للفائز بالمباراة و٤٠ لكل جولة، والجولة الملغية بلا نقاط.',
  steps: [
    {
      chip: 'الإعداد',
      narration: 'من شاشة الإعداد اختار عدد الجولات والصعوبة — «متوسط» يعطي تنوع كبير — ثم «بدء اللعبة».',
      parts: [
        { t: 'kicker', text: 'MAP GUESSER • SETUP' },
        { t: 'tiles', cols: 5, caption: 'عدد الجولات', items: [
          { label: '١', sub: 'جولة', state: 'idle' },
          { label: '٣', sub: 'جولات', state: 'idle' },
          { label: '٥', sub: 'جولات', state: 'hot' },
          { label: '١٠', sub: 'جولات', state: 'idle' },
          { label: '٢٠', sub: 'جولة', state: 'idle' },
        ] },
        { t: 'tiles', cols: 3, caption: 'الصعوبة', items: [
          { label: 'سهل', sub: 'زوم خفيف ودول معروفة', state: 'idle' },
          { label: 'متوسط', sub: 'تنوع كبير', state: 'pick' },
          { label: 'صعب', sub: 'دول صعبة ومجهولة', state: 'idle' },
        ] },
        { t: 'cta', id: 'start', text: 'بدء اللعبة' },
      ],
      click: 'start',
      ms: 5800,
    },
    {
      chip: 'الخريطة',
      narration: 'الجولة تبدأ على الخريطة: كل الدول غامقة وواحدة بس تنور بالذهبي والكاميرا تقرب عليها.',
      parts: [
        { t: 'headline', text: 'جولة ٣ / ٥', sub: 'شوف الدولة المضيئة وخمّن اسمها' },
        { t: 'art', emoji: '🌍', caption: 'الدولة المطلوبة تنور بالذهبي', tone: 'gold' },
        { t: 'tiles', cols: 3, caption: 'لوحة التلميحات', items: [
          { label: 'تلميح القارة', state: 'idle' },
          { label: 'أول حرف', state: 'idle' },
          { label: 'تلميح العاصمة', state: 'idle' },
        ] },
        { t: 'chips', items: [{ text: 'بلا مؤقت — الهوست يمشي على مهله', tone: 'cream' }] },
      ],
      at: 'stage',
      ms: 5200,
      zoom: 1.05,
    },
    {
      chip: 'التلميحات',
      narration: 'الهوست يفتح التلميحات من «أزرار التحكم (لا تظهر بالبث)» — يبدأ بـ«القارة» إذا الشات تعثّر.',
      parts: [
        { t: 'headline', text: 'تلميح القارة', sub: 'يظهر في لوحة التلميحات على يمين الخريطة' },
        { t: 'tiles', cols: 3, caption: 'لوحة التلميحات', items: [
          { label: 'تلميح القارة', sub: 'أمريكا الجنوبية', state: 'good' },
          { label: 'أول حرف', state: 'idle' },
          { label: 'تلميح العاصمة', state: 'idle' },
        ] },
        { t: 'note', text: 'لو الشات ولا واحد قرب يصيب، استخدم «موقعها (خريطة)» أو «لم يعرفها أحد».' },
        { t: 'cta', id: 'hintContinent', text: 'القارة' },
      ],
      click: 'hintContinent',
      ms: 5600,
    },
    {
      chip: 'الإجابة',
      narration: 'اكتب اسم الدولة في الشات مثل «الأرجنتين» — ما تحتاج أمر، والهمزات والتاء مربوطة تُفهم.',
      parts: [
        { t: 'bigText', text: 'اكتب اسم الدولة في الشات', sub: 'أول رسالة تحتوي الاسم تفوز', tone: 'cream' },
        { t: 'note', text: 'التنعيم: أ و إ و آ ترجع ا · ة ترجع ه' },
        { t: 'chips', items: [{ text: 'بلا كلمة دخول', tone: 'dim' }, { text: 'صوت واحد لكل جولة', tone: 'cream' }] },
      ],
      at: 'chat',
      chat: [
        { player: P('lulu'), text: 'الأرجنتين', kind: 'answer' },
        { player: P('saqr'), text: 'ارجنتين 🙌', kind: 'answer' },
        { player: P('nourah'), text: 'قربت عليها 😅', kind: 'say' },
      ],
      ms: 6400,
    },
    {
      chip: 'الكشف',
      narration: 'أول رسالة صحيحة تطلع فوق الخريطة مع الكأس واسم الدولة، ثم الهوست يضغط «الجولة التالية».',
      parts: [
        { t: 'headline', text: 'أول من عرف الدولة', sub: 'الأرجنتين', tone: 'gold' },
        { t: 'portrait', player: P('lulu'), caption: 'أول من عرف الدولة', tone: 'gold' },
        { t: 'note', text: 'لو ما حد عرف: دائرة حمراء على الخريطة و«انتهت الجولة».' },
        { t: 'cta', id: 'nextRound', text: 'الجولة التالية' },
      ],
      click: 'nextRound',
      chat: [{ player: P('lulu'), text: 'عرفتها من شكل الخريطة 😎', kind: 'say' }],
      ms: 5400,
      zoom: 1.08,
    },
    {
      chip: 'الختام',
      narration: 'آخر الجولات يضغط الهوست «إنهاء اللعبة» — لصاحب المباراة ١٤٠ نقطة ولكل جولة ٤٠.',
      parts: [
        { t: 'headline', text: 'انتهت الجولات', sub: 'أكثر من عرف الدول يطلع الأول' },
        { t: 'podium', players: [P('lulu'), P('aboReem'), P('saqr')], points: ['١٤٠ نقطة', '٨٥', '٦٠'] },
        { t: 'cta', id: 'finish', text: 'إنهاء اللعبة', hint: 'أو «الجولة التالية» لو باقي وقت' },
      ],
      click: 'finish',
      ms: 5000,
    },
  ],
};
