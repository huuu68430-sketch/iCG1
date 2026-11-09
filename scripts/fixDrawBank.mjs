// تصحيح مصفوف لكلمات بنك الرسم: يعيد كتابة السطر المطابق للكلمة بالقيم الجديدة.
import fs from 'fs';

const path = 'data/drawBank.ts';
const lines = fs.readFileSync(path, 'utf8').split('\n');

const ROW = /^(\s*)\['([^']*)',\s*([123]),\s*'([^']*)'(?:,\s*'([^']*)')?\](,?)\s*$/;

// drop: يحذف السطر — replace: كلمة جديدة — hint/alt: تصحيح النص
const FIXES = [
    { ar: 'ليمور', hint: 'قرد طويل الذيل' },
    { ar: 'دوركي', ar2: 'عصفور الدوري', hint: 'عصفور البيوت والقمح', alt: 'الدوري' },
    { ar: 'كركي', alt: 'طائر المستنقع' },
    { ar: 'يغور', ar2: 'جاغوار', hint: 'سنور كبير وبقع', alt: 'النمر الأمريكي' },
    { ar: 'نمس', alt: 'النعاس' },
    { ar: 'وعل الماء', hint: 'قرن حلزوني وأربع قوائم', alt: 'الكودو' },
    { ar: 'ثعلب القطب', ar2: 'ثعلب قطبي', hint: 'أبيض وثلج' },
    { ar: 'مدرع', hint: 'درع وقشرة' },
    { ar: 'قرش', hint: 'أسنان وزعنفة ظهرية' },
    { ar: 'سمندل', ar2: 'سمندر', hint: 'برمائي وماء', alt: 'السمندل' },
    { ar: 'دلو ورمال', ar2: 'قلعة رملية', hint: 'شاطئ وأبراج رمل', alt: 'القصر الرملي' },
    { ar: 'سفن', ar2: 'مرسى', hint: 'سفن وميناء', alt: 'المراسي' },
    { ar: 'شوربة', hint: 'طبق وملعقة' },
    { ar: 'أرز', hint: 'حبات صغيرة بيض' },
    { ar: 'عسل', hint: 'نحل وأصفر لزج' },
    { ar: 'برجر كبير', drop: true },
    { ar: 'ساندويتش فول', drop: true },
    { ar: 'آيس كريم', hint: 'مخروط وبارد', alt: 'البوظة' },
    { ar: 'كراميل', hint: 'أصفر ولزج' },
    { ar: 'زلابية', hint: 'مقلي وعسل' },
    { ar: 'مارشملو', alt: 'المارشميلو' },
    { ar: 'كرة سلة', hint: 'حلقة ومضرب' },
    { ar: 'ميدالية', hint: 'شريط وذهب' },
    { ar: 'بيضة فاصلة', ar2: 'بيض الفصح', hint: 'بيض ملون وأعياد', alt: 'البيض الملون' },
    { ar: 'لعبة سيارات', alt: 'سيارة لعبة' },
    { ar: 'قوة بدنية', ar2: 'أثقال', hint: 'قضيب وأقراص', alt: 'رفع الأثقال' },
    { ar: 'دراجة ثلاثية', alt: 'دراجة الأطفال' },
    { ar: 'تروتينيت', ar2: 'دراجة كهربائية', hint: 'بطارية ودواسات', alt: 'السكوتر الكهربائي' },
    { ar: 'قطار سريع', alt: 'القطار فائق السرعة' },
    { ar: 'حمار وحمولة', ar2: 'حصان حمولة', hint: 'صندوق وظهر' },
    { ar: 'سلم كهربائي', hint: 'مركز تجاري وتدرّج' },
    { ar: 'نودلز', alt: 'رامن|شعيرية' },
    { ar: 'طبق طائر', alt: 'الطبق الطائر' },
    { ar: 'نينجا', alt: 'النينجا' },
    { ar: 'ساموراي', alt: 'الساموراي' },
    { ar: 'حزام ناسف', ar2: 'جنّي', hint: 'دخان وأمنيات', alt: 'الجني|المارد' },
    { ar: 'وحيد القرن', keepFirst: true },
    { ar: 'مخطوطة', alt: 'اللفافة' },
    { ar: 'خريطة كنز', alt: 'الخريطة' },
    { ar: 'وحش بحري', hint: 'أذرع وأعماق' },
    { ar: 'سجادة طائرة', hint: 'طيران وفرش' },
    { ar: 'مصباح سحري', alt: 'علاء الدين' },
    { ar: 'رجل آلي عملاق', alt: 'العملاق الآلي' },
    { ar: 'بوابة سحرية', hint: 'دوران ونور' },
    { ar: 'إطفائي', hint: 'خوذة وخرطوم' },
    { ar: 'بحار', hint: 'مرساة وموج' },
    { ar: 'طباخ', hint: 'قبعة بيضاء ومقلاة' },
    { ar: 'صياد', alt: 'الصياد' },
    { ar: 'عسكري', ar2: 'ضابط', hint: 'رتب وكتف', alt: 'العسكري' },
    { ar: 'الاحساء', ar2: 'الأحساء', hint: 'أكبر واحة نخيل', alt: 'الحساء' },
    { ar: 'جزيرة الكنز', alt: 'الجزيرة النائية' },
    { ar: 'اللاظذكية', drop: true },
    { ar: 'مسلات', ar2: 'مسلة', hint: 'حجر طويل وفراعنة', alt: 'المسلات' },
    { ar: 'الحجر الأسود', hint: 'مكة وحجر أسود' },
    { ar: 'قصر حكم', ar2: 'قصر رئاسي', hint: 'أعلام وحراسة' },
    { ar: 'ميدان تاون', ar2: 'ساحة عامة', hint: 'نوافير وأعمدة' },
    { ar: 'مئذنة المنارة', drop: true },
    { ar: 'قصر الحمراء', drop: true },
    { ar: 'طائرة ورقية', keepFirst: true },
];

const byWord = new Map();
for (const f of FIXES) {
    const list = byWord.get(f.ar) || [];
    list.push(f);
    byWord.set(f.ar, list);
}

let changed = 0, dropped = 0;
const hits = new Map();
const out = [];
for (const line of lines) {
    const m = line.match(ROW);
    if (!m) { out.push(line); continue; }
    const [, indent, ar, tier, hint, alt, comma] = m;
    const list = byWord.get(ar);
    if (!list) { out.push(line); continue; }
    const f = list.find(x => !hits.get(x));
    if (!f) { out.push(line); continue; }
    if (f.keepFirst) {
        const already = out.some(l => l.includes(`'${ar}'`));
        if (!already) { out.push(line); continue; }
        hits.set(f, true); dropped++; continue;
    }
    if (f.drop) { hits.set(f, true); dropped++; continue; }
    hits.set(f, true);
    const nextWord = f.ar2 || ar;
    const nextHint = f.hint !== undefined ? f.hint : hint;
    const nextAlt = f.alt !== undefined ? f.alt : alt;
    out.push(`${indent}['${nextWord}', ${tier}, '${nextHint}'${nextAlt ? `, '${nextAlt}'` : ''}]${comma}`);
    changed++;
}

const missed = FIXES.filter(f => !hits.get(f)).map(f => f.ar);
fs.writeFileSync(path, out.join('\n'));
console.log('changed:', changed, 'dropped:', dropped, 'missed:', missed.join(', ') || 'none');
