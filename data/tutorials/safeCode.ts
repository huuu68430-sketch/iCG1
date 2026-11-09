import type { GameTutorial } from '../../components/tutorial/types';
import { P } from '../tutorial_players';

/**
 * البنك الآمن — مطابق لـ components/SafeCode.tsx: خزنة بصف دوران وأسطوانة لكل رقم.
 * المتابع ينضم بـ«دخول»، ثم يرسل الرمز كاملاً في الشات ليخترق الخزنة.
 */
export const safeCode: GameTutorial = {
  viewId: 'SAFE_CODE',
  title: 'البنك الآمن',
  tagline: 'خزنة برمز سري — كل رقم تصيب مكانه ينكشف، ومن يكشف آخر رقم يفتحها.',
  emoji: '🔐',
  join: 'chat',
  joinWord: 'دخول',
  rules: [
    'اكتب «دخول» في الشات تدخل الطابور، و«ابدأ!» من الهوست يفتح الهجوم.',
    'أرسل الرمز بعدد الأرقام المضبوط مثل «٤٨٢١» — والأرقام العربية تُقبل.',
    'لكل لاعب محاولة وحدة كل «انتظار بين المحاولات» ثانية، والرمز المكرر يردّ «هذا الرمز جُرّب من قبل».',
    'كل رقم ينكشف في مكانه يعطي صاحبه نقطة، ومن يكشف آخر رقم يفتح الخزنة.',
    'لو «وقت الاختراق» خلّص تنطلق الصفارة ويُنكشف الرمز كله والخزنة مقفلة.',
  ],
  scoring: 'نقطة واحدة لكل رقم يُكشف، و١٦٠ نقطة للمباراة و٤٥ للجولة لآخر واحد يفتح الخزنة.',
  steps: [
    {
      chip: 'الإعداد',
      narration: 'من لوحة الخزنة اضبط عدد أرقام الرمز السري ووقت الاختراق وانتظار بين المحاولات، ثم «بدء الهجوم».',
      parts: [
        { t: 'kicker', text: 'SAFE CODE • SETUP' },
        { t: 'headline', text: 'البنك الآمن', sub: 'إعدادات الخزنة' },
        { t: 'tiles', cols: 3, items: [
          { label: '٤', sub: 'عدد أرقام الرمز السري', state: 'hot' },
          { label: '١٢٠', sub: 'وقت الاختراق', state: 'idle' },
          { label: '٣', sub: 'انتظار بين المحاولات', state: 'idle' },
        ] },
        { t: 'cta', id: 'attack', text: 'بدء الهجوم', hint: 'و«كلمة الانضمام» تضبطها من نفس اللوحة' },
      ],
      click: 'attack',
      ms: 5800,
    },
    {
      chip: 'اللوبي',
      narration: 'الشاشة توريك «أرسل دخول للمشاركة» — اكتبها تدخل الطابور، وما يبدأ إلا بلاعبين على الأقل.',
      parts: [
        { t: 'headline', text: 'في انتظار اللصوص', sub: 'أرسل دخول للمشاركة' },
        { t: 'roster', players: [P('nourah'), P('saqr'), P('lulu'), P('dani')], caption: 'كل واحد يرسل رمز غيره' },
        { t: 'cta', id: 'go', text: 'ابدأ!', hint: '«تراجع» يرجّعك للإعدادات' },
      ],
      click: 'go',
      chat: [
        { player: P('nourah'), text: 'دخول', kind: 'join' },
        { player: P('saqr'), text: 'دخول', kind: 'join' },
        { player: P('dani'), text: 'دخول 🔓', kind: 'join' },
      ],
      ms: 5600,
    },
    {
      chip: 'الخزنة',
      narration: 'الباب يقفل والصف يدور مع كل رمز يصل، وأسطوانة لكل رقم تطلع لما تصيب مكانه.',
      parts: [
        { t: 'headline', text: 'الخزنة مقفلة', sub: 'القرص يدور يمين ويسار مع كل محاولة' },
        { t: 'art', emoji: '🔐', caption: '٤ أسطوانات تنتظر أرقامك', tone: 'gold' },
        { t: 'code', digits: ['٤', '٨', '؟', '؟'], revealed: false },
        { t: 'chips', items: [{ text: 'وجدنا ٢ من ٤', tone: 'gold' }, { text: 'الوقت ١:٥٨', tone: 'cream' }, { text: 'المحاولات ٩', tone: 'dim' }] },
      ],
      at: 'stage',
      ms: 5000,
      zoom: 1.06,
    },
    {
      chip: 'الرموز',
      narration: 'اكتب ٤ أرقام مثل «٤٨٢١» في الشات — الرقم الصح في مكانه ينكشف للجميع، ومحاولة وحدة كل ٣ ثواني.',
      parts: [
        { t: 'bigText', text: 'اكتب ٤ أرقام في الشات لاختراق الخزنة', sub: 'مثال: ٤٨٢١', tone: 'cream' },
        { t: 'bar', pct: 14, label: 'وقت الاختراق', tone: 'red' },
        { t: 'tiles', cols: 3, caption: 'سجل المحاولات', items: [
          { label: '٤٨٢١', sub: 'أبو ريم +١ رقم', state: 'good', tone: 'green' },
          { label: '٤٨١٠', sub: 'صقر الخليج +٢', state: 'pick', tone: 'gold' },
          { label: '٤٨١٠', sub: 'مكرر — هذا الرمز جُرّب من قبل', state: 'bad', tone: 'red' },
        ] },
      ],
      at: 'chat',
      chat: [
        { player: P('aboReem'), text: '٤٨٢١', kind: 'answer' },
        { player: P('saqr'), text: '٤٨١٠', kind: 'answer' },
        { player: P('lulu'), text: '٤٨١٠ 🤦', kind: 'answer' },
      ],
      ms: 6400,
    },
    {
      chip: 'الفتح',
      narration: 'آخر رقم ينفتح وتُفتح الخزنة: ١٦٠ نقطة للمباراة و٤٥ للجولة لصاحب الكشف الأخير.',
      parts: [
        { t: 'headline', text: 'فُتحت الخزنة!', sub: 'كشف آخر رقم بعد ١٤ محاولة في ٥٨ ثانية', tone: 'green' },
        { t: 'portrait', player: P('aboReem'), caption: 'أسرع المخترقين', tone: 'gold' },
        { t: 'code', digits: ['٤', '٨', '٢', '١'], revealed: true },
        { t: 'cta', id: 'again', text: 'العب مرة ثانية', hint: 'رمز جديد ونفس اللاعبين' },
      ],
      click: 'again',
      chat: [{ player: P('nourah'), text: 'قربنا نفكها 😩', kind: 'say' }],
      ms: 5400,
      zoom: 1.08,
    },
    {
      chip: 'الختام',
      narration: 'لو الوقت خلّص قبل الفتح تسمع الصفارة و«انتهى الوقت، الخزنة بقيت مقفلة» مع الرمز كامل.',
      parts: [
        { t: 'headline', text: 'انتهى الوقت، الخزنة بقيت مقفلة', sub: 'الرمز السري كان', tone: 'red' },
        { t: 'code', digits: ['٤', '٨', '٢', '٩'], revealed: true },
        { t: 'note', text: 'الأقرب للاختراق: نورة ٢٢ (٣ أرقام)' },
        { t: 'cta', id: 'settings', text: 'الإعدادات', hint: 'غيّر عدد الأرقام ووقت الاختراق' },
      ],
      click: 'settings',
      ms: 4800,
    },
  ],
};
