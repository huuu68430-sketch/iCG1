/**
 * iCG1 – سجل الإطارات (16 إطاراً)
 * نفس الإطارات الموجودة في «معرض الإطارات.html» بنفس الأسماء والأسعار والندرة.
 * الرسم نفسه يأتي من public/frames-runtime.js (مصدر واحد لكل المنصة).
 */

export type FrameRarity = 'c' | 'r' | 'e' | 'l';

export interface FrameDef {
  id: string;
  name: string;
  description: string;
  rarity: FrameRarity;
  price: number;
  sortOrder: number;
}

export const RARITY: Record<FrameRarity, { label: string; en: string; color: string }> = {
  c: { label: 'عادي', en: 'COMMON', color: '#bdb5a8' },
  r: { label: 'نادر', en: 'RARE', color: '#38bdf8' },
  e: { label: 'ملحمي', en: 'EPIC', color: '#c084fc' },
  l: { label: 'أسطوري', en: 'LEGENDARY', color: '#fbbf24' },
};

export const FRAMES: FrameDef[] = [
  { id: 'basic', name: 'الإطار الأساسي', description: 'إطار مجاني لكل عضو جديد', rarity: 'c', price: 0, sortOrder: 1 },
  { id: 'ramadan', name: 'إطار رمضان', description: 'إطار رمضاني مميز بأجواء الشهر الفضيل', rarity: 'r', price: 0, sortOrder: 2 },
  { id: 'dark', name: 'إطار الظلام', description: 'إطار الغموض المرعب', rarity: 'r', price: 0, sortOrder: 3 },
  { id: 'crown', name: 'تاج الملوك', description: 'تاج الملوك الذهبي الفاخر', rarity: 'e', price: 5000, sortOrder: 4 },
  { id: 'fire', name: 'إطار النيران', description: 'إطار محاط بلهيب لا ينطفئ', rarity: 'e', price: 6000, sortOrder: 5 },
  { id: 'crystal', name: 'إطار الكريستال', description: 'كريستال وردي لامع يخطف الأنظار', rarity: 'e', price: 6000, sortOrder: 6 },
  { id: 'emerald', name: 'إطار الزمرد', description: 'زمرد أخضر مشع وطاقة نقية', rarity: 'e', price: 10000, sortOrder: 7 },
  { id: 'neon', name: 'إطار النيون', description: 'إضاءة نيون قوية للمحترفين فقط', rarity: 'e', price: 10500, sortOrder: 8 },
  { id: 'galaxy', name: 'إطار المجرة', description: 'يعكس اتساع الكون والفضاء', rarity: 'l', price: 5500, sortOrder: 9 },
  { id: 'diamond', name: 'الإطار الماسي', description: 'إطار الألماس النادر والمبهر', rarity: 'l', price: 9000, sortOrder: 10 },
  { id: 'gold', name: 'الإطار الذهبي', description: 'إطار الذهب الفاخر للأعضاء المتألقين', rarity: 'l', price: 8000, sortOrder: 11 },
  { id: 'imperial', name: 'الإطار الإمبراطوري', description: 'إطار إمبراطوري حصري على المنصة', rarity: 'l', price: 11000, sortOrder: 12 },
  { id: 'thunder', name: 'إطار الرعد', description: 'طاقة كهربائية مرعبة ومخيفة', rarity: 'l', price: 12000, sortOrder: 13 },
  { id: 'royal', name: 'الإطار الملكي', description: 'مخصص للأباطرة والملوك في المنصة', rarity: 'l', price: 14000, sortOrder: 14 },
  { id: 'astral', name: 'الإطار الفلكي', description: 'نسخة محدودة من الإطار الفلكي', rarity: 'l', price: 20000, sortOrder: 15 },
  { id: 'vip', name: 'الإطار الأسطوري', description: 'الإطار المتحرك الأسطوري (VIP)', rarity: 'l', price: 25000, sortOrder: 16 },
];

export const FREE_FRAME_IDS = FRAMES.filter(f => f.price === 0).map(f => f.id);

export const frameById = (id?: string | null): FrameDef | null =>
  FRAMES.find(f => f.id === (id || '').trim().toLowerCase()) || null;

export const isFrameId = (id?: string | null): boolean => !!frameById(id);

type FrameRuntime = {
  art: (idOrIndex: string | number) => string;
  avatar: (opts: { frameId?: string | number; src?: string; initial?: string }) => string;
  indexOf: (id: string) => number;
  meta: any[];
  rarity: Record<string, string>;
};

const runtime = (): FrameRuntime | null =>
  typeof window !== 'undefined' ? ((window as any).ICG1Frames as FrameRuntime) || null : null;

/** رسم الإطار فقط (بدون الصورة) */
export const frameArt = (idOrIndex: string | number): string => {
  const rt = runtime();
  if (!rt) return '';
  try {
    return rt.art(idOrIndex);
  } catch (e) {
    console.warn('[frames] art failed', e);
    return '';
  }
};

/** صورة مستخدم كاملة بإطار جاهز (تُستخدم في الملفات الثابتة مثل كود نيمز) */
export const frameAvatarMarkup = (opts: { frameId: string; src?: string; initial?: string }): string => {
  const rt = runtime();
  if (!rt) return '';
  try {
    return rt.avatar(opts);
  } catch (e) {
    return '';
  }
};

export const framesRuntimeReady = (): boolean => !!runtime();
