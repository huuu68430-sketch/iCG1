import type { GameTutorial } from '../../components/tutorial/types';
import { P } from '../tutorial_players';

/**
 * القنبلة الموقوتة — أزرار ونصوص مطابقة لـ components/TimeBomb.tsx.
 * المتابع يلعب من الشات فقط: «دخول» للانضمام، ورقم لاعب لتمرير القنبلة.
 */
export const timeBomb: GameTutorial = {
  viewId: 'TIME_BOMB',
  title: 'القنبلة الموقوتة',
  tagline: 'القنبلة تنتقل بالرقم في الشات — من تنفجر عنده يطلع، وآخر ناجٍ يكسب.',
  emoji: '💣',
  join: 'chat',
  joinWord: 'دخول',
  rules: [
    'اكتب «دخول» في الشات تدخل القائمة — الهوست يضغط «ابدأ!» ما لم يقل العدد عن لاعبين.',
    'القنبلة تبدأ عند لاعب عشوائي، والفتيل يشتعل ويصير أسرع مع كل ثانية.',
    'الماسك يكتب رقم لاعب ثاني في الشات لتمريرها: «٨» أو «رقم ٨» أو «@لؤلؤة».',
    'من تنفجر عنده يخرج من الجولة، ويكمل الباقون واحد بواحد لآخر لاعب.',
    'التمريرة تنقل القنبلة فوراً وتبدأ فتيل جديد — لا تمسكها وأنت منتظر.',
  ],
  scoring: 'آخر ناجٍ ياخذ الجائزة: ١٢٠ نقطة للمباراة و٣٥ للجولة، والانفجار ما له نقاط.',
  steps: [
    {
      chip: 'الإعداد',
      narration: 'من لوحة المشرف ضبط أكثر وأقل وقت للقنبلة ووقت التمرير، ثم اضغط «بدء المعركة».',
      parts: [
        { t: 'kicker', text: 'TIME BOMB • SETUP' },
        { t: 'headline', text: 'القنبلة الموقوتة', sub: 'إعدادات اللعبة' },
        { t: 'tiles', cols: 3, items: [
          { label: '٢٠', sub: 'الحد الأقصى للاعبين', state: 'idle' },
          { label: '٣٠', sub: 'أكثر وقت للقنبلة', state: 'hot' },
          { label: '٨', sub: 'وقت التمرير (ثواني)', state: 'idle' },
        ] },
        { t: 'cta', id: 'fight', text: 'بدء المعركة' },
      ],
      click: 'fight',
      ms: 5400,
    },
    {
      chip: 'اللوبي',
      narration: 'الشاشة تُظهر «أرسل دخول للمشاركة» — اكتبها في الشات، وأول لاعبين يفتحان البداية.',
      parts: [
        { t: 'headline', text: 'في انتظار اللاعبين', sub: 'أرسل | دخول | للمشاركة' },
        { t: 'roster', players: [P('aboReem'), P('lulu'), P('saqr'), P('dani')], caption: 'رقم كل لاعب يبان فوق اسمه' },
        { t: 'cta', id: 'go', text: 'ابدأ!', hint: '«تراجع» يرجّعك للإعدادات' },
      ],
      click: 'go',
      chat: [
        { player: P('aboReem'), text: 'دخول', kind: 'join' },
        { player: P('lulu'), text: 'دخول', kind: 'join' },
        { player: P('dani'), text: 'دخول 🙋', kind: 'join' },
      ],
      ms: 5600,
    },
    {
      chip: 'الفتيل',
      narration: 'القنبلة تنزل عند لاعب واحد — الكرة تنبض وتهتز، والفتيل يطلع أسرع كل ثانية.',
      parts: [
        { t: 'headline', text: 'القنبلة عند أبو ريم', sub: 'رقمه ٥' },
        { t: 'art', emoji: '💣', caption: 'تنبض أسرع وكل ما نقص الوقت', tone: 'ember' },
        { t: 'bar', pct: 72, label: 'الفتيل', tone: 'gold' },
        { t: 'chips', items: [{ text: 'الباقون: ٤', tone: 'cream' }, { text: 'التمرير مفتوح', tone: 'green' }] },
      ],
      at: 'stage',
      ms: 4800,
      zoom: 1.06,
    },
    {
      chip: 'التمرير',
      narration: 'اكتب رقم لاعب ثاني في الشات مثال «٨» أو «@لؤلؤة» — القنبلة تنتقل له حالاً.',
      parts: [
        { t: 'bigText', text: 'اكتب رقم اللاعب لتمرير القنبلة', sub: 'مثال: ٨ · رقم ٨ · @لؤلؤة', tone: 'cream' },
        { t: 'note', text: 'أبو ريم مرّر القنبلة إلى لؤلؤة (رقم ٤)' },
        { t: 'chips', items: [{ text: 'فتيل جديد لؤلؤة', tone: 'ember' }, { text: 'الباقون: ٤', tone: 'cream' }] },
      ],
      at: 'chat',
      chat: [
        { player: P('aboReem'), text: '٤', kind: 'answer' },
        { player: P('saqr'), text: 'رقم ٧', kind: 'answer' },
        { player: P('nourah'), text: '@دانيال', kind: 'answer' },
      ],
      ms: 6400,
    },
    {
      chip: 'الانفجار',
      narration: 'الوقت خلص وهو تمسكها: «انفجرت عند لؤلؤة!» وتطلع — الباقون يكملون الجولة.',
      parts: [
        { t: 'headline', text: 'انفجرت عند لؤلؤة!', sub: 'رقم ٤ خرج من اللعبة', tone: 'red' },
        { t: 'bar', pct: 0, label: 'الفتيل خلص', tone: 'red' },
        { t: 'chips', items: [{ text: 'الباقون: ٣', tone: 'cream' }] },
        { t: 'cta', id: 'nextRound', text: 'الجولة التالية' },
      ],
      click: 'nextRound',
      chat: [{ player: P('dani'), text: 'قربنا منها 😬', kind: 'say' }],
      ms: 5200,
      zoom: 1.08,
    },
    {
      chip: 'الختام',
      narration: 'آخر ناجٍ ياخذ الكأس و١٢٠ نقطة للمباراة أو ٣٥ للجولة، ثم «العب مرة ثانية».',
      parts: [
        { t: 'headline', text: 'انتهت المعركة', sub: 'الفائز هو آخر لاعب باقي' },
        { t: 'portrait', player: P('aboReem', { tag: 'رقم ٥' }), caption: 'الفائز', tone: 'gold' },
        { t: 'podium', players: [P('aboReem'), P('saqr'), P('nourah')], points: ['١٢٠ نقطة', '٣٥', '١٥'] },
        { t: 'cta', id: 'again', text: 'العب مرة ثانية', hint: 'أو «الإعدادات» لتغيير الأوقات' },
      ],
      click: 'again',
      chat: [{ player: P('saqr'), text: 'حظ أوفر الجاي 🫰', kind: 'say' }],
      ms: 5600,
    },
  ],
};
