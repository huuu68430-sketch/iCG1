import type { GameTutorial } from '../../components/tutorial/types';
import { P } from '../tutorial_players';

/**
 * تحدي الأعلام — مرجع لأزرار وشاشات components/FlagQuiz.tsx بالحرف:
 * «ابـدأ الـلـعـب» و«إنـهـاء الـجـولـة» و«تـخـطـي الـعـلـم» و«تـصـفـيـر» ولوحة «إعدادات التحدي».
 */
export const flagQuiz: GameTutorial = {
  viewId: 'FLAG_QUIZ',
  title: 'تحدي الأعلام',
  tagline: 'علم يطلع على الشاشة — من يسبق ويكتب اسم دولته في الشات يكسب الجولة.',
  emoji: '🚩',
  join: 'chat',
  rules: [
    'مافي كلمة دخول — أي أحد يكتب اسم الدولة في الشات يكون في السباق تلقائياً.',
    'المطابقة ذكية: يكفي اسم الدولة يكون داخل رسالتك ويحسب صح.',
    'أسرع رسالة صحيحة تمسك الجولة — البطاقة الخضراء تعرض الفائز و«Answer:» الاسم.',
    'المؤقت ٣٠ ثانية ويصير أحمر تحت العشر — ولو خلص الوقت تطلع «Time Up!».',
    'من «إعدادات التحدي» تتحكم بالمستوى و«التالي تلقائياً» و«تشويش الصورة» و«مؤقت (30ث)».',
  ],
  scoring: 'أسرع إجابة صحيحة تمسك الجولة — الفائز ١١٠ نقطة في الماتش أو ٣٥ في الجولة.',
  steps: [
    {
      chip: 'الإعداد',
      narration: 'من «إعدادات التحدي» اختر المستوى وفعّل «تشويش الصورة»، ثم اضغط «ابـدأ الـلـعـب».',
      parts: [
        { t: 'kicker', text: 'FLAG QUIZ • SETUP' },
        { t: 'headline', text: 'تحدي الأعلام', sub: 'iABS World Quiz' },
        { t: 'tiles', cols: 3, items: [
          { label: 'سـهـل', sub: 'أعلام معروفة', state: 'idle' },
          { label: 'مـتوسـط', sub: 'أعلام خادعة', state: 'hot' },
          { label: 'صـعـب', sub: 'أعلام نادرة', state: 'idle' },
        ] },
        { t: 'cta', id: 'start', text: 'ابـدأ الـلـعـب', hint: 'لوحة «إعدادات التحدي»: «التالي تلقائياً» · «تشويش الصورة» · «مؤقت (30ث)»' },
      ],
      click: 'start',
      ms: 5600,
    },
    {
      chip: 'العلم',
      narration: 'يطلع علم في بطاقة مؤطرة بذهبي على خلفية بنية داكنة — لا دخول مطلوب، بس فتّح عيونك.',
      parts: [
        { t: 'headline', text: 'شوّه؟ ولا واضح؟', sub: 'لو فعّلته «تشويش الصورة» يطلع العلم ضبابي' },
        { t: 'art', emoji: '🇸🇦', caption: 'علم الجولة — في بطاقة ٤٢٠×٢٦٠', blur: 8 },
        { t: 'chips', items: [{ text: 'مـتوسـط', tone: 'gold' }, { text: '٣٠ ثانية', tone: 'blue' }] },
      ],
      at: 'stage',
      ms: 4800,
    },
    {
      chip: 'الاسم',
      narration: 'لحظة المسابقة: اكتب اسم الدولة في الشات — المطابقة ذكية، يكفي اسمها يكون جوه رسالتك.',
      parts: [
        { t: 'bigText', text: 'اكتب اسم الدولة في الشات', tone: 'cream' },
        { t: 'ring', seconds: 7, total: 30, label: 'ثانية' },
        { t: 'note', text: 'المؤقت يصير أحمر تحت ١٠ ثوانٍ — والتأخير يعني «Time Up!»' },
      ],
      at: 'chat',
      chat: [
        { player: P('nourah'), text: 'كوريا الجنوبية؟', kind: 'answer' },
        { player: P('aboReem'), text: 'السعودية 🇸🇦', kind: 'answer' },
        { player: P('mishal'), text: 'الأرجح الأرجنتين', kind: 'answer' },
      ],
      ms: 6400,
    },
    {
      chip: 'الفائز',
      narration: 'بطاقة خضراء تعلن «Round Winner»: أسرع إجابة صح، وبعدها بأربع ثوانٍ ينتقل تلقائياً للعلم التالي.',
      parts: [
        { t: 'headline', text: 'Round Winner', sub: 'إطار أخضر · أسرع رسالة صحيحة تمسك الجولة', tone: 'green' },
        { t: 'portrait', player: P('aboReem'), caption: 'Answer: السعودية', tone: 'green' },
        { t: 'chips', items: [{ text: '+٣٥ نقطة الجولة', tone: 'gold' }, { text: 'التالي تلقائياً بعد ٤ ثوانٍ', tone: 'blue' }] },
      ],
      at: 'stage',
      chat: [{ player: P('lulu'), text: 'حظ أبيض 🙈', kind: 'say' }],
      ms: 5200,
    },
    {
      chip: 'التحكم',
      narration: 'الهوست يتحكم بالعرض: «تـخـطـي الـعـلـم» لو استصعب، و«إنـهـاء الـجـولـة» للكشف، و«تـصـفـيـر» للبداية من جديد.',
      parts: [
        { t: 'headline', text: 'إعدادات التحدي', sub: 'الأزرار نفسها اللي في الشريط الجانبي' },
        { t: 'tiles', cols: 2, items: [
          { label: 'إنـهـاء الـجـولـة', sub: 'كشف الإجابة فوراً', state: 'hot' },
          { label: 'تـخـطـي الـعـلـم', sub: 'للعلم اللي عيّطكم', state: 'idle' },
          { label: 'تـصـفـيـر', sub: 'الرجوع لنقطة الصفر', state: 'dim' },
          { label: 'مؤقت (30ث)', sub: 'تشغيل · إيقاف', state: 'idle' },
        ] },
        { t: 'cta', id: 'skip', text: 'تـخـطـي الـعـلـم', tone: 'ember' },
      ],
      click: 'skip',
      ms: 5000,
    },
    {
      chip: 'الختام',
      narration: 'بعد كل الأعلام تطلع منصة الفائزين — بطل الماتش يمسح ١١٠ نقطة وأبطال الجولات ٣٥.',
      parts: [
        { t: 'headline', text: 'انتهى التحدي', sub: 'أسرع العارفين بالخريطة' },
        { t: 'podium', players: [P('aboReem'), P('nourah'), P('turbo')], points: ['١١٠ نقطة', '٨٥', '٦٠'] },
        { t: 'chips', items: [{ text: '👑 بطل الماتش ١١٠', tone: 'gold' }, { text: 'بطل الجولة ٣٥', tone: 'cream' }] },
      ],
      at: 'stage',
      ms: 4600,
    },
  ],
};
