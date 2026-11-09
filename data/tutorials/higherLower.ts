import type { GameTutorial } from '../../components/tutorial/types';
import { P } from '../tutorial_players';

/**
 * أعلى أم أقل — مرجع لأزرار وشاشات components/HigherLowerGame.tsx بالحرف:
 * اختيار المرحلة، «اكشف الإجابة»، «السؤال التالي»، «اكتملت المرحلة»، و«المرحلة التالية».
 */
export const higherLower: GameTutorial = {
  viewId: 'HIGHER_LOWER',
  title: 'أعلى أم أقل',
  tagline: 'رقم يطلع، والسؤال: اللي بعده أعلى ولا أقل؟ صوّت في الشات وانتظر الانكشف.',
  emoji: '⚖️',
  join: 'chat',
  rules: [
    '٣٠ مرحلة بخمسة مستويات: سـهـل مـتوسـط صـعـب قـاسي أُسـطـوري — كل ما صعب، زادت النقاط.',
    'يطلع سؤال له قيمة معروفة — والكل يقرر: الرقم الجاي أعلى ولا أقل؟',
    'اكتب «أعلى» أو «أقل» في الشات — فوق وهاير واعلي واسفل وتحت كلها تحسب.',
    'صوت واحد لكل سؤال — أول رسالة لك تُسجّل والباقي يتجاهلونه.',
    'اللي على الجهة الصحينة ياخذون نقاط المستوى كاملة: من ١٠ إلى ٥٠.',
  ],
  scoring: 'نقاط المستوى لكل مصيب: ١٠ سـهـل و٢٠ مـتوسـط و٣٠ صـعـب و٤٠ قـاسي و٥٠ أُسـطـوري — الفائز ١٤٠ نقطة في الماتش أو ٤٠ في الجولة.',
  steps: [
    {
      chip: 'المراحل',
      narration: 'من شاشة «أعلى أم أقل» اختر بطاقة مرحلة من الـ٣٠، أو اضغط «مرحلة عشوائية» وابدأ مباشرة.',
      parts: [
        { t: 'kicker', text: 'HIGHER LOWER • STAGES' },
        { t: 'headline', text: 'أعلى أم أقل', sub: '٣٠ مرحلة · ٥ مستويات' },
        { t: 'tiles', cols: 3, id: 'tiers', items: [
          { label: 'سـهـل', sub: '+١٠ نقاط', state: 'idle' },
          { label: 'مـتوسـط', sub: '+٢٠ نقطة', state: 'hot' },
          { label: 'صـعـب', sub: '+٣٠ نقطة', state: 'idle' },
          { label: 'قـاسـي', sub: '+٤٠ نقطة', state: 'idle' },
          { label: 'أُسـطـوري', sub: '+٥٠ نقطة', state: 'pick' },
          { label: 'كل المراحل', sub: '٣٠ بطاقة', state: 'dim' },
        ] },
        { t: 'cta', id: 'random', text: 'مرحلة عشوائية', hint: 'أو اختر بطاقة مرحلة بالتحديد' },
      ],
      click: 'random',
      ms: 5600,
    },
    {
      chip: 'السؤال',
      narration: 'يطلع السؤال وقيمته الحالية، والعدّاد الدائري يبدأ — مهمتك: الجاي أعلى ولا أقل؟',
      parts: [
        { t: 'headline', text: 'أعلى ─ أم ─ أقل', sub: 'سؤال ٣ / ١٠ · ٢٤ صوت' },
        { t: 'bigText', text: '٤٥٠', sub: 'كم عدد جزر الدولة دي؟ — الجاي أعلى ولا أقل؟', tone: 'cream' },
        { t: 'ring', seconds: 12, label: 'ثانية' },
      ],
      at: 'stage',
      ms: 4800,
    },
    {
      chip: 'التصويت',
      narration: 'صوّت في الشات: «أعلى» أو «أقل» — فوق وهاير واعلي كلها تُقبل، بس صوت واحد لكل سؤال.',
      parts: [
        { t: 'headline', text: 'اكتب «أعلى»', sub: 'أو «أقل» — الجهة اللي تحسّها الصح' },
        { t: 'tally', rows: [
          { label: '↑ أعلى', pct: 58, tone: 'gold', votes: 14, players: [P('aboReem'), P('nourah'), P('mishal')] },
          { label: '↓ أقل', pct: 42, tone: 'ember', votes: 10, players: [P('lulu'), P('saqr')] },
        ] },
        { t: 'bar', pct: 58, label: 'الذهبي أعلى · جمرة أقل', tone: 'gold' },
      ],
      at: 'chat',
      chat: [
        { player: P('mishal'), text: 'أعلى 💪', kind: 'answer' },
        { player: P('lulu'), text: 'اعلي', kind: 'answer' },
        { player: P('saqr'), text: 'أقل', kind: 'answer' },
      ],
      ms: 6400,
    },
    {
      chip: 'الكشف',
      narration: 'الهوست يضغط «اكشف الإجابة» — تطلع الإجابة الصحيحة مع «الحقيقة» واللي على الصح ياخذون نقاطهم.',
      parts: [
        { t: 'headline', text: 'الإجابة الصحيحة: أعلى', sub: '٢٢ جاوبوا صح · +٢٠ نقطة', tone: 'green' },
        { t: 'note', text: 'الحقيقة: عدد الجزر الرسمي ٦٨٧ — ضِعف اللي قبلها!' },
        { t: 'cta', id: 'reveal', text: 'اكشف الإجابة', tone: 'red' },
      ],
      click: 'reveal',
      ms: 5400,
      zoom: 1.08,
    },
    {
      chip: 'المرحلة',
      narration: 'تُغلق المرحلة وتطلع «اكتملت المرحلة ٣» مع «أبطال المرحلة» — اضغط «المرحلة التالية» للتكملة.',
      parts: [
        { t: 'headline', text: 'اكتملت المرحلة ٣', sub: 'أبطال المرحلة: اللي ما غلطوا' },
        { t: 'roster', cols: 4, caption: 'أبطال المرحلة', players: [P('aboReem'), P('nourah'), P('turbo'), P('dani')] },
        { t: 'cta', id: 'next', text: 'المرحلة التالية', hint: 'أو «كل المراحل» للرجوع للبطاقات' },
      ],
      click: 'next',
      ms: 5000,
    },
    {
      chip: 'الختام',
      narration: 'بعد كل الأسئلة تطلع المنصة — بطل الماتش يمسح ١٤٠ نقطة وبطل الجولة ٤٠.',
      parts: [
        { t: 'headline', text: 'انتهت المرحلة الكبرى', sub: 'أعلى رأس في «أعلى أم أقل»', tone: 'gold' },
        { t: 'podium', players: [P('nourah'), P('aboReem'), P('mishal')], points: ['١٤٠ نقطة', '١١٥', '٩٠'] },
        { t: 'chips', items: [{ text: 'نقاط المستويات ١٠ إلى ٥٠', tone: 'cream' }, { text: 'الفائز ١٤٠', tone: 'gold' }] },
      ],
      at: 'stage',
      ms: 4600,
    },
  ],
};
