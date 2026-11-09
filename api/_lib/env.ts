/**
 * قارئ البيئة للسيرفر فقط.
 * لماذا لا نكتب process.env مباشرة؟ لأن vite.config يستبدل المعرّف `process`
 * بكائن فارغ في حزمة المتصفح، وفي الوضع التطويري تُحوَّل ملفات /api بنفس
 * الإعدادات فتنعدم القيم. globalThis.process يبقى الكائن الحقيقي دائماً:
 * في Node على Vercel موجود، وتحت الاستبدال لا يُلمس.
 */
const live = (): Record<string, string | undefined> => (globalThis as any).process?.env ?? {};

export const env = (key: string): string => String(live()[key] ?? '');
export const hasEnv = (key: string): boolean => !!live()[key];
export const isProduction = (): boolean => live().NODE_ENV === 'production';
