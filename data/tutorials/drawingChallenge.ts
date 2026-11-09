import type { GameTutorial } from '../../components/tutorial/types';
import { P } from '../tutorial_players';

/**
 * تحدي الرسم — مرجع مطابق لشاشات components/DrawingChallenge.tsx
 * وأزرارها الحقيقية، مع بطولات الكلمات من data/drawBank.ts.
 */
export const drawingChallenge: GameTutorial = {
  viewId: 'DRAWING_CHALLENGE',
  title: 'تحدي الرسم',
  tagline: 'الهوست يرسم كلمة مستورة، والجمهور يخمّن في الشات — الأسرع بالصحيح ياخذ الأكبر.',
  emoji: '🎨',
  join: 'chat',
  joinWord: 'رسم',
  rules: [
    'الهوست يختار الكلمة من بطاقات حسب الفئة، والحروف تظهر مربعات مقفلة بـ «•» لين تنكشف.',
    'انضم بكتابة «رسم» في الشات، وبعدها اكتب تخمينك كأي رسالة — المطابقة تفهم العربية وتتغاضى عن «ال».',
    '«الكل يخمّن» شغال افتراضياً، فغير المسجّلين كمان يجمعون نقاط.',
    'الهوست يكشف لحد ٣ تلميحات بزر «كشف تلميح (0/3)» وكل تلميح ينقص نقاط الخانين ٣٠.',
    'الجولة تقفل لما ٣ لاعبين يصيبون أو يخلص الوقت — وتخمينك الصحيح يطلع معه «أصاب ✓».',
  ],
  scoring: 'نقاط الخان = (الأساس ١٠٠ سهل أو ١٥٠ متوسط أو ٢٢٠ صعب + بونص السرعة − ٣٠ لكل تلميح) × ١ للأسرع و٠٫٦ للثاني و٠٫٣٥ للثالث، وبحد أدنى ٢٥ — وحق الفوز ١٨٠ للمباراة و٦٠ للجولة.',
  steps: [
    {
      chip: 'التحضير',
      narration: 'من لوحة المرسم ظبط وقت الجولة وعدد الفائزين، ودوس «افتح باب المرسم».',
      parts: [
        { t: 'kicker', text: 'DRAWING CHALLENGE • SETUP' },
        { t: 'headline', text: 'لوحة المرسم', sub: 'كل شيء يُظبط قبل ما ينفتح اللوبي' },
        { t: 'tiles', cols: 3, items: [
          { label: '٦٠ ث', sub: 'وقت الجولة', state: 'hot' },
          { label: '٣', sub: 'الفائزون في الجولة', state: 'idle' },
          { label: 'مفتوح', sub: 'الكل يخمّن', state: 'idle', tone: 'green' },
        ] },
        { t: 'cta', id: 'open', text: 'افتح باب المرسم' },
      ],
      click: 'open',
      ms: 5200,
    },
    {
      chip: 'اللوبي',
      narration: 'يفتح اللوبي: اكتب «رسم» في الشات لتدخل قائمة المخمّنين، ثم الهوست يضغط «ابدأ التحدي».',
      parts: [
        { t: 'headline', text: 'اكتب في الشات', sub: 'رسم' },
        { t: 'note', text: 'أرسل كلمة الانضمام في الشات للدخول للقائمة' },
        { t: 'roster', cols: 4, players: [P('aboReem'), P('nourah'), P('mishal'), P('lulu')], caption: 'قائمة المخمّنين' },
        { t: 'cta', id: 'start', text: 'ابدأ التحدي (4)' },
      ],
      click: 'start',
      chat: [
        { player: P('aboReem'), text: 'رسم', kind: 'join' },
        { player: P('mishal'), text: 'رسم', kind: 'join' },
        { player: P('lulu'), text: 'رسم 🎨', kind: 'join' },
      ],
      ms: 5600,
    },
    {
      chip: 'اختيار الكلمة',
      narration: 'الهوست يشوف بطاقات كلمات بثلاث مستويات — سهل ومتوسط وصعب — ويختار واحدة منها.',
      parts: [
        { t: 'headline', text: 'بطاقات الكلمة', sub: 'سهل ١٠٠ · متوسط ١٥٠ · صعب ٢٢٠' },
        { t: 'tiles', cols: 3, id: 'words', items: [
          { id: 'w1', label: '🦁', sub: 'حيوان · سهل' },
          { id: 'w2', label: '🏰', sub: 'مكان · متوسط', state: 'pick', tone: 'gold' },
          { id: 'w3', label: '🎈', sub: 'أشياء · صعب' },
        ] },
        { t: 'cta', id: 'shuffle', text: 'اخلط أخرى', tone: 'dim' },
      ],
      click: 'w2',
      ms: 4800,
      zoom: 1.06,
    },
    {
      chip: 'المرسم',
      narration: 'الرسم على الكانفس ١٩٢٠ × ١٠٨٠ شغال — اكتب تخمينك في أي رسالة، و«ال» ما تفرق بالمطابقة.',
      parts: [
        { t: 'headline', text: 'المطلوب رسمه', sub: '٤ حروف · مكان' },
        { t: 'code', digits: ['•', '•', '•', '•'] },
        { t: 'ring', seconds: 45, total: 60, label: 'الوقت' },
        { t: 'cta', id: 'hint', text: 'كشف تلميح (0/3)', tone: 'blue', hint: 'كل تلميح −٣٠ نقطة' },
      ],
      click: 'hint',
      chat: [
        { player: P('mishal'), text: 'أسد؟', kind: 'answer' },
        { player: P('aboReem'), text: 'الأسد 👌', kind: 'answer' },
        { player: P('nourah'), text: 'وش هذا الرسم 😂', kind: 'say' },
      ],
      ms: 6200,
    },
    {
      chip: 'النتائج',
      narration: 'ثلاثة خانوا وصار القفل: «الكلمة كانت» أسد — كل خان يأخذ نقطته على ترتيب سرعته.',
      parts: [
        { t: 'headline', text: 'الكلمة كانت: أسد', tone: 'gold' },
        { t: 'podium', players: [P('mishal'), P('aboReem'), P('lulu')], points: ['+٧٢ نقطة', '+٤٢', '+٢٥'], caption: 'الأسرع · الثاني · الثالث' },
        { t: 'chips', items: [{ text: '٣ مصيبين', tone: 'green' }, { text: 'تلميح واحد −٣٠', tone: 'ember' }, { text: 'بونص سرعة +٢٤', tone: 'gold' }] },
        { t: 'cta', id: 'r2', text: 'الجولة 2', hint: 'أو «الختام»' },
      ],
      click: 'r2',
      chat: [{ player: P('dani'), text: 'طلعت قدامي بأس ثانية 😭', kind: 'say' }],
      ms: 5400,
      zoom: 1.08,
    },
    {
      chip: 'الختام',
      narration: '«انتهى التحدي» ومنصة «بطل الليلة» — دوس «تحدٍ جديد» أو ارجع لـ «إعدادات جديدة».',
      parts: [
        { t: 'headline', text: 'انتهى التحدي', sub: 'بطل الليلة' },
        { t: 'podium', players: [P('aboReem'), P('mishal'), P('saqr')], points: ['١٨٠ نقطة', '١٤٥', '٩٨'] },
        { t: 'cta', id: 'again', text: 'تحدٍ جديد', hint: 'أو «إعدادات جديدة» / «الرئيسية»' },
      ],
      click: 'again',
      ms: 5200,
    },
  ],
};
