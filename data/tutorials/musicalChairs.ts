import type { GameTutorial } from '../../components/tutorial/types';
import { P } from '../tutorial_players';

/**
 * الكرسي الموسيقي — مرجع لأزرار وشاشات public/musical-chairs.html بالحرف
 * (اللي يغلّفه components/MusicalChairsGame.tsx): دخول، 🎵 تحرك، احجز!، النتيجة.
 */
export const musicalChairs: GameTutorial = {
  viewId: 'MUSICAL_CHAIRS',
  title: 'الكرسي الموسيقي',
  tagline: 'الموسيقى شغّالة تلفّ حول الكراسي — تقف؟ اكتب رقم كرسيك بسرعة قبل لا يفوتك.',
  emoji: '🪑',
  join: 'chat',
  joinWord: 'دخول',
  rules: [
    'اكتب «دخول» في الشات عشان تدخل السباق وتطلع في لوبي «في انتظار اللاعبين».',
    'بينما الموسيقى شغّالة الجميع يدور حول الكراسي المرقّمة — ما تحتاج تسوي شي.',
    'لحظة ما تقف الموسيقى اكتب رقم الكرسي في الشات — أسرع واحد يحجز ويصمد.',
    'حجز الكرسي = ★ +٢٥ نقطة، أول واحد يقعد +٥، والنجاة من جولة +١٠.',
    'الفائز بالنهائي يمسح ٢٠٠ نقطة، وبطل الجولة ٥٠ — وكل جولة كرسي أقل.',
  ],
  scoring: 'القعدة = ★ +٢٥، الأسبقية +٥، النجاة من الجولة +١٠ — والفائز ٢٠٠ نقطة في الماتش أو ٥٠ في الجولة.',
  steps: [
    {
      chip: 'الإعداد',
      narration: 'من شاشة «الكرسي الموسيقي» اضبط الجولات ووقت الحجز، ثم اضغط «بدء المعركة».',
      parts: [
        { t: 'kicker', text: 'MUSICAL CHAIRS • SETUP' },
        { t: 'headline', text: 'الكرسي الموسيقي', sub: 'كل شيء يُضبط قبل المعركة' },
        { t: 'tiles', cols: 3, items: [
          { label: '٥', sub: 'جولات', state: 'hot' },
          { label: '٨', sub: 'كراسي', state: 'idle' },
          { label: '٣ ث', sub: 'حجز', state: 'idle' },
        ] },
        { t: 'cta', id: 'start', text: 'بدء المعركة' },
      ],
      click: 'start',
      ms: 5200,
    },
    {
      chip: 'اللوبي',
      narration: 'لمّا يكتب المتابعون «دخول» في الشات يملون اللوبي — اضغط «▶ بدء اللعب».',
      parts: [
        { t: 'headline', text: 'في انتظار اللاعبين', sub: 'كلمة الدخول: «دخول»' },
        { t: 'roster', cols: 4, caption: 'المنضمّون', players: [P('aboReem'), P('nourah'), P('mishal'), P('lulu'), P('saqr'), P('dani')] },
        { t: 'cta', id: 'play', text: '▶ بدء اللعب', hint: 'أو «تراجع» للرجوع للإعداد' },
      ],
      click: 'play',
      chat: [
        { player: P('nourah'), text: 'دخول', kind: 'join' },
        { player: P('saqr'), text: 'دخول 🪑', kind: 'join' },
        { player: P('dani'), text: 'دخول', kind: 'join' },
      ],
      ms: 5600,
    },
    {
      chip: 'تحرك',
      narration: 'تشغّل الموسيقى وتطلع الكراسي المرقّمة في الساحة — الجميع يدور حولها، راقب فقط.',
      parts: [
        { t: 'headline', text: '🎵 تحرك', sub: 'الدوران حول الكراسي تلقائي — لا تكتب شي الحين' },
        { t: 'tiles', cols: 4, id: 'chairs', items: [
          { label: '🪑', sub: 'كرسي ١' },
          { label: '🪑', sub: 'كرسي ٢' },
          { label: '🪑', sub: 'كرسي ٣' },
          { label: '🪑', sub: 'كرسي ٤' },
        ] },
        { t: 'chips', items: [{ text: 'الجولة ١', tone: 'gold' }, { text: 'المتبقون ٦', tone: 'green' }, { text: 'تحرك', tone: 'blue' }] },
      ],
      at: 'stage',
      ms: 4800,
    },
    {
      chip: 'احجز',
      narration: 'تقف الموسيقى! اكتب رقم الكرسي اللي تبيه في الشات فوراً — أول واحد يلحقه يجلسه.',
      parts: [
        { t: 'headline', text: 'احجز!', sub: 'اكتب رقم الكرسي في الشات — المسابقة على الإشعال' },
        { t: 'tiles', cols: 4, id: 'race', items: [
          { label: '🪑', sub: 'كرسي ٢', id: 'c2' },
          { label: '🪑', sub: 'كرسي ٣', id: 'c3' },
          { label: '🪑', sub: 'كرسي ٤', id: 'c4' },
          { label: '🚫', sub: 'بلا كرسي', state: 'bad' },
        ] },
        { t: 'ring', seconds: 3, label: 'ثانية' },
      ],
      click: 'c3',
      zoom: 1.08,
      chat: [
        { player: P('mishal'), text: '٣', kind: 'answer' },
        { player: P('aboReem'), text: '٣', kind: 'answer' },
        { player: P('lulu'), text: '٢', kind: 'answer' },
      ],
      ms: 6200,
    },
    {
      chip: 'النتيجة',
      narration: 'اللوحة تعرض «النتيجة»: القعدة ★ +٢٥، وأول جالس +٥، واللي نجا من الجولة +١٠.',
      parts: [
        { t: 'headline', text: 'النتيجة', sub: 'من جلس ومن خرج من السباق' },
        { t: 'tally', rows: [
          { label: 'كرسي ٣', pct: 62, tone: 'green', votes: 1, players: [P('mishal')] },
          { label: 'كرسي ٢', pct: 38, tone: 'blue', votes: 1, players: [P('lulu')] },
          { label: 'خارج السباق', pct: 0, tone: 'red', players: [P('dani')] },
        ] },
        { t: 'chips', items: [{ text: '★ +٢٥', tone: 'gold' }, { text: 'أسبقية +٥', tone: 'green' }, { text: 'نجاة +١٠', tone: 'cream' }] },
      ],
      at: 'stage',
      chat: [{ player: P('dani'), text: 'توّهت على الكرسي 😅', kind: 'say' }],
      ms: 5400,
    },
    {
      chip: 'الختام',
      narration: '👑 «الفائز بالكراسي الموسيقية» يمسح ٢٠٠ نقطة — اضغط «جولة جديدة ↻» للإعادة.',
      parts: [
        { t: 'headline', text: '👑 الفائز بالكراسي الموسيقية', sub: 'انتهت — لا تعادل في الحجز السريع', tone: 'gold' },
        { t: 'podium', players: [P('mishal'), P('aboReem'), P('lulu')], points: ['٢٠٠ نقطة', '١٤٥', '١١٠'] },
        { t: 'chips', items: [{ text: '⭐ نقاط · 🪑 جولات · 👥 لاعبون', tone: 'gold' }] },
        { t: 'cta', id: 'again', text: 'جولة جديدة ↻', hint: 'أو «الإعدادات» لتغيير السباق' },
      ],
      click: 'again',
      ms: 5000,
    },
  ],
};
