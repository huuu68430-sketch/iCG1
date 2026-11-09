import type { GameTutorial, TileItem } from '../../components/tutorial/types';
import { P } from '../tutorial_players';

const WORDS = [
  'أسد', 'جسر', 'مطر', 'كتاب', 'قمر',
  'باب', 'سيف', 'نجمة', 'بحر', 'صحراء',
  'مفتاح', 'ساعة', 'وردة', 'ذئب', 'جبل',
  'نار', 'ظل', 'طريق', 'مدينة', 'قطة',
  'عين', 'رمل', 'فستان', 'سلّم', 'مصباح',
];

/** أحمر ٨، أزرق ٨، محايد ٨، قاتلة ١ */
const RED = [0, 3, 6, 9, 12, 15, 18, 21];
const BLUE = [1, 4, 7, 10, 13, 16, 19, 22];
const DEAD = 24;

const board = (opened: number[] = []): TileItem[] =>
  WORDS.map((w, i) => {
    if (opened.includes(i)) {
      if (i === DEAD) return { label: w, state: 'bad', tone: 'red' };
      return { label: w, state: 'pick', tone: RED.includes(i) ? 'red' : BLUE.includes(i) ? 'blue' : 'dim' };
    }
    if (i === DEAD) return { label: w, state: 'idle' };
    return { label: w, state: 'idle' };
  });

const phoneBoard = (opened: number[] = []): TileItem[] =>
  WORDS.map((w, i) => {
    const base = i === DEAD ? 'dead' : RED.includes(i) ? 'red' : BLUE.includes(i) ? 'blue' : '';
    const picked = opened.includes(i);
    return { label: w, state: picked ? 'pick' : 'idle', tone: (base || 'idle') as TileItem['tone'] };
  });

/**
 * كود نيمز — الجمهور يلعب من الشات، وقائد كل فريق (ليدر) يلعب من جواله.
 * النصوص مطابقة لـ public/codenames.html.
 */
