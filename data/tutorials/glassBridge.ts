import type { GameTutorial } from '../../components/tutorial/types';
import { P } from '../tutorial_players';

/**
 * جسر الزجاج — نفس مراحل وأزرار components/GlassBridgeV2.tsx بالحرف:
 * التصويت على اللوحين، الاستطلاع، ومضاعفات خطوات الجسر.
 */
export const glassBridge: GameTutorial = {
  viewId: 'GLASS_BRIDGE_V2',
  title: 'جسر الزجاج',
  tagline: 'نصف اللوحين آمن في كل خطوة — صوّت بذكاء، وعبر قبل ما تخلص قلوبك.',
  emoji: '🌉',
  join: 'chat',
  joinWord: 'عبور',
  rules: [
    'اكتب «عبور» في الشات للانضمام، ثم صوّت لكل خطوة بـ «يسار» أو «يمين» — وحتى ١ و٢ تُقبل.',
    'ما تصوّت؟ يعتبر سقوط مثل اللوح الغلط: كل خطأ ياكل قلب، وأول ما القلوب تصير صفر تطلع من الجسر.',
    '«استطلاع 50/50» يكشف للهوست اللوح الآمن سرًا من البث — بس نقاط تلك الخطوة تنقسم على اثنين.',
    'مضاعف النقاط يزيد ٠٫١٥ مع كل خطوة، والخطوة الأخيرة تساوي ×٢.',
    '٣ عبورات صحيحة ورا بعض = مكافأة ×١٫٥ — والنار تشتعل.',
  ],
  scoring: 'نقاط الخطوة = نقاط الأساس × (١ + ٠٫١٥ × رقم الخطوة) وتنقسم على اثنين مع الاستطلاع، وآخر خطوة ×٢، وسلسلة ٣ صح = ×١٫٥ — وحق الفوز ٢٢٠ للمباراة و٥٠ للجولة.',
  steps: [
    {
      chip: 'التحضير',
      narration: 'ظبط القلوب وعدد الخطوات ووقت التصويت، ودوس «افتح الجسر» يفتح اللوبي.',
      parts: [
        { t: 'kicker', text: 'GLASS BRIDGE V2 • SETUP' },
        { t: 'headline', text: 'تجهيز الجسر', sub: 'كل شيء يُظبط قبل أول عبور' },
        { t: 'tiles', cols: 4, items: [
          { label: '٣', sub: 'قلوب', state: 'hot' },
          { label: '٦', sub: 'خطوات' },
          { label: '١٠ ث', sub: 'وقت التصويت' },
          { label: '٥٠', sub: 'نقطة لكل خطوة', tone: 'gold' },
        ] },
        { t: 'cta', id: 'open', text: 'افتح الجسر' },
      ],
      click: 'open',
      ms: 5200,
    },
    {
      chip: 'اللوبي',
      narration: '«بانتظار العابرين» — اكتب «عبور» في الشات تدخل القائمة، ثم الهوست يضغط «ابدأ العبور».',
      parts: [
        { t: 'headline', text: 'بانتظار العابرين', sub: 'اكتبوا كلمة الانضمام في الشات' },
        { t: 'roster', cols: 4, players: [P('aboReem'), P('nourah'), P('saqr'), P('turbo')], caption: 'العابرون' },
        { t: 'cta', id: 'start', text: 'ابدأ العبور (4)' },
      ],
      click: 'start',
      chat: [
        { player: P('aboReem'), text: 'عبور', kind: 'join' },
        { player: P('nourah'), text: 'عبور', kind: 'join' },
        { player: P('saqr'), text: 'عبور 🌉', kind: 'join' },
      ],
      ms: 5600,
    },
    {
      chip: 'التصويت',
      narration: 'لكل خطوة صوّت «يسار» أو «يمين» قبل لا يخلص عدّ «الثانية» — والاستطلاع يحميك بنصف النقاط.',
      parts: [
        { t: 'tiles', cols: 2, id: 'panes', caption: 'الخطوة ٣ — مضاعف ×١٫٣', items: [
          { id: 'left', label: 'يسار', sub: '٧ أصوات', state: 'hot', tone: 'blue', players: [P('aboReem'), P('mishal'), P('lulu')] },
          { id: 'right', label: 'يمين', sub: '٥ أصوات', players: [P('nourah'), P('saqr')] },
        ] },
        { t: 'ring', seconds: 8, total: 12, label: 'ثانية' },
        { t: 'cta', id: 'hint', text: 'استطلاع 50/50', tone: 'blue', hint: 'نقاط الخطوة تنقسم على اثنين' },
      ],
      click: 'hint',
      chat: [
        { player: P('mishal'), text: 'يسار', kind: 'answer' },
        { player: P('lulu'), text: 'يمين', kind: 'answer' },
        { player: P('dani'), text: 'ولا مرة صدّقت اللوحين 😅', kind: 'say' },
      ],
      ms: 6000,
    },
    {
      chip: 'الكشف',
      narration: 'انكشف اللوح: اليمين آمن — اللي اختار اليسار فقد قلب، وبلا تصويت يعتبر سقوط مثله.',
      parts: [
        { t: 'headline', text: 'اليمين آمن', tone: 'green' },
        { t: 'tiles', cols: 6, caption: 'خريطة الجسر', items: [
          { label: '١', sub: '×١', state: 'good' },
          { label: '٢', sub: '×١٫١٥', state: 'good' },
          { label: '٣', sub: '×١٫٣', state: 'bad', tone: 'red' },
          { label: '٤', sub: '×١٫٤٥', state: 'hot' },
          { label: '٥', sub: '×١٫٦' },
          { label: '٦', sub: '×٢', tone: 'gold' },
        ] },
        { t: 'chips', items: [{ text: '٩ على الجسر', tone: 'green' }, { text: '٣ في الهاوية', tone: 'ember' }, { text: 'سلسلة ×١٫٥', tone: 'gold' }] },
        { t: 'note', text: 'القلوب صفر = خارج الجسر — والباقون يواصلون للتصويت الجاي', tone: 'dim' },
      ],
      at: 'stage',
      chat: [{ player: P('saqr'), text: 'طحت؟! 😱', kind: 'say' }],
      ms: 5400,
      zoom: 1.08,
    },
    {
      chip: 'الخطوة الأخيرة',
      narration: 'آخر لوحين على الجسر ومضاعفهم ×٢ — صوّت أخير، والهوست يمشي بـ «الخطوة التالية».',
      parts: [
        { t: 'headline', text: '×٢ على آخر خطوة', sub: 'اللوح اللي يخلصك' },
        { t: 'tally', caption: 'تصويت الخطوة ٦', rows: [
          { label: 'يسار', pct: 44, tone: 'blue', votes: 4, players: [P('turbo'), P('dani')] },
          { label: 'يمين', pct: 56, tone: 'green', votes: 5, players: [P('aboReem'), P('lulu')] },
        ] },
        { t: 'ring', seconds: 4, total: 12, label: 'ثانية' },
        { t: 'cta', id: 'next', text: 'الخطوة التالية', tone: 'gold' },
      ],
      click: 'next',
      chat: [{ player: P('turbo'), text: 'يسار 🙏', kind: 'answer' }],
      ms: 5800,
    },
    {
      chip: 'الختام',
      narration: 'بطاقة الختام «عبروا الجسر!» أو «الجميع سقطوا» — و«جسر جديد بنفس العابرين» يعيد الجولة.',
      parts: [
        { t: 'headline', text: 'عبروا الجسر!', sub: 'بطاقات النهاية', tone: 'green' },
        { t: 'podium', players: [P('lulu'), P('aboReem'), P('mishal')], points: ['٢١٠ نقطة', '١٨٥', '١٤٠'] },
        { t: 'cta', id: 'again', text: 'جسر جديد بنفس العابرين', hint: 'أو «إعدادات جديدة» / «الرئيسية»' },
      ],
      click: 'again',
      chat: [{ player: P('nourah'), text: 'اخيراً عبرت 😮‍💨', kind: 'say' }],
      ms: 5200,
    },
  ],
};
