import type { GameTutorial } from '../../components/tutorial/types';
import { P } from '../tutorial_players';

/**
 * الروليت — مرجع لأزرار وشاشات components/Roulette.tsx بالحرف:
 * «دخول الساحة»، «أَدِر الروليت»، حكم «اكتب رقم اللاعب في الشات»، وأرض «آخر نافع في الساحة».
 */
export const roulette: GameTutorial = {
  viewId: 'SPIN_WHEEL',
  title: 'الروليت — موت أم حياة',
  tagline: 'الإبرة تقف على واحد — هو اللي يحدد مين ينزل للمقبرة، والرقم فقط في الشات.',
  emoji: '🎡',
  join: 'chat',
  joinWord: '!دخول',
  rules: [
    'اكتب «!دخول» في الشات — يوصلك رقم يظهر على قطاعك في العجلة.',
    'الإبرة تقف على لاعب واحد فقط — عليه يكتب رقم لاعب ثاني في الشات، الرقم بدون كلمة.',
    'أول ٣ جولات إقصاء دائماً — المحكوم عليه «نزل للمقبرة» بلا رجعة.',
    'بعد الجولات الثلاث الحكم «بقرار من» اللي كتب الرقم: «نزل للمقبرة» أو «رجع للحياة».',
    'اللي يصمد لأخر جولة هو «آخر نافع في الساحة» ويكسب.',
  ],
  scoring: 'آخر نافع في الساحة يفوز ويأخذ ٦٠ نقطة في الماتش أو ٢٠ في الجولة.',
  steps: [
    {
      chip: 'الإعداد',
      narration: 'من شاشة «روليت — موت أم حياة» اضغط «دخول الساحة» وتظهر لوحة التحكم الجانبية.',
      parts: [
        { t: 'kicker', text: 'SPIN WHEEL • SETUP' },
        { t: 'headline', text: 'روليت — موت أم حياة', sub: 'عجلة واحدة، وحكم واحد في كل جولة' },
        { t: 'note', text: 'قبل البداية: «فتح الانضمام» ثم «أَدِر الروليت» — وفي النص زر ذهبي كبير يدير العجلة.' },
        { t: 'cta', id: 'enter', text: 'دخول الساحة' },
      ],
      click: 'enter',
      ms: 5000,
    },
    {
      chip: 'الانضمام',
      narration: 'اكتب «!دخول» في الشات — كل لاعب ياخذ رقم يظهر على قطاعه، والهوست يفتح الانضمام.',
      parts: [
        { t: 'headline', text: 'الانضمام مفتوح', sub: 'اكتب «!دخول» وتوخذ رقمك على العجلة' },
        { t: 'roster', cols: 4, caption: 'قطاعات العجلة', players: [
          P('aboReem', { tag: '#١' }), P('nourah', { tag: '#٢' }), P('mishal', { tag: '#٣' }),
          P('lulu', { tag: '#٤' }), P('saqr', { tag: '#٥' }), P('dani', { tag: '#٦' }),
        ] },
        { t: 'cta', id: 'open', text: 'فتح الانضمام', hint: 'للقفل: «إغلاق الانضمام»' },
      ],
      click: 'open',
      chat: [
        { player: P('turbo'), text: '!دخول', kind: 'join' },
        { player: P('wadha'), text: '!دخول 🎡', kind: 'join' },
        { player: P('nourah'), text: '!دخول', kind: 'join' },
      ],
      ms: 6000,
    },
    {
      chip: 'التدوير',
      narration: 'الهوست يضغط «أَدِر الروليت» — العجلة تدور والإبرة الذهبية تقرر مين تحت الحكم.',
      parts: [
        { t: 'headline', text: 'العجلة تدور…', sub: 'إبرة ذهبية واحدة توقف الدوران' },
        { t: 'wheel', numbers: ['#١', '#٢', '#٣', '#٤', '#٥', '#٦'], active: '#٣', caption: 'أحياء على العجلة' },
        { t: 'chips', items: [{ text: 'الجولة ١', tone: 'gold' }, { text: 'أحياء ٦', tone: 'green' }, { text: 'موتى ٠', tone: 'dim' }] },
        { t: 'cta', id: 'spin', text: 'أَدِر الروليت', tone: 'gold' },
      ],
      click: 'spin',
      ms: 5400,
      zoom: 1.08,
    },
    {
      chip: 'الحكم',
      narration: 'وقفت على #٣؟ لازم تكتب رقم لاعب ثاني في الشات — الرقم فقط بدون كلمة، والوقت ينفد.',
      parts: [
        { t: 'headline', text: 'أنت تحت الحكم', sub: 'اكتب رقم اللاعب في الشات — مثال: ٢', tone: 'red' },
        { t: 'note', text: 'الرقم فقط — بدون كلمة · العدّاد الدائري يصير أحمر تحت ٥ ثوانٍ' },
        { t: 'ring', seconds: 3, total: 12, label: 'ثانية' },
      ],
      at: 'chat',
      chat: [
        { player: P('mishal'), text: '٥', kind: 'answer' },
        { player: P('lulu'), text: 'يا مسكين صقر 😬', kind: 'say' },
      ],
      ms: 6400,
    },
    {
      chip: 'الإقصاء',
      narration: 'الحكم يطلع: «نزل للمقبرة» أو «رجع للحياة» بقرار من اللي حكم — أول ٣ جولات إقصاء دائماً.',
      parts: [
        { t: 'headline', text: 'نزل للمقبرة', sub: 'بقرار من مشعل HX', tone: 'red' },
        { t: 'portrait', player: P('saqr'), caption: 'القطاع #٥' },
        { t: 'tally', rows: [
          { label: 'أحياء', pct: 75, tone: 'green', votes: 5, players: [P('aboReem'), P('nourah'), P('mishal'), P('lulu'), P('dani')] },
          { label: 'موتى', pct: 25, tone: 'red', votes: 1, players: [P('saqr')] },
        ] },
      ],
      at: 'stage',
      ms: 5200,
    },
    {
      chip: 'الختام',
      narration: 'بقي واحد فقط — «آخر نافع في الساحة» يمسح التاج و٦٠ نقطة، و«جولة جديدة» تعيد الروليت.',
      parts: [
        { t: 'headline', text: '👑 آخر نافع في الساحة', sub: 'انتهت الروليت — التاج لرجل واحد', tone: 'gold' },
        { t: 'podium', players: [P('mishal'), P('aboReem'), P('lulu')], points: ['٦٠ نقطة', '٣٥', '٢٠'] },
        { t: 'cta', id: 'again', text: 'جولة جديدة', hint: 'أو «الرئيسية» للخروج' },
      ],
      click: 'again',
      ms: 4800,
    },
  ],
};