export const codenames: GameTutorial = {
  viewId: 'EMOJI_CODE',
  title: 'كود نيمز',
  tagline: 'فريقان و٢٥ كلمة. الليدر يلمّح من جواله، والباقي يخمّن من الشات.',
  emoji: '🕵️',
  join: 'both',
  joinWord: 'دخول',
  rules: [
    'اكتب «دخول» في الشات للدخول للقائمة، ثم «أحمر» أو «أزرق» لاختيار فريقك.',
    'الهوست يختار ليدر لكل فريق — الليدر فقط يمسح QR ويلعب من جواله.',
    'الليدر يرسل تلميحاً من كلمة واحدة + رقم = عدد الكلمات المقصودة.',
    'الجمهور يكتب رقم البطاقة (١–٢٥) أو اسمها، وأول إجابة صحيحة تُقلب البطاقة لفريقه.',
    'البطاقة السوداء (القاتلة) تنهي الجولة لصالح الفريق الثاني — تجنّبها.',
  ],
  scoring: 'كل بطاقة صحيحة تُحسب لفريقها، والفريق الذي يفتح كلماته كلها أولاً يفوز، وأكثر مصوّب صحيح هو MVP.',
  steps: [
    {
      chip: 'اللوبي',
      narration: 'اللعبة تبدأ بلوبي — المتابع يكتب «دخول» في الشات، ثم يختار فريقه «أحمر» أو «أزرق».',
      parts: [
        { t: 'kicker', text: 'CODENAMES • LOBBY' },
        { t: 'headline', text: 'في انتظار اللاعبين', sub: 'اكتب دخول للانضمام، ثم اسم فريقك' },
        { t: 'chips', items: [{ text: 'كود الغرفة: R7K2', tone: 'gold' }, { text: 'الأحمر ٥', tone: 'red' }, { text: 'الأزرق ٤', tone: 'blue' }] },
        { t: 'roster', players: [P('aboReem', { tag: 'أحمر' }), P('nourah', { tag: 'أزرق' }), P('mishal', { tag: 'أحمر' }), P('lulu', { tag: 'أزرق' }), P('saqr', { tag: 'أحمر' })] },
        { t: 'cta', id: 'next', text: 'التالي: توزيع الفرق' },
      ],
      click: 'next',
      chat: [
        { player: P('dani'), text: 'دخول', kind: 'join' },
        { player: P('aboReem'), text: 'أحمر', kind: 'answer' },
        { player: P('nourah'), text: 'أزرق', kind: 'answer' },
      ],
      ms: 6000,
    },
    {
      chip: 'اختيار الليدر',
      narration: 'الهوست يحدد قائد كل فريق — بالضغط على صورته أو بـ«اختيار عشوائي».',
      parts: [
        { t: 'headline', text: 'اختر ليدر كل فريق', sub: 'الليدر هو الوحيد الذي يلعب من الجوال' },
        { t: 'tiles', cols: 2, items: [
          { label: 'الفريق الأحمر', sub: '٥ لاعبين', tone: 'red', state: 'pick', id: 'redLeader' },
          { label: 'الفريق الأزرق', sub: '٤ لاعبين', tone: 'blue', state: 'idle' },
        ] },
        { t: 'cta', id: 'rand', text: 'اختيار عشوائي', tone: 'ghost' },
      ],
      click: 'rand',
      chat: [{ player: P('turbo'), text: 'خلّني ليدر 🙋', kind: 'say' }],
      ms: 5400,
    },
    {
      chip: 'جوال الليدر',
      narration: 'كل ليدر يمسح الرمز بهاتفه — يدخل بكود فريقه ويصبح الوحيد الذي يرى ألوان البطاقات.',
      parts: [
        { t: 'headline', text: 'كل ليدر يمسح الرمز بهاتفه', sub: 'رابطان: أحمر وأزرق — لا يراهما الجمهور' },
        { t: 'tiles', cols: 2, items: [
          { label: 'رابط الليدر الأحمر', sub: '?r=R7K2&t=red', tone: 'red' },
          { label: 'رابط الليدر الأزرق', sub: '?r=R7K2&t=blue', tone: 'blue' },
        ] },
        { t: 'cta', id: 'go', text: 'ابدأ', hint: 'بعد ما الليدران يفتحان جوالَيهما' },
      ],
      click: 'go',
      phone: {
        kind: 'qr',
        title: 'امسح رمز فريقك',
        sub: 'أنت ليدر الفريق الأحمر',
        code: 'R7K2',
        primary: 'دخول',
        tap: 'primary',
      },
      ms: 6200,
    },
    {
      chip: 'اللوحة',
      narration: '٢٥ بطاقة أمام الجميع. الليدر يكتب تلميحاً من كلمة واحدة ويرسله من جواله.',
      parts: [
        { t: 'headline', text: 'دور الفريق الأحمر', sub: 'كلمة واحدة + رقم = عدد البطاقات المقصودة' },
        { t: 'tiles', cols: 5, items: board(), caption: '٢٥ بطاقة — لا أحد يعرف ألوانها' },
      ],
      at: 'phone',
      phone: {
        kind: 'board',
        title: 'أنت ليدر الفريق أحمر',
        tiles: phoneBoard(),
        cols: 4,
        hint: 'كلمة واحدة',
        primary: 'إرسال التلميح',
        tap: 'primary',
        note: 'التلميح: «حيوان ٢»',
      },
      chat: [{ player: P('mishal'), text: 'جاهزين للتلميح 👂', kind: 'say' }],
      ms: 6400,
    },
    {
      chip: 'التخمين',
      narration: 'الجمهور يكتب رقم البطاقة في الشات — أول مصوّب يفتحها، والبطاقة القاتلة تنهي الجولة.',
      parts: [
        { t: 'headline', text: 'فريقك يخمّن الآن', sub: 'اكتب رقم البطاقة أو اسمها' },
        { t: 'tiles', cols: 5, items: board([0, 9, 14]), caption: 'أحمر: بطاقتان مفتوحتان — والذئب كانت محايدة' },
        { t: 'ring', seconds: 25, label: 'ثانية للدور' },
      ],
      at: 'chat',
      phone: {
        kind: 'board',
        title: 'فريقك يخمّن الآن',
        tiles: phoneBoard([0, 9, 14]),
        cols: 4,
        hint: 'لا تلمس شيئاً — انتظر دورك',
        note: 'الليدر يعتمد الإجابة الصحيحة',
      },
      chat: [
        { player: P('nourah'), text: '١', kind: 'answer' },
        { player: P('aboReem'), text: 'أسد ✓', kind: 'answer' },
        { player: P('lulu'), text: '١٥', kind: 'answer' },
      ],
      ms: 6400,
    },
    {
      chip: 'النهاية',
      narration: 'أول فريق يفتح كل كلماته يفوز — أو تنتهي الجولة بلمس البطاقة القاتلة.',
      parts: [
        { t: 'headline', text: 'فاز الفريق الأزرق', sub: 'فتح كلماته كاملة قبل الأحمر' },
        { t: 'podium', players: [P('nourah', { tag: 'MVP' }), P('lulu'), P('dani')], points: ['+٩ نقاط', '+٦', '+٤'] },
        { t: 'cta', id: 'again', text: 'إعادة اللعبة بنفس اللاعبين' },
      ],
      click: 'again',
      phone: {
        kind: 'win',
        title: 'فزت! 🏆',
        sub: 'فريقك فتح كل البطاقات الزرقاء',
        note: 'نقاط الجولة + MVP للاكثر تصويب',
      },
      chat: [
        { player: P('saqr'), text: 'التلميح كان صعب والله 😅', kind: 'say' },
        { player: P('turbo'), text: 'جولة ثانية', kind: 'say' },
      ],
      ms: 6000,
    },
  ],
};
