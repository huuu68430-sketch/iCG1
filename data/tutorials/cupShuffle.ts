import type { GameTutorial } from '../../components/tutorial/types';
import { P } from '../tutorial_players';

/**
 * تحدي الأكواب — مرجع لألعاب الشات: نفس أزرار components/CupShuffle.tsx بالحرف.
 */
export const cupShuffle: GameTutorial = {
  viewId: 'CUP_SHUFFLE',
  title: 'تحدي الأكواب',
  tagline: 'الكرة تحت أحد الأكواب، والأكواب تتبادل الأماكن — تركّز وتخمّن.',
  emoji: '🥤',
  join: 'chat',
  rules: [
    'الهوست يختار عدد الأكواب (٣ إلى ٨) وعدد الجولات ووقت التصويت وسرعة الخلط.',
    'الكرة تظهر تحت كوب واحد، ثم تتبادل الأكواب أماكنها — لا تفقد التركيز.',
    'صوّت برقم الكوب في الشات: «٣» أو «كوب ٣» أو «الثاني» — صوت واحد لكل جولة.',
    'الجولة تنتهي بالكشف: كل مصوّب يقاسم جائزة الجولة.',
    'كل ما قلّ عدد المصيبين زادت النقاط (مكافأة المجازفة) — خمن الصح ولا تمشِ مع الأغلبية.',
  ],
  scoring: 'جائزة الجولة = ١٠٠ نقطة + ٢٥ لكل كوب إضافي، تُقسّم على المصيبين مع مكافأة مجازفة تصل إلى ١٠٠.',
  steps: [
    {
      chip: 'الإعداد',
      narration: 'من لوحة المشرف اختر عدد الأكواب والجولات ووقت التصويت، ثم اضغط «ابدأ التحدي».',
      parts: [
        { t: 'kicker', text: 'CUP SHUFFLE • SETUP' },
        { t: 'headline', text: 'لوحة الأكواب', sub: 'كل شيء يُضبط قبل ما تبدأ الجولة' },
        { t: 'tiles', cols: 4, items: [
          { label: '٤', sub: 'أكواب', state: 'hot' },
          { label: '٥', sub: 'جولات', state: 'idle' },
          { label: '١٢ ث', sub: 'تصويت', state: 'idle' },
          { label: 'سريع', sub: 'سرعة الخلط', state: 'idle' },
        ] },
        { t: 'cta', id: 'start', text: 'ابدأ التحدي' },
      ],
      click: 'start',
      ms: 5400,
    },
    {
      chip: 'الكرة',
      narration: 'الكرة تُوضع تحت كوب واحد — والكاميرا تُظهر مكانها لحظة، ثم تبدأ الحركة.',
      parts: [
        { t: 'headline', text: 'استعد…', sub: 'الكرة تحت أحد الأكواب الأربعة' },
        { t: 'tiles', cols: 4, id: 'cups', items: [
          { label: '🥤', sub: 'كوب ١' },
          { label: '🥤', sub: 'كوب ٢', state: 'pick' },
          { label: '🥤', sub: 'كوب ٣' },
          { label: '🥤', sub: 'كوب ٤' },
        ] },
        { t: 'bigText', text: '٣ · ٢ · ١', tone: 'gold' },
      ],
      at: 'stage',
      ms: 4600,
      zoom: 1.06,
    },
    {
      chip: 'الخلط',
      narration: 'الأكواب تتبادل الأماكن — هنا الشغل كله: تابع الكوب الذي تحت الكرة.',
      parts: [
        { t: 'headline', text: 'الأكواب تتبادل الأماكن…' },
        { t: 'tiles', cols: 4, items: [
          { label: '🥤', sub: 'كوب ٣' },
          { label: '🥤', sub: 'كوب ١' },
          { label: '🥤', sub: 'كوب ٤' },
          { label: '🥤', sub: 'كوب ٢' },
        ] },
        { t: 'note', text: '٤ تبديلات بسرعة «سريع» — لا تنظر للأرقام، انظر للأكواب.' },
      ],
      noCursor: true,
      ms: 4200,
    },
    {
      chip: 'التصويت',
      narration: 'يبدأ التصويت: اكتب رقم الكوب في الشات. «٣» أو «كوب ٣» أو «الثاني» — كلها تُقبل.',
      parts: [
        { t: 'headline', text: 'صوّت برقم الكوب في الشات' },
        { t: 'tally', rows: [
          { label: 'كوب ٢', pct: 46, tone: 'green', votes: 6, players: [P('aboReem'), P('nourah'), P('mishal')] },
          { label: 'كوب ٤', pct: 31, votes: 4, players: [P('lulu'), P('saqr')] },
          { label: 'كوب ١', pct: 23, tone: 'red', votes: 3, players: [P('dani')] },
        ] },
        { t: 'ring', seconds: 12, label: 'ثانية' },
        { t: 'cta', id: 'reveal', text: 'اكشف الآن', tone: 'red' },
      ],
      click: 'reveal',
      chat: [
        { player: P('mishal'), text: 'كوب ٢', kind: 'answer' },
        { player: P('lulu'), text: '٤', kind: 'answer' },
        { player: P('aboReem'), text: 'الثاني 👈', kind: 'answer' },
      ],
      ms: 6400,
    },
    {
      chip: 'الكشف',
      narration: 'الكشف يوقف القلوب: الكرة تحت كوب ٢ — وكل من صوّت له يأخذ حصته من الجائزة.',
      parts: [
        { t: 'headline', text: 'الكرة تحت كوب ٢' },
        { t: 'tiles', cols: 4, items: [
          { label: '🥤', sub: 'كوب ١', state: 'dim' },
          { label: '⚾', sub: 'كوب ٢', state: 'good' },
          { label: '🥤', sub: 'كوب ٣', state: 'dim' },
          { label: '🥤', sub: 'كوب ٤', state: 'dim' },
        ] },
        { t: 'chips', items: [{ text: '٦ مصيبين', tone: 'green' }, { text: '٤٥ نقطة لكل منهم', tone: 'gold' }, { text: 'مكافأة مجازفة +١٨', tone: 'green' }] },
      ],
      at: 'stage',
      chat: [{ player: P('nourah'), text: 'يااااه لحقتها 😍', kind: 'say' }],
      ms: 5400,
      zoom: 1.1,
    },
    {
      chip: 'الختام',
      narration: 'بعد كل الجولات تظهر منصة النقاط — وأعلى ثلاثة يخلّدون في لوحة الصدارة.',
      parts: [
        { t: 'headline', text: 'انتهى التحدي', sub: 'نقاط الجلسة على الأكواب' },
        { t: 'podium', players: [P('mishal'), P('aboReem'), P('lulu')], points: ['١٨٠ نقطة', '١٤٥', '١١٠'] },
        { t: 'cta', id: 'again', text: 'جولة جديدة', hint: 'أو غيّر الإعدادات' },
      ],
      click: 'again',
      ms: 5200,
    },
  ],
};
