import type { GameTutorial } from '../../components/tutorial/types';
import { P } from '../tutorial_players';

/**
 * المافيا — لعبة هاتف بالكامل: الهوست يدير، والمتابع يلعب من جواله على الرابط المختصر.
 * الأزرار والنصوص منسوخة حرفياً من public/mafia.html وشاشة المسرح.
 */
export const mafia: GameTutorial = {
  viewId: 'MAHMAH_GAME',
  title: 'المافيا',
  tagline: 'قرية فيها مافيا مخفية. اللي على المسرح يدير، واللي في الجوال يقرر.',
  emoji: '🎭',
  join: 'phone',
  rules: [
    'الهوست يفتح لوبي ويطلع له كود غرفة من ٦ رموز + رمز QR — المتابع يمسحه أو يفتح الرابط المختصر /m=الكود.',
    'كل لاعب ياخذ دوره سراً على جواله: مواطن، مافيا، دكتور، شايب، محقق، أو الجوكر.',
    'الليل: المافيا تختار ضحية، الدكتور يحمي واحد، الشايب يسكّت أو يحقق، المحقق يكشف دوراً.',
    'النهار: نقاش مفتوح ثم تصويت على من تظنه مافيا، والأغلبية تُقصي صاحب أكثر الأصوات.',
    'المافيا تفوز إذا تساوى عددها مع المواطنين أو تجاوزهم، والمواطنون يفوزون بقتل كل المافيا.',
  ],
  scoring: 'الفوز للفريق كامل — كل الأحياء من الفريق الفائز يأخذون نقاط المباراة في لوحة الصدارة.',
  steps: [
    {
      chip: 'اللوبي',
      narration: 'افتح المافيا من الموقع — كود الغرفة يظهر على المسرح مع QR، والمتابعون يدخلون بهواتفهم.',
      parts: [
        { t: 'kicker', text: 'MAHMAH • LOBBY' },
        { t: 'headline', text: 'انضموا للعبة المافيا', sub: 'الكود يظهر على المسرح — والمتابع يمسح QR من جواله' },
        { t: 'chips', items: [{ text: 'كود الغرفة: K7QX2M', tone: 'gold' }, { text: 'اللاعبون ٦ / ١٢' }, { text: 'المرحلة: اللوبي', tone: 'green' }] },
        {
          t: 'roster',
          id: 'roster',
          players: [P('aboReem', { tag: 'داخل' }), P('nourah', { tag: 'داخل' }), P('mishal', { tag: 'داخل' }), P('lulu'), P('saqr'), P('dani')],
          caption: 'أسماء من دخلوا برابط الغرفة',
        },
        { t: 'cta', id: 'copy', text: 'نسخ رابط الدخول', hint: 'الرابط المختصر: /m=K7QX2M' },
      ],
      click: 'copy',
      phone: {
        kind: 'boot',
        title: 'أنت داخل اللعبة!',
        sub: 'انتظر حتى يبدأ المدير التوزيع',
        code: 'K7QX2M',
        players: [P('aboReem'), P('nourah'), P('mishal'), P('lulu'), P('saqr'), P('dani')],
        hint: '٦ لاعبين',
        primary: '📖 مشاهدة طريقة اللعب',
      },
      chat: [{ player: P('aboReem'), text: 'دخلت من الجوال ✅', kind: 'say' }],
      ms: 6200,
    },
    {
      chip: 'توزيع الأدوار',
      narration: 'اضغط «ابدأ اللعبة ووزّع الأدوار» — البطاقات تُخلط، وكل جوال يفتح بطاقته سراً.',
      parts: [
        { t: 'headline', text: 'توزيع الأدوار', sub: 'البطاقات تُخلط الآن — لا أحد يرى دور غيره' },
        { t: 'tiles', cols: 3, items: [
          { label: '🛡️ مواطن', sub: '٤ بطاقات', state: 'idle' },
          { label: '🎭 مافيا', sub: '٢ بطاقة', state: 'hot' },
          { label: '⚕️ دكتور', sub: '١', state: 'idle' },
          { label: '🧔 شايب', sub: '١', state: 'idle' },
          { label: '🔎 محقق', sub: '١', state: 'idle' },
          { label: '🃏 جوكر', sub: '١', state: 'dim' },
        ] },
        { t: 'cta', id: 'deal', text: 'ابدأ اللعبة ووزّع الأدوار' },
      ],
      click: 'deal',
      phone: {
        kind: 'shuffle',
        title: 'تُخلط البطاقات…',
        sub: 'استعد لدورك',
      },
      chat: [{ player: P('nourah'), text: 'وش طلع لكم؟ 👀', kind: 'say' }],
      ms: 5600,
    },
    {
      chip: 'بطاقتي',
      narration: 'في جوال المتابع: «اكشف بطاقتك» — يقرأ دوره بضغطة، ثم يضغط «فهمت» ويغلق.',
      parts: [
        { t: 'headline', text: 'اكتشفوا أدواركم', sub: 'افتحوا هواتفكم وانظروا إلى بطاقتكم سراً' },
        { t: 'portrait', player: P('saqr', { tag: 'دورك' }), caption: 'بطاقة واحدة لكل جوال — لا يريها لأحد' },
        { t: 'note', text: 'لو الجوكر طلع معك: هدفك تُطرد بالتصويت لتفوز لوحدك.' },
        { t: 'cta', id: 'reveal', text: 'اكشف بطاقتك', tone: 'ghost' },
      ],
      click: 'reveal',
      phone: {
        kind: 'role',
        title: 'دورك سري… لا تُره لأحد!',
        role: { name: 'مافيا', team: 'mafia', desc: 'اتفق مع بقية المافيا على ضحية الليلة. لا تكشف نفسك بالنهار.' },
        primary: 'فهمت ✓',
        tap: 'primary',
      },
      ms: 5600,
      zoom: 1.1,
    },
    {
      chip: 'الليل',
      narration: 'الليل يبدأ بالترتيب: المافيا تقرر، الدكتور يحمي، الشايب يسكّت أو يحقق، والمحقق يكشف.',
      parts: [
        { t: 'headline', text: 'حلّ الليل — أغمضوا أعينكم', tone: 'gold' },
        { t: 'tiles', cols: 4, items: [
          { label: '🎭 المافيا تقرر', state: 'pick' },
          { label: '⚕️ الدكتور', sub: 'من يحمي؟' },
          { label: '🧔 الشايب', sub: 'إسكات / تحقيق' },
          { label: '🔎 المحقق', sub: 'يكشف دوراً' },
        ] },
        { t: 'chips', items: [{ text: 'تخطي المرحلة', tone: 'dim' }, { text: 'إيقاف مؤقت', tone: 'dim' }] },
      ],
      at: 'phone',
      phone: {
        kind: 'night',
        title: 'غرفة المافيا',
        sub: 'اتفقوا على الضحية',
        players: [P('saqr', { tag: 'مافيا' }), P('lulu', { tag: 'مافيا' })],
        tiles: [
          { label: 'أبو ريم', state: 'idle' },
          { label: 'نورة ٢٢', state: 'pick' },
          { label: 'مشعل HX', state: 'idle' },
        ],
        cols: 3,
        tap: 1,
        primary: 'اختر الضحية',
        hint: 'نورة ٢٢ هي الهدف لهذه الليلة',
      },
      chat: [
        { player: P('mishal'), text: 'الليل طويل… 🌙', kind: 'say' },
        { player: P('dani'), text: 'مين محمي اليوم؟', kind: 'say' },
      ],
      ms: 6400,
    },
    {
      chip: 'النهار والتصويت',
      narration: 'بالنهار النقاش مفتوح، ثم كل جوال يصوّت: «من تظنه من المافيا؟» أو تجاوز.',
      parts: [
        { t: 'headline', text: 'النقاش مفتوح', sub: 'صوّتوا الآن — أكثر الأصوات تُقصي صاحبها' },
        { t: 'tally', id: 'tally', rows: [
          { label: 'صقر الخليج', pct: 62, tone: 'red', votes: 4, players: [P('aboReem'), P('nourah'), P('mishal')] },
          { label: 'لؤلؤة', pct: 38, tone: 'blue', votes: 2, players: [P('lulu'), P('dani')] },
        ] },
        { t: 'ring', seconds: 30, label: 'ثانية للتصويت' },
      ],
      at: 'phone',
      phone: {
        kind: 'vote',
        title: 'من تظنه من المافيا؟',
        tiles: [
          { label: 'صقر الخليج', state: 'pick' },
          { label: 'لؤلؤة' },
          { label: 'أبو ريم' },
          { label: 'مشعل HX' },
          { label: 'دانيال' },
          { label: 'نورة ٢٢' },
        ],
        cols: 2,
        tap: 0,
        primary: 'تصويت',
        hint: 'تجاوز (لا أحد)',
      },
      chat: [
        { player: P('aboReem'), text: 'صقر ما كلّمنا البارحة 😅', kind: 'say' },
        { player: P('nourah'), text: 'أنا صوّتت لؤلؤة', kind: 'say' },
      ],
      ms: 6400,
    },
    {
      chip: 'النتيجة',
      narration: 'الكشف يقرر القرية: قتلوا كل المافيا يفوز المواطنون، أو تساوت الأعداد فتفوز المافيا.',
      parts: [
        { t: 'headline', text: 'فازت المافيا!', sub: 'تساوى العدد قبل أن تُقتل آخر بطاقة مافيا' },
        { t: 'podium', players: [P('saqr'), P('lulu'), P('nourah')], points: ['+١٢٠ نقطة', '+٨٠', '+٥٠'] },
        { t: 'cta', id: 'again', text: 'لوبي جديد', hint: 'نفس اللاعبين، أدوار جديدة' },
      ],
      click: 'again',
      phone: {
        kind: 'win',
        title: 'فزت! 🏆',
        sub: 'فريق المافيا سيطر على القرية',
        note: 'نقاط المباراة راحت لك في لوحة الصدارة',
        primary: 'لوبي جديد',
        tap: 'primary',
      },
      chat: [
        { player: P('mishal'), text: 'كانت قدامي مباشرة 😂', kind: 'say' },
        { player: P('dani'), text: 'جولة ثانية!', kind: 'say' },
      ],
      ms: 6000,
    },
  ],
};
