import type { GameTutorial } from '../../components/tutorial/types';
import { P } from '../tutorial_players';

/**
 * حروف مع منصور — يطابق شاشات components/LetterHexagonGame.tsx
 * وخرائط العوالم في data/letter_game_data.ts بأزرارها الحقيقية.
 */
export const letterGame: GameTutorial = {
  viewId: 'LETTER_GAME',
  title: 'حروف مع منصور',
  tagline: 'فريقان على خلية مسدسة من الحروف — ارن الجرس، اكتب كلمة تبدأ بالحرف، واربط الساحة.',
  emoji: '🔤',
  join: 'chat',
  joinWord: 'دخول',
  rules: [
    'انضم بكتابة كلمة الدخول + اسم فريقك: «دخول الذهبي» أو «دخول النحاسي» — والفريقان يتعبّون من الشات.',
    'الجرس أولوية على أي خلية مفتوحة: اكتب «جرس» لتاخذ حق الجواب، والجرس مرة واحدة لكل فريق في الدور.',
    'الجواب كلمة تبدأ بالحرف المعروض — «ال» والتشكيل ما يفرقون، وإجابتين غلط أو نهاية الوقت = خسارة الدور.',
    'الحروف تدخل الساحة بـ «تصويت الحروف» — ومن يرن أولاً يجاوب على طول، والثاني بعده بلا جرس.',
    'كل خلية تُفتح لفريقك نقطتين للجولة، والفوز بالمرحلة يرفعك لعالم أبعد.',
  ],
  scoring: 'كل خلية تُفتح لفريقك نقطتان للجولة، والفوز بالمرحلة يرفعك لعالم أبعد — وحق الفوز ١٦٠ للمباراة و٤٥ للجولة.',
  steps: [
    {
      chip: 'الإعدادات',
      narration: 'من «إعدادات اللعبة» ظبط كلمة الدخول وأسماء الفريقين والصعوبة ومدة الإجابة، ثم «اختر مرحلتك».',
      parts: [
        { t: 'kicker', text: 'LETTER GAME • SETUP' },
        { t: 'headline', text: 'إعدادات اللعبة', sub: 'تجهيز ساحة المعركة' },
        { t: 'tiles', cols: 4, items: [
          { label: 'دخول', sub: 'كلمة دخول المشاركين', state: 'hot' },
          { label: 'ذهبي / نحاسي', sub: 'أسماء الفريقين' },
          { label: 'عادي', sub: 'أو «صعب جداً»' },
          { label: '١٥ ث', sub: 'مدة الإجابة بعد الجرس' },
        ] },
        { t: 'cta', id: 'pick', text: 'اختر مرحلتك' },
      ],
      click: 'pick',
      ms: 5400,
    },
    {
      chip: 'الخريطة',
      narration: '«🗺️ خريطة العوالم» فيها ١٠٠ مرحلة على ٥ عوالم من عالم المبتدئين لعالم الأساطير — دوس على رقم مرحلتك.',
      parts: [
        { t: 'headline', text: '🗺️ خريطة العوالم', sub: '٥ عوالم · ١٠٠ مرحلة' },
        { t: 'tiles', cols: 4, id: 'levels', items: [
          { id: 'l5', label: '٥', sub: 'عالم المبتدئين' },
          { id: 'l7', label: '٧', sub: 'عالم المبتدئين', state: 'pick', tone: 'gold' },
          { id: 'l22', label: '٢٢', sub: 'عالم المتمرن' },
          { id: 'l98', label: '٩٨', sub: 'عالم الأساطير', tone: 'ember' },
        ] },
        { t: 'note', text: 'دوس المرحلة وتنتقل للوبي مباشرة', tone: 'dim' },
      ],
      click: 'l7',
      ms: 4800,
      zoom: 1.06,
    },
    {
      chip: 'اللوبي',
      narration: 'اللوبي مفتوح للانضمام: اكتب «دخول» + اسم فريقك، والزر يشتغل عند «لاعبان على الأقل».',
      parts: [
        { t: 'headline', text: 'مفتوح للانضمام', sub: 'أكتب [ دخول ] + اسم الفريق للدخول!' },
        { t: 'roster', cols: 4, caption: 'اللاعبون', players: [
          P('aboReem', { tag: '🟡 ذهبي' }), P('nourah', { tag: '🟡 ذهبي' }),
          P('mishal', { tag: '🟠 نحاسي' }), P('lulu', { tag: '🟠 نحاسي' }),
        ] },
        { t: 'cta', id: 'start', text: 'بـدء الـتـحـدي' },
      ],
      click: 'start',
      chat: [
        { player: P('aboReem'), text: 'دخول الذهبي', kind: 'join' },
        { player: P('nourah'), text: 'دخول الذهبي 🟡', kind: 'join' },
        { player: P('mishal'), text: 'دخول النحاسي', kind: 'join' },
      ],
      ms: 5600,
    },
    {
      chip: 'تصويت الحروف',
      narration: 'الحروف تُختار بالتصويت: دوس «بدء جمع الأصوات» وأكتب حرفك في الشات، وأعلى حرف يطلع لخلية من الـ٢٨.',
      parts: [
        { t: 'headline', text: 'تصويت الحروف' },
        { t: 'tally', caption: 'أكتب أي حرف في الشات للتصويت!', rows: [
          { label: 'ب', pct: 44, tone: 'gold', votes: 4, players: [P('aboReem'), P('nourah')] },
          { label: 'ت', pct: 33, votes: 3, players: [P('mishal'), P('lulu')] },
          { label: 'ج', pct: 23, tone: 'dim', votes: 2, players: [P('dani')] },
        ] },
        { t: 'cta', id: 'go', text: 'بدء جمع الأصوات' },
      ],
      click: 'go',
      chat: [
        { player: P('lulu'), text: 'ب', kind: 'answer' },
        { player: P('mishal'), text: 'ت', kind: 'answer' },
        { player: P('turbo'), text: 'يلا ب أسرع 🙏', kind: 'say' },
      ],
      ms: 5400,
    },
    {
      chip: 'الجرس',
      narration: 'الخلية عرضت حرفًا — أسرع واحد يكتب «جرس» ياخذ حق الجواب، والفريق اللي رن يقولون له «جاوبوا على طول».',
      parts: [
        { t: 'headline', text: 'اكتب كلمة تبدأ بحرف ب', tone: 'gold', sub: 'الذهبي يربط القمة بالأسفل' },
        { t: 'tiles', cols: 4, id: 'hex', caption: 'من الخلية المسدسة الـ٢٨', items: [
          { label: 'ب', sub: 'خلية الدور', state: 'hot', tone: 'gold' },
          { label: 'ت', state: 'good', tone: 'green' },
          { label: 'ج', state: 'idle' },
          { label: 'ح', state: 'dim' },
        ] },
        { t: 'note', text: 'الفريق الذهبي 🟡 — جاوبوا على طول', tone: 'gold' },
      ],
      at: 'chat',
      chat: [
        { player: P('aboReem'), text: 'جرس 🔔', kind: 'answer' },
        { player: P('saqr'), text: 'كان قبلي 😤', kind: 'say' },
        { player: P('nourah'), text: 'بحر', kind: 'answer' },
      ],
      ms: 6200,
    },
    {
      chip: 'الختام',
      narration: '«ربطوا القمة بالأسفل وتوّجوا بالمرحلة» — و«المرحلة التالية» ترفع الفريق الفائز لعالم أبعد.',
      parts: [
        { t: 'headline', text: 'ربطوا القمة بالأسفل وتوّجوا بالمرحلة', sub: 'أو: قطعوا الساحة يميناً إلى شمالاً وحسموا الجولة', tone: 'gold' },
        { t: 'podium', players: [P('aboReem'), P('nourah'), P('mishal')], points: ['١٦٠ نقطة', '١٢٥', '٩٠'] },
        { t: 'cta', id: 'next', text: 'المرحلة التالية', hint: 'أو «الخريطة» / «الرئيسية»' },
      ],
      click: 'next',
      chat: [{ player: P('wadha'), text: 'حان دور النحاسي 💪', kind: 'say' }],
      ms: 5200,
    },
  ],
};
