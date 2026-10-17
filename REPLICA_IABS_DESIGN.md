# دليل إعادة بناء تصميم iABS — نسخة مطابقة 100%

> هذا الملف **توثيق فقط** (read-only). هدفه أن يبني أي شخص **نفس التصميم بالضبط** —
> نفس الخط، نفس اللون، نفس الأنيميشن، نفس الإيفكت — في **مشروع جديد مستقل**.
>
> ⚠️ **ممنوع منعاً باتاً** تعديل أي ملف داخل موقع iABS الأصلي.
> كل ما تحتاجهنسخه في **مجلد جديد تماماً**outside المشروع.

---

## المحتويات

| # | القسم |
|---|---|
| 0 | [قاعدة ذهبية: كيف تعمل بدون لمس الموقع](#0-قاعدة-ذهبية) |
| 1 | [المتطلبات/Stacks versions](#1-المتطلبات) |
| 2 | [الخطوط — أهم نقطة](#2-الخطوط) |
| 3 | [Design Tokens (متغيرات الألوان)](#3-design-tokens) |
| 4 | [tailwind.config.js — كامل](#4-tailwindconfigjs--كامل) |
| 5 | [postcss.config.js](#5-postcssconfigjs) |
| 6 | [styles.css — الملف الكامل](#6-stylescss--الملف-الكامل) |
| 7 | [index.html — الهيكل والـ critical CSS](#7-indexhtml--الهيكل) |
| 8 | [طبقة الخلفية (ArenaBackground)](#8-طبقة-الخلفية-arena-background) |
| 9 | [قسم الهيرو —Markup حرفي](#9-قسم-الهيرو) |
| 10 | [تشريح علامة iABS (5 طبقات)](#10-تشريح-علامة-iabs--5-طبقات) |
| 11 | [بطاقة الصورة الشخصية](#11-بطاقة-الصورة-الشخصية) |
| 12 | [مكونات مشتركة: Reveal / SectionHeading / Marquee](#12-مكونات-مشتركة) |
| 13 | [ترتيب أقسام الصفحة الرئيسية](#13-ترتيب-أقسام-الصفحة-الرئيسية) |
| 14 | [كتالوج كل الأنيميشن](#14-كتالوج-كل-الأنيميشن) |
| 15 | [حارس الأداء و reduced-motion](#15-حارس-الأداء-و-reduced-motion) |
| 16 | [الأصول (Assets) المطلوبة](#16-الأصول-المطلوبة) |
| 17 | [قائمة تحقق للمطابقة](#17-قائمة-تحقق-للمطابقة) |

---

## 0. قاعدة ذهبية

**المطلوب:** بناء مطابق في مشروع منفصل.

```
✅ افعل:
   - أنشئ مجلداً جديداً تماماً (مثلاً iabs-clone/)
   - انسخ منه القيم المذكورة في هذا الدليل
   - شغّل مشروعك على منفذ مختلف (مثلاً 5174)

❌ لا تفعل:
   - لا تعدّل App.tsx أو styles.css أو tailwind.config.js الأصلي
   - لا تضف ملفات داخل مجلد components/ الأصلي
   - لا تشغّل npm install على مجلد الموقع الأصلي
   - لا ترفع أي شيء على gh-pages الأصلي
```

الفصل النهائي بين المشروعين:

```bash
# مشروعك الجديد — خارج موقع iABS
mkdir C:\Users\MOH\Documents\GG\iabs-clone
cd C:\Users\MOH\Documents\GG\iabs-clone
```

---

## 1. المتطلبات

استخدم **نسخاً مطابقة** لهذه الأرقام، اختلاف النسخة قد يغيّر النتيجة البصرية:

```json
{
  "dependencies": {
    "react": "^19.2.3",
    "react-dom": "^19.2.3"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^5.0.0",
    "autoprefixer": "^10.6.1",
    "postcss": "^8.5.29",
    "tailwindcss": "^3.4.19",
    "typescript": "~5.8.2",
    "vite": "^6.2.0"
  }
}
```

⚠️ **حرج:** Tailwind **v3** وليس v4. في v4 نظام الـ tokens والإعدادات مختلف تماماً وسيخرج التصميم بشكل مختلف.

الأقسام التي تحتاجها فقط (بدون باكند):
- ✅ الهيرو، الخلفية، الماركي، عناوين الأقسام، الأزرار، الكروت
- ❌ لا تحتاج: Supabase، Pusher، HLS، Groq API (هذه للبيانات الحية فقط)

---

## 2. الخطوط

هذا **أهم قسم في الملف كله**. أي اختلاف هنا = اختلاف شكل الصفحة.

### 2.1 روابط Google Fonts (حرفي)

ضعها في `<head>` **قبل** أي CSS:

```html
<!-- الخطوط: أوزان أقل + preconnect -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Outfit:wght@800;900&family=Tajawal:wght@500;700;900&family=Bangers&display=swap">
<link
  href="https://fonts.googleapis.com/css2?family=Outfit:wght@800;900&family=Tajawal:wght@500;700;900&family=Bangers&display=swap"
  rel="stylesheet" media="print" onload="this.media='all'">
<noscript>
  <link
    href="https://fonts.googleapis.com/css2?family=Outfit:wght@800;900&family=Tajawal:wght@500;700;900&family=Bangers&display=swap"
    rel="stylesheet">
</noscript>

<!-- Cairo: خاص بقسم أساطير الشات فقط -->
<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Cairo:wght@500;700;900&display=swap">
<link
  href="https://fonts.googleapis.com/css2?family=Cairo:wght@500;700;900&display=swap"
  rel="stylesheet" media="print" onload="this.media='all'">
<noscript>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@500;700;900&display=swap" rel="stylesheet">
</noscript>
```

> **لماذا `media="print" onload="this.media='all'`؟**
> هذا تحميل غير متزامن (non-blocking) — يمنع تأخير أول رسم للصفحة.
> **لا تحذفه**، وإلا ظهر النص بخط بديل ثم تغيّر (وهذا يكسر شرط "نفس الخط").

### 2.2 جدول الخطوط

| اسم العائلة | الأوزان المحملة | الاستخدام | اسم الـ class |
|---|---|---|---|
| **Bangers** | 400 (افتراضي) | كلمة `iABS`، `KING OF ACCEPTANCE`، أرقام الأقسام | `font-gaming` |
| **Tajawal** | 500, 700, 900 | الخط العربي الأساسي لكامل الموقع | `font-arabic` |
| **Outfit** | 800, 900 | العناوين اللاتينية | `font-heading` |
| **Cairo** | 500, 700, 900 | قسم "أساطير الشات" فقط | `font-cairo` |

### 2.3 تعريف fontFamily في Tailwind

```js
fontFamily: {
  sans:    ['"Plus Jakarta Sans"', '"Tajawal"', 'sans-serif'],
  heading: ['"Outfit"', '"Cairo"', '"Tajawal"', 'sans-serif'],
  arabic:  ['"Tajawal"', '"Cairo"', 'sans-serif'],
  cairo:   ['"Cairo"', '"Tajawal"', 'sans-serif'],
  gaming:  ['"Bangers"', 'cursive'],
}
```

> **ملاحظة مهمة:** `"Plus Jakarta Sans"` **غير محمّل** من Google Fonts في الموقع الأصلي.
> هذا سلوك موجود أصلاً في الموقع — المتصفح يتجاهله ويختار `"Tajawal"` بدلاً منه.
> **انسخه كما هو** حتى لا يتغيّر شكل الـ fallback.

### 2.4 Fallback عند انقطاع الإنترنت

```css
body {
  font-family: "Tajawal", Tahoma, Arial, sans-serif;
}
```

> ⚠️ `Bangers` ليس متوفراً افتراضياً على أنظمة Windows و macOS — لا بديل رسمي له.
> **لضمان نفس الشكل دائماً:** نزّل الملفات محلياً:

```bash
# خيارات:
# 1. انسخ مجلد public/ كامل من الموقع الأصلي (فيه كل الخطوط إن وُجدت)
# 2. أو حمّل من Google Fonts وحطها في public/fonts/
```

```css
@font-face {
  font-family: 'Bangers';
  src: url('/fonts/Bangers-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
```

---

## 3. Design Tokens

كل الألوان المستخدمة، من مصدرها:

### 3.1 متغيرات CSS (الاستخدام الموحّد)

```css
:root {
  color-scheme: dark;
  --kick: #FF2D2D;                              /* الأحمر الأساسي — اللون المميز */
  --neon: #53FC18;                              /* الأخضر — للـ LIVE فقط */
  --ease: cubic-bezier(0.16, 1, 0.3, 1);        /* منحنى الحركة الرئيسي */
}
```

**`--ease` هو السر.** كل حركة في الموقع تستخدم `cubic-bezier(0.16, 1, 0.3, 1)` —
هذا منحنى "expo out" يعطي الإحساس بالسرعة ثم التوقف الناعم. لا تستبدله بـ `ease` عادي.

### 3.2 الألوان في Tailwind

```js
colors: {
  kick:   { DEFAULT: '#FF2D2D', dark: '#C41E1E', glow: 'rgba(255,45,45,0.5)' },
  neon:   { DEFAULT: '#53FC18', dim: '#3ecb10' },
  accent: { red: '#FF2D2D', deep: '#1A0000', gold: '#FFD700' },
  ink:    { 950: '#050505', 900: '#0a0a0a', 800: '#101010', 700: '#161616' },
}
```

### 3.3 جدول مرجعي سريع

| الاستخدام | القيمة |
|---|---|
| خلفية الصفحة | `#050505` |
| النصوص الأساسية | `#ffffff` |
| النصوص الثانوية | `text-white/65` |
| النصوص الضعيفة | `text-white/40` |
| اللون المميز (أزرار/إطارات/خطوط) | `#FF2D2D` |
| تدرّج الزر الأساسي | `from-[#ff4d4d] to-[#FF2D2D]` |
| أخضر البث المباشر | `#53FC18` |
| حدود الزجاج | `rgba(255,255,255,0.10)` |
| `theme-color` (شريط المتصفح) | `#FF2D2D` |
| اختيار النص | خلفية `#FF2D2D` + نص `#000` |

### 3.4 Pseudo-elements

```css
* { -webkit-tap-highlight-color: transparent; }

html {
  scroll-behavior: smooth;
  overflow-x: hidden;   /* يمنع القفز الأفقي على الجوال */
}

body {
  background: #050505;
  overflow-x: hidden;
}

::selection { background: #FF2D2D; color: #000; }

::-webkit-scrollbar { width: 10px; }
::-webkit-scrollbar-track { background: #080808; }
::-webkit-scrollbar-thumb {
  background: linear-gradient(#FF2D2D, #7a0e0e);
  border-radius: 99px;
  border: 2px solid #080808;
}
```

---

## 4. tailwind.config.js — كامل

انسخ **حرفياً**:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./index.tsx",
    "./App.tsx",
    "./components/**/*.{ts,tsx}",
    "./services/**/*.{ts,tsx}",
    "./utils/**/*.{ts,tsx}",
    "./api/**/*.{ts,tsx}",
    "./supabaseClient.ts",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"Tajawal"', 'sans-serif'],
        heading: ['"Outfit"', '"Cairo"', '"Tajawal"', 'sans-serif'],
        arabic: ['"Tajawal"', '"Cairo"', 'sans-serif'],
        cairo: ['"Cairo"', '"Tajawal"', 'sans-serif'],
        gaming: ['"Bangers"', 'cursive'],
      },
      colors: {
        kick: { DEFAULT: '#FF2D2D', dark: '#C41E1E', glow: 'rgba(255,45,45,0.5)' },
        neon: { DEFAULT: '#53FC18', dim: '#3ecb10' },
        accent: { red: '#FF2D2D', deep: '#1A0000', gold: '#FFD700' },
        ink: { 950: '#050505', 900: '#0a0a0a', 800: '#101010', 700: '#161616' },
      },
      gridTemplateColumns: {
        15: 'repeat(15, minmax(0, 1fr))',
        20: 'repeat(20, minmax(0, 1fr))',
        30: 'repeat(30, minmax(0, 1fr))',
        60: 'repeat(60, minmax(0, 1fr))',
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.7s cubic-bezier(0.16,1,0.3,1) forwards',
        'fade-in': 'fadeIn 0.8s ease forwards',
        'slide-down': 'slideDown 0.4s cubic-bezier(0.16,1,0.3,1) forwards',
        'spin-slow': 'spin 9s linear infinite',
        'spin-slower': 'spin 18s linear infinite',
        'gradient-x': 'gradientX 4s ease infinite',
        'charge': 'charge 0.45s cubic-bezier(0.4,0,0.2,1) forwards',
        'shine-periodic': 'shinePeriodic 5.5s cubic-bezier(0.4,0,0.2,1) infinite',
        'float': 'floatY 7s ease-in-out infinite',
        'float-soft': 'floatSoft 5s ease-in-out infinite',
        'pulse-red': 'pulseRed 2.2s ease-in-out infinite',
        'pulse-slow': 'pulse 3.5s cubic-bezier(0.4,0,0.6,1) infinite',
        'marquee': 'marquee 28s linear infinite',
        'marquee-rev': 'marqueeRev 32s linear infinite',
        'aurora': 'aurora 14s ease-in-out infinite alternate',
        'glitch': 'glitchFx 0.35s steps(2) infinite',
        'tick': 'tickGlow 1.6s ease-in-out infinite',
        'ring-orbit': 'spin 7s linear infinite',
      },
      keyframes: {
        fadeInUp: {
          '0%':   { opacity: '0', transform: 'translateY(26px) scale(0.99)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideDown: {
          '0%':   { opacity: '0', transform: 'translateY(-12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        gradientX: {
          '0%,100%': { 'background-position': '0% 50%' },
          '50%':     { 'background-position': '100% 50%' },
        },
        charge: { '0%': { width: '0%', opacity: '1' }, '100%': { width: '100%', opacity: '0' } },
        shinePeriodic: {
          '0%':   { transform: 'translateX(-160%) skewX(-18deg)', opacity: '0' },
          '8%':   { opacity: '1' },
          '22%':  { transform: 'translateX(160%) skewX(-18deg)', opacity: '0' },
          '100%': { transform: 'translateX(160%) skewX(-18deg)', opacity: '0' },
        },
        floatY: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%':     { transform: 'translateY(-18px)' },
        },
        floatSoft: {
          '0%,100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%':     { transform: 'translateY(-10px) rotate(1deg)' },
        },
        pulseRed: {
          '0%,100%': { opacity: '1',   filter: 'drop-shadow(0 0 6px #FF2D2D)' },
          '50%':     { opacity: '0.75', filter: 'drop-shadow(0 0 22px #FF2D2D)' },
        },
        marquee:    { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(50%)' } },
        marqueeRev: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        aurora: {
          '0%':   { transform: 'translate(-6%, -2%) scale(1)',    opacity: '0.7' },
          '50%':  { transform: 'translate(5%, 4%) scale(1.12)',     opacity: '1' },
          '100%': { transform: 'translate(-3%, 6%) scale(1.05)',    opacity: '0.8' },
        },
        glitchFx: {
          '0%':   { transform: 'translate(0)' },
          '25%':  { transform: 'translate(-2px,1px)' },
          '50%':  { transform: 'translate(2px,-1px)' },
          '75%':  { transform: 'translate(-1px,-2px)' },
          '100%': { transform: 'translate(0)' },
        },
        tickGlow: {
          '0%,100%': { boxShadow: '0 0 0 0 rgba(255,45,45,0.5)' },
          '50%':     { boxShadow: '0 0 0 7px rgba(255,45,45,0)' },
        },
      },
    },
  },
  plugins: [],
};
```

### 4.1 تنبيهات مهمة

- **لا يوجد** `boxShadow` ولا `backgroundImage` في الإعدادات.
  كل الظلال والتدرجات مكتوبة كـ **arbitrary values** داخل الـ classes، مثل:
  `shadow-[0_0_35px_rgba(255,45,45,0.45)]`
- **لا يوجد** `@font-face` — الخطوط كلها من CDN.
- `spin` و `pulse` غير معرّفة في `keyframes` أعلاه؛ `spin` معرّفة في `styles.css` و `pulse` من Tailwind نفسه.
- لا تحذف أي `animation` حتى لو لم تستخدمه — الاسم قد يظهر لاحقاً.

---

## 5. postcss.config.js

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

---

## 6. styles.css — الملف الكامل

انسخ هذا الملف **كما هو** إلى مشروعك كـ `styles.css`، واستورده في `index.tsx`:

```tsx
import './styles.css';
```

### 6.1 الملف الكامل (verbatim)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* ============================================================
   iABS — Design tokens
   ============================================================ */
:root {
  color-scheme: dark;
  --kick: #FF2D2D;
  --neon: #53FC18;
  --ease: cubic-bezier(0.16, 1, 0.3, 1);
}

* { -webkit-tap-highlight-color: transparent; }

html {
  scroll-behavior: smooth;
  /* يمنع القفز الأفقي على الجوال */
  overflow-x: hidden;
}

body {
  background: #050505;
  overflow-x: hidden;
}

::selection { background: #FF2D2D; color: #000; }

::-webkit-scrollbar { width: 10px; }
::-webkit-scrollbar-track { background: #080808; }
::-webkit-scrollbar-thumb { background: linear-gradient(#FF2D2D, #7a0e0e); border-radius: 99px; border: 2px solid #080808; }

/* ============================================================
   Backgrounds
   ============================================================ */
.responsive_bg {
  background-image: url('/bg-mobile.jpg');
  background-size: cover;
  background-position: center top;
  background-repeat: no-repeat;
  /* صورة الخلفية ما تحتاج إعادة رسم */
  will-change: auto;
}
@media (min-width: 768px) {
  .responsive_bg { background-image: url('/bg-pc.jpg'); }
}

.grain::after {
  content: "";
  position: fixed;
  inset: 0;
  z-index: 5;
  pointer-events: none;
  opacity: 0.06;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}

.grid-lines {
  background-image: linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px);
  background-size: 56px 56px;
  mask-image: radial-gradient(ellipse 90% 70% at 50% 0%, black 30%, transparent 75%);
  -webkit-mask-image: radial-gradient(ellipse 90% 70% at 50% 0%, black 30%, transparent 75%);
}

/* ============================================================
   Text stroke
   ============================================================ */
.text-stroke { -webkit-text-stroke: 1.5px rgba(255,255,255,0.22); color: transparent; }
.text-stroke-red { -webkit-text-stroke: 1.5px rgba(255,45,45,0.65); color: transparent; }
@media (min-width: 768px) {
  .text-stroke, .text-stroke-red { -webkit-text-stroke-width: 2px; }
}

/* ============================================================
   Glass — أخف على الجوال (blur أقل + بدون طبقة إضافية)
   ============================================================ */
.glass {
  background: rgba(12, 12, 12, 0.72);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
.glass-soft {
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

/* ============================================================
   Reveal on scroll
   ============================================================ */
.reveal {
  opacity: 0;
  transform: translateY(30px) scale(0.995);
  transition: opacity 0.7s var(--ease), transform 0.7s var(--ease);
}
.reveal.is-visible { opacity: 1; transform: translateY(0) scale(1); }

@media (prefers-reduced-motion: reduce) {
  .reveal { opacity: 1; transform: none; transition: none; }
  *, *::before, *::after {
    animation-duration: 0.001s !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001s !important;
  }
  html { scroll-behavior: auto; }
}

/* ============================================================
   Components
   ============================================================ */
.glitch-active { animation: glitchFx 0.35s steps(2) infinite; filter: brightness(1.25) contrast(1.15); }

/* نبض ناعم (أيقونة البوت في نافذة الشات) */
@keyframes breathe {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.06); opacity: 0.85; }
}
.animate-breathe { animation: breathe 2.4s ease-in-out infinite; }

.card-sheen { position: relative; overflow: hidden; }
.card-sheen::before {
  content: "";
  position: absolute;
  top: -60%;
  bottom: -60%;
  width: 45%;
  left: -60%;
  z-index: 2;
  pointer-events: none;
  background: linear-gradient(105deg, transparent, rgba(255,255,255,0.14), transparent);
  transform: skewX(-18deg);
  animation: shinePeriodic 5.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}

.btn-arena {
  position: relative;
  isolation: isolate;
  transition: transform 0.2s var(--ease), box-shadow 0.2s, background 0.2s;
}
.btn-arena:hover { transform: translateY(-2px); }
.btn-arena:active { transform: translateY(1px) scale(0.99); }
.btn-arena:focus-visible,
a:focus-visible,
button:focus-visible { outline: 2px solid #FF2D2D; outline-offset: 3px; border-radius: 12px; }

.profile-3d-ring {
  position: absolute;
  inset: -14px;
  border-radius: 9999px;
  border: 1px solid transparent;
  border-top-color: rgba(255, 45, 45, 0.9);
  border-bottom-color: rgba(255, 45, 45, 0.9);
  animation: spin 6s linear infinite;
  pointer-events: none;
  opacity: 0.55;
}
.profile-3d-ring-inner {
  position: absolute;
  inset: -7px;
  border-radius: 9999px;
  border: 1px dashed rgba(255, 45, 45, 0.35);
  animation: spin 13s linear infinite reverse;
  pointer-events: none;
}
.profile-scanner {
  position: absolute;
  inset: 0;
  height: 22%;
  width: 100%;
  top: -22%;
  background: linear-gradient(to bottom, transparent, rgba(255, 45, 45, 0.35), transparent);
  animation: scanMove 3.6s linear infinite;
  pointer-events: none;
  z-index: 20;
}
@keyframes scanMove {
  0% { top: -22%; opacity: 0; }
  12% { opacity: 1; }
  88% { opacity: 1; }
  100% { top: 104%; opacity: 0; }
}
@keyframes spin { to { transform: rotate(360deg); } }

.tech-corner { position: absolute; width: 14px; height: 14px; border-color: #FF2D2D; opacity: 0.7; z-index: 25; }
.tech-corner-tl { top: -6px; left: -6px; border-top-width: 2px; border-left-width: 2px; }
.tech-corner-tr { top: -6px; right: -6px; border-top-width: 2px; border-right-width: 2px; }
.tech-corner-bl { bottom: -6px; left: -6px; border-bottom-width: 2px; border-left-width: 2px; }
.tech-corner-br { bottom: -6px; right: -6px; border-bottom-width: 2px; border-right-width: 2px; }

.marquee-mask {
  mask-image: linear-gradient(to right, transparent, black 8%, black 92%, transparent);
  -webkit-mask-image: linear-gradient(to right, transparent, black 8%, black 92%, transparent);
}
.scrollbar-hide::-webkit-scrollbar { display: none; }
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }

/* Theater chat scrollbar */
.theater-scroll { scrollbar-width: thin; scrollbar-color: rgba(255,45,45,0.65) rgba(255,255,255,0.04); scroll-behavior: auto; }
.theater-scroll::-webkit-scrollbar { width: 6px; }
.theater-scroll::-webkit-scrollbar-track { background: transparent; border-radius: 99px; margin: 12px 0; }
.theater-scroll::-webkit-scrollbar-thumb {
  background: linear-gradient(to bottom, #ff6b6b, #FF2D2D 45%, #7a0e0e);
  border-radius: 99px;
  box-shadow: 0 0 10px rgba(255, 45, 45, 0.45);
}
.theater-scroll::-webkit-scrollbar-thumb:hover { background: linear-gradient(to bottom, #ff8585, #FF2D2D 45%, #a31212); }

@keyframes chat-in {
  0% { opacity: 0; transform: translateY(10px) scale(0.99); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
.chat-msg { animation: chat-in 0.3s var(--ease) both; }
@media (prefers-reduced-motion: reduce) { .chat-msg { animation: none; } }

@keyframes live-ring {
  0% { box-shadow: 0 0 0 0 rgba(83, 252, 24, 0.55); }
  70% { box-shadow: 0 0 0 9px rgba(83, 252, 24, 0); }
  100% { box-shadow: 0 0 0 0 rgba(83, 252, 24, 0); }
}
.live-dot { animation: live-ring 1.8s ease-out infinite; }
.perspective-1000 { perspective: 1200px; }
.clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

/* Bars grow */
.tier-bar {
  transform-origin: bottom;
  transform: scaleY(0);
  animation: tier-grow 0.8s var(--ease) forwards;
}
@keyframes tier-grow {
  0% { transform: scaleY(0); }
  60% { transform: scaleY(1.04); }
  100% { transform: scaleY(1); }
}
.bar-grow {
  transform: scaleX(0);
  animation: bar-grow 0.9s var(--ease) forwards;
}
@keyframes bar-grow {
  0% { transform: scaleX(0); }
  100% { transform: scaleX(1); }
}

/* ============================================================
   Hero watermark "iABS" — الأصل كما كان بالضبط:
   دخول متتابع + موجة طفو + لمعة زاحفة + هالة خلفية
   (نفس الشكل الأصلي حرفياً، بدون أي إضافة)
   ============================================================ */
.wm-mark::before {
  content: "";
  position: absolute;
  inset: -12% -6%;
  background: radial-gradient(ellipse 55% 45% at 50% 55%, rgba(255, 45, 45, 0.28), transparent 70%);
  filter: blur(30px);
  animation: wm-aura 4.5s ease-in-out infinite;
  pointer-events: none;
}
@keyframes wm-aura {
  0%, 100% { opacity: 0.55; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.08); }
}

.wm-stroke {
  color: transparent;
  -webkit-text-stroke: 2px rgba(255, 70, 70, 0.9);
  paint-order: stroke fill;
}
@media (min-width: 768px) { .wm-stroke { -webkit-text-stroke-width: 2.5px; } }

.wm-depth { position: absolute; inset: 0; display: block; pointer-events: none; color: transparent; paint-order: stroke fill; user-select: none; }
.wm-depth-1 { transform: translate(3px, 3px); -webkit-text-stroke: 2px rgba(255, 45, 45, 0.22); }
.wm-depth-2 { transform: translate(7px, 7px); -webkit-text-stroke: 2px rgba(255, 45, 45, 0.10); }

/* دخول متتابع + موجة طفو (كما كان الأصل) */
.wm-letter {
  display: inline-block;
  opacity: 0;
  animation: wm-in 0.6s var(--ease) forwards, wm-wave 4s ease-in-out infinite;
  will-change: opacity, transform;
}
.wm-mark .wm-letter:nth-child(1) { animation-delay: 0ms, 0ms; }
.wm-mark .wm-letter:nth-child(2) { animation-delay: 90ms, 0.45s; }
.wm-mark .wm-letter:nth-child(3) { animation-delay: 180ms, 0.9s; }
.wm-mark .wm-letter:nth-child(4) { animation-delay: 270ms, 1.35s; }

@keyframes wm-in {
  0% { opacity: 0; transform: translateY(18px) scale(0.97); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes wm-wave {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-7px) rotate(-1deg); }
}

.wm-mark:hover .wm-stroke { color: rgba(255, 45, 45, 0.14); -webkit-text-stroke-color: rgba(255, 90, 90, 1); }
.wm-sheen {
  position: absolute;
  inset: 0;
  display: block;
  color: transparent;
  background: linear-gradient(100deg, transparent 30%, rgba(255, 255, 255, 0.55) 46%, rgba(255, 120, 120, 0.6) 50%, rgba(255, 255, 255, 0.55) 54%, transparent 70%);
  background-size: 280% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  animation: wm-sheen 4.5s ease-in-out infinite;
  pointer-events: none;
}
@keyframes wm-sheen {
  0% { background-position: 130% 0; }
  55%, 100% { background-position: -130% 0; }
}

/* ============================================================
   60-DAY CHALLENGE
   ============================================================ */
.d60-ring { transform-origin: 50% 50%; transform-box: view-box; }
.d60-bar-fill { transition: width 0.9s var(--ease); }

/* ============================================================
   =====  PERFORMANCE GUARDS  =====
   أخفف التأثيرات الثقيلة على الجوال — نفس الشكل، أداء أسرع
   ============================================================ */
@media (max-width: 767px) {
  /* backdrop-filter مع كل عنصر = طبقة GPU لكل عنصر. نقلّلها كلها على الجوال */
  html, html * {
    --tw-backdrop-blur: 5px;
    --tw-backdrop-blur-sm: 5px;
    --tw-backdrop-blur-md: 6px;
    --tw-backdrop-blur-lg: 7px;
    --tw-backdrop-blur-xl: 7px;
    --tw-backdrop-blur-2xl: 8px;
    --tw-backdrop-blur-3xl: 10px;
  }
  /* كل التوهجات صارت تدرّجات شعاعية بدون فلتر — لا حاجة لتعطيل أي blur */

  .glass { backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
  .glass-soft { backdrop-filter: none; -webkit-backdrop-filter: none; background: rgba(255, 255, 255, 0.055); }
  .card-sheen::before { animation: none; opacity: 0; }
  .grain::after { display: none; }
  .profile-scanner { animation-duration: 5s; }
  .live-dot { animation: none; }
}

@media (hover: none) {
  .btn-arena:hover { transform: none; }
}

/* منع الحركات لما المستخدم ما يبيها */
@media (prefers-reduced-motion: reduce) {
  .card-sheen::before,
  .profile-3d-ring,
  .profile-3d-ring-inner,
  .profile-scanner,
  .wm-mark::before,
  .wm-sheen,
  .wm-letter,
  .live-dot { animation: none !important; opacity: 1 !important; }
}

/* صور: منع القفز عند التحميل */
img { max-width: 100%; }
```

---

## 7. index.html — الهيكل

### 7.1 الـ head الحرج

```html
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0" />

  <title>iABS Official | محمد القحطاني - البث المباشر وملك القبول</title>
  <meta name="theme-color" content="#FF2D2D">

  <!-- preload صور الخلفية -->
  <link rel="preload" as="image" href="/bg-mobile.jpg" media="(max-width: 767px)" fetchpriority="high">
  <link rel="preload" as="image" href="/bg-pc.jpg" media="(min-width: 768px)" fetchpriority="high">
  <link rel="preload" as="image" href="/favicon-192.png" fetchpriority="high">

  <!-- الخطوط: أوزان أقل + preconnect -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Outfit:wght@800;900&family=Tajawal:wght@500;700;900&family=Bangers&display=swap">
  <link
    href="https://fonts.googleapis.com/css2?family=Outfit:wght@800;900&family=Tajawal:wght@500;700;900&family=Bangers&display=swap"
    rel="stylesheet" media="print" onload="this.media='all'">
  <noscript>
    <link
      href="https://fonts.googleapis.com/css2?family=Outfit:wght@800;900&family=Tajawal:wght@500;700;900&family=Bangers&display=swap"
      rel="stylesheet">
  </noscript>
</head>
```

### 7.2 Critical boot CSS (داخل `<head>`)

هذا يمنع الوميض الأبيض (FOUC) قبل تحميل الـ JS:

```html
<style>
  :root { color-scheme: dark; }
  html { scroll-behavior: smooth; overflow-x: hidden; }
  body {
    background: #050505; color: #fff; margin: 0;
    overflow-x: hidden;
    font-family: "Tajawal", Tahoma, Arial, sans-serif;
  }
  .responsive_bg {
    background-image: url('/bg-mobile.jpg');
    background-size: cover; background-position: center top; background-repeat: no-repeat;
  }
  @media (min-width: 768px) { .responsive_bg { background-image: url('/bg-pc.jpg'); } }
  .reveal { opacity: 0; transform: translateY(30px) scale(0.995); }
  .reveal.is-visible { opacity: 1; transform: none; }
  @keyframes bootspin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) {
    .reveal { opacity: 1; transform: none; }
  }
</style>
```

### 7.3 شاشة التحميل (Boot placeholder)

ضعها **داخل `<div id="root">`** — هذا يحمي من شاشة بيضاء لو فشل تحميل JS:

```html
<body class="bg-black text-white overflow-x-hidden antialiased">
  <div id="root">
    <div style="min-height:100vh;display:flex;flex-direction:column;gap:14px;align-items:center;justify-content:center;background:#050505;color:#fff;font-family:Tahoma,Arial,sans-serif">
      <div style="width:44px;height:44px;border-radius:50%;border:3px solid rgba(255,255,255,.15);border-top-color:#FF2D2D;animation:bootspin 1s linear infinite"></div>
      <div style="font-size:14px;font-weight:bold">جارِ تحميل iABS...</div>
    </div>
  </div>
  <script type="module" src="/index.tsx"></script>
</body>
```

**مواصفات الـ spinner:**

| الخاصية | القيمة |
|---|---|
| الحجم | `44px × 44px` |
| الشكل | `border-radius: 50%` |
| المسار | `3px solid rgba(255,255,255,.15)` |
| الجزء الملوّن | `border-top-color: #FF2D2D` |
| الحركة | `bootspin 1s linear infinite` |
| حجم النص | `14px` / `font-weight: bold` |

---

## 8. طبقة الخلفية (Arena Background)

هذه الطبقة تعطي إحساس "الساحة/الأرينا". بدونها التصميم يفقد 80% من شكله.

### 8.1 التركيب (من الأسفل للأعلى)

| الطبقة | Selector | الدور |
|---|---|---|
| 0 | حاوية `fixed inset-0 z-0` + `bg-[#050505]` | الأساس |
| 1 | `.responsive_bg scale-105 opacity-60` | صورة الخلفية (`bg-pc.jpg` / `bg-mobile.jpg`) |
| 2 | `bg-gradient-to-b from-black/70 via-black/55 to-[#050505]` | تعتيم متدرج لتوحيد الألوان |
| 3 | `.grid-lines opacity-70` | شبكة 56px مع mask شعاعي |
| 4 | 3 دوائر `animate-aurora` | هالات ضوئية حمراء/خضراء |
| 5 | `<canvas>` بـ `opacity-80` | جسيمات متحركة |
| 6 | تدرّج شعاعي أخير | تعتيم الأطراف |

### 8.2 المكوّن الجاهز (verbatim)

```tsx
const ArenaBackground: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) return;

        const isMobile = window.matchMedia('(max-width: 767px)').matches;
        // الجسيمات أقل على الجوال + إطار أبطأ = بطارية وسرعة
        const MIN_DT = isMobile ? 50 : 33; // ~20fps جوال / ~30fps ديسكتوب
        const DPR = Math.min(window.devicePixelRatio || 1, isMobile ? 1 : 1.5);

        let raf = 0;
        let running = true;
        let scrolling = false;
        let scrollTimer = 0;
        let last = 0;
        let w = 0;
        let h = 0;

        type P = { x: number; y: number; r: number; vy: number; vx: number; a: number; red: boolean };
        let parts: P[] = [];

        /* --- Glowing balls are pre-rendered once into a sprite ---
           (shadowBlur on every frame is one of the most expensive operations in canvas) */
        const makeSprite = (core: string, glow: string) => {
            const size = 64;
            const c = document.createElement('canvas');
            c.width = c.height = size;
            const g = c.getContext('2d')!;
            const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
            grd.addColorStop(0, core);
            grd.addColorStop(0.18, core);
            grd.addColorStop(0.42, glow);
            grd.addColorStop(1, 'rgba(0,0,0,0)');
            g.fillStyle = grd;
            g.fillRect(0, 0, size, size);
            return c;
        };
        const spriteRed = makeSprite('rgba(255,90,90,0.95)', 'rgba(255,45,45,0.35)');
        const spriteWhite = makeSprite('rgba(255,255,255,0.85)', 'rgba(255,255,255,0.12)');

        const resize = () => {
            w = window.innerWidth;
            h = window.innerHeight;
            canvas.width = Math.round(w * DPR);
            canvas.height = Math.round(h * DPR);
            canvas.style.width = `${w}px`;
            canvas.style.height = `${h}px`;
            ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
            const n = Math.min(isMobile ? 30 : 52, Math.floor(w / 30));
            parts = Array.from({ length: n }, () => ({
                x: Math.random() * w, y: Math.random() * h,
                r: 0.8 + Math.random() * 2.4,
                vy: -(0.15 + Math.random() * 0.55), vx: (Math.random() - 0.5) * 0.25,
                a: 0.18 + Math.random() * 0.55, red: Math.random() > 0.72,
            }));
        };

        const draw = (now: number) => {
            raf = requestAnimationFrame(draw);
            // يتوقف الرسم كلياً أثناء التمرير النشط — التمرير أولاً، والجسيمات بعده
            if (!running || scrolling) { last = now; return; }
            if (now - last < MIN_DT) return;
            last = now;

            ctx.clearRect(0, 0, w, h);
            for (const p of parts) {
                p.y += p.vy;
                p.x += p.vx;
                if (p.y < -8) { p.y = h + 8; p.x = Math.random() * w; }
                if (p.x < -8) p.x = w + 8;
                if (p.x > w + 8) p.x = -8;

                const s = p.r * 10;
                ctx.globalAlpha = p.a;
                ctx.drawImage(p.red ? spriteRed : spriteWhite, p.x - s / 2, p.y - s / 2, s, s);
            }
            ctx.globalAlpha = 1;
        };

        /* --- Stop completely when the tab is hidden: saves battery + CPU --- */
        const onVisibility = () => {
            running = document.visibilityState === 'visible';
            last = 0;
        };

        resize();
        window.addEventListener('resize', resize, { passive: true });
        document.addEventListener('visibilitychange', onVisibility);
        const onScroll = () => {
            scrolling = true;
            window.clearTimeout(scrollTimer);
            scrollTimer = window.setTimeout(() => { scrolling = false; last = 0; }, 220);
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        raf = requestAnimationFrame(draw);

        return () => {
            cancelAnimationFrame(raf);
            window.clearTimeout(scrollTimer);
            window.removeEventListener('resize', resize);
            window.removeEventListener('scroll', onScroll);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, []);
    return (
        <div className="fixed inset-0 z-0 bg-[#050505] overflow-hidden" aria-hidden="true">
            <div className="absolute inset-0 responsive_bg scale-105 opacity-60" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/55 to-[#050505]" />
            <div className="absolute inset-0 grid-lines opacity-70" />
            {/* Glowing circles using radial gradients (no blur filter) — same look, much cheaper */}
            <div className="absolute -top-40 right-[-10%] w-[55vw] h-[55vw] max-w-[720px] max-h-[720px] rounded-full animate-aurora"
                style={{ background: 'radial-gradient(circle, rgba(255,45,45,0.26) 0%, rgba(255,45,45,0.11) 38%, transparent 68%)' }} />
            <div className="absolute top-[30%] left-[-12%] w-[42vw] h-[42vw] max-w-[560px] max-h-[560px] rounded-full animate-aurora"
                style={{ animationDelay: '-6s', background: 'radial-gradient(circle, rgba(255,45,45,0.14) 0%, rgba(255,45,45,0.06) 38%, transparent 68%)' }} />
            <div className="absolute bottom-[-20%] right-[20%] w-[36vw] h-[36vw] max-w-[480px] max-h-[480px] rounded-full animate-aurora"
                style={{ animationDelay: '-3s', background: 'radial-gradient(circle, rgba(83,252,24,0.08) 0%, rgba(83,252,24,0.035) 38%, transparent 68%)' }} />
            <canvas ref={canvasRef} className="absolute inset-0 opacity-80" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,transparent_40%,rgba(0,0,0,0.55)_100%)]" />
        </div>
    );
};
```

### 8.3 مواصفات الجسيمات (للتحكم الدقيق)

| المعامل | ديسكتوب | جوال |
|---|---|---|
| عدد الجسيمات | `min(52, w/30)` | `min(30, w/30)` |
| الإطار الأدنى | `33ms` (~30fps) | `50ms` (~20fps) |
| `devicePixelRatio` | `min(dpr, 1.5)` | `min(dpr, 1)` |
| نصف قطر الجسيم | `0.8 – 3.2px` × 10 للحجم | نفس |
| الشفافية | `0.18 – 0.73` | نفس |
| احتمال اللون الأحمر | `> 0.72` (~28%) | نفس |
| إيقاف أثناء التمرير | `220ms` بعد آخر scroll | نفس |
| إيقاف عند إخفاء التبويب | نعم | نعم |

### 8.4 تأثير الـ Grain

مطبّق على **الجذر** فقط:

```html
<div class="grain relative min-h-screen">
```

يعمل عبر `::after` بـ SVG noise مدمج (`feTurbulence baseFrequency="0.9" numOctaves="3"`) — بدون ملف صورة خارجي.

---

## 9. قسم الهيرو

### 9.1 الغلاف الخارجي

```html
<!-- الجذر: grain + RTL -->
<div class="grain relative min-h-screen font-arabic">

  <!-- الخلفية -->
  <ArenaBackground />

  <!-- المحتوى -->
  <div class="relative z-10 max-w-[1200px] mx-auto px-3 sm:px-4 md:px-8">
    ...
  </div>
</div>
```

### 9.2 الـ Markup الحرفي للهيرو

```jsx
{/* ===== HERO ===== */}
<section id="top" className="pt-6 md:pt-10 pb-6 md:pb-8 overflow-clip">
    <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-8 lg:gap-10 items-center justify-items-center lg:justify-items-stretch">

        {/* ---------- العمود الأيسر: النصوص (في RTL يظهر يمين) ---------- */}
        <div className="animate-fade-in-up w-full max-w-xl text-center lg:text-start order-2 lg:order-1">

            {/* شارة الحالة */}
            <div className="inline-flex items-center gap-2.5 rounded-full border border-[#FF2D2D]/35 bg-[#FF2D2D]/[0.08] px-4 py-1.5 mb-5">
                <span className={`w-2 h-2 rounded-full shrink-0 ${streamInfo.isLive ? 'bg-[#53FC18] animate-pulse shadow-[0_0_10px_#53FC18]' : 'bg-[#FF2D2D] animate-pulse shadow-[0_0_10px_#FF2D2D]'}`} />
                <span className="text-[10px] md:text-xs font-black tracking-[0.18em] text-white/80 uppercase">{t.eyebrow}</span>
            </div>

            {/* الاسم */}
            <p className="text-white/45 font-bold text-xs sm:text-sm md:text-base mb-2">
                {t.nameAr} • <span dir="ltr" className="text-white/30">MOHAMMED AL-QAHTANI</span>
            </p>

            {/* ===== علامة iABS ===== */}
            <h1 className="wm-mark relative font-gaming leading-none tracking-wide select-none text-[clamp(96px,24vw,180px)] lg:text-[180px]" dir="ltr" aria-label="iABS">
                <span aria-hidden="true" className="wm-depth wm-depth-1 font-gaming leading-none tracking-wide">iABS</span>
                <span aria-hidden="true" className="wm-depth wm-depth-2 font-gaming leading-none tracking-wide">iABS</span>
                <span aria-hidden="true" className="relative z-10">
                    <span className="wm-letter wm-stroke">i</span><span className="wm-letter wm-stroke">A</span><span className="wm-letter wm-stroke">B</span><span className="wm-letter wm-stroke">S</span>
                </span>
                <span aria-hidden="true" className="wm-sheen font-gaming leading-none tracking-wide z-20">iABS</span>
            </h1>

            {/* الشعار الفرعي */}
            <p className="font-gaming text-xl sm:text-2xl md:text-4xl text-stroke mt-1 tracking-wide" dir="ltr" aria-hidden="true">KING OF ACCEPTANCE</p>

            {/* النبذة */}
            <p className="text-white/65 text-[15px] md:text-lg leading-relaxed max-w-xl mt-4 md:mt-5 font-medium mx-auto lg:mx-0">{t.bio}</p>

            {/* الوسوم */}
            <div className="flex flex-wrap justify-center lg:justify-start gap-2 sm:gap-2.5 mt-4 md:mt-5">
                {t.tags.map((tag, i) => (
                    <span key={i} className="px-3.5 sm:px-4 py-1.5 rounded-full bg-white/[0.05] border border-white/10 text-[11px] sm:text-xs font-bold text-white/75">#{tag}</span>
                ))}
            </div>

            {/* الأزرار */}
            <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 mt-6 md:mt-7">
                <a href="https://kick.com/iabs" target="_blank" rel="noopener noreferrer"
                    className="btn-arena inline-flex items-center justify-center gap-2.5 px-7 py-4 sm:py-3.5 rounded-2xl bg-gradient-to-b from-[#ff4d4d] to-[#FF2D2D] text-black font-black text-[15px] md:text-base shadow-[0_0_35px_rgba(255,45,45,0.45)] active:scale-[0.98]">
                    <svg className="w-5 h-5 fill-current shrink-0" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                    {t.watchLive}
                </a>
                <a href="https://discord.com/invite/64aggJ9yRA" target="_blank" rel="noopener noreferrer"
                    className="btn-arena inline-flex items-center justify-center gap-2.5 px-7 py-4 sm:py-3.5 rounded-2xl bg-white/[0.06] border border-white/15 text-white font-black text-[15px] md:text-base active:scale-[0.98]">
                    <DiscordIcon className="w-5 h-5 shrink-0" />
                    {t.joinDiscord}
                </a>
            </div>

            {/* إحصائيات مصغّرة */}
            <div className="grid grid-cols-3 w-full gap-2 sm:gap-3 mt-6 md:mt-8">
                {[
                    { v: socialStats['KICK'] || '—', l: t.statsKick },
                    { v: visitorCount > 0 ? visitorCount.toLocaleString() : '—', l: t.statsViews },
                    { v: '8', l: t.statsPlatforms },
                ].map((s, i) => (
                    <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur px-2 sm:px-4 py-3 sm:py-3.5 text-center min-w-0">
                        <p className="text-lg sm:text-xl md:text-2xl font-black text-white truncate" dir="ltr">{s.v}</p>
                        <p className="text-[9px] md:text-[10px] font-bold text-white/40 uppercase tracking-widest mt-1 truncate">{s.l}</p>
                    </div>
                ))}
            </div>
        </div>

        {/* ---------- العمود الثاني: الصورة الشخصية ---------- */}
        <div className="flex justify-center lg:justify-start animate-fade-in w-full order-1 lg:order-2" style={{ animationDelay: '150ms' }}>
            <div className="relative mx-6 sm:mx-8" onMouseEnter={() => setIsHoveringProfile(true)} onMouseLeave={() => setIsHoveringProfile(false)}>
                <div className="profile-3d-ring" />
                <div className="profile-3d-ring-inner" />
                <div className="tech-corner tech-corner-tl" /><div className="tech-corner tech-corner-tr" />
                <div className="tech-corner tech-corner-bl" /><div className="tech-corner tech-corner-br" />
                <div className="relative w-48 h-48 sm:w-64 sm:h-64 md:w-72 md:h-72 rounded-full overflow-hidden border-2 border-white/15 shadow-[0_0_70px_rgba(255,45,45,0.3)] bg-black transition-transform duration-500 hover:scale-[1.03]">
                    <div className="profile-scanner" />
                    <img src={branding.profileImage} alt="iABS - Mohammed Al-Qahtani official profile" className={`w-full h-full object-cover transition-transform duration-700 ${isHoveringProfile ? 'scale-110 rotate-1' : ''}`} loading="eager" />
                    <div className="absolute inset-0 shadow-[inset_0_0_40px_rgba(0,0,0,0.75)] pointer-events-none" />
                </div>
                <div className="absolute -bottom-2 -end-1 z-20">
                    <div className="relative w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center">
                        <div className="absolute inset-0 bg-[#53FC18] rounded-2xl blur-lg opacity-40 animate-pulse" />
                        <div className="relative w-full h-full bg-black rounded-2xl border border-[#53FC18]/60 flex items-center justify-center rotate-6">
                            <KickIcon className="w-6 h-6 sm:w-7 sm:h-7 text-[#53FC18] -rotate-6" />
                        </div>
                    </div>
                </div>
                <div className={`absolute -top-2 -start-2 sm:-start-4 glass border rounded-2xl px-3 py-2 shadow-xl animate-float-soft max-w-[150px] ${streamInfo.isLive ? 'border-[#53FC18]/40' : 'border-white/10'}`}>
                    <p className="text-[8px] sm:text-[9px] font-black tracking-widest text-white/40 uppercase">{streamInfo.isLive ? (lang === 'en' ? 'WATCHING' : 'مشاهد') : (lang === 'en' ? 'STATUS' : 'الحالة')}</p>
                    <p className={`text-xs sm:text-sm font-black truncate ${streamInfo.isLive ? 'text-[#53FC18]' : 'text-white/70'}`} dir="ltr">
                        {streamInfo.isLive ? `${streamInfo.viewers.toLocaleString()} ${t.viewers}` : t.statusOffline}
                    </p>
                </div>
                <div className="absolute top-1/3 -end-2 md:-end-10 glass border border-[#FF2D2D]/30 rounded-2xl px-3 py-2 shadow-xl animate-float hidden min-[420px]:block" style={{ animationDelay: '-2s' }}>
                    <p className="text-[8px] sm:text-[9px] font-black tracking-widest text-[#FF2D2D] uppercase" dir="ltr">KICK</p>
                    <p className="text-xs sm:text-sm font-black text-white" dir="ltr">{socialStats['KICK']}</p>
                </div>
            </div>
        </div>
    </div>
</section>
```

### 9.3 نصوص الهيرو (للنسخ الحرفي)

| المفتاح | العربية | English |
|---|---|---|
| `eyebrow` | ملك القبول والاستمرارية لحياة أفضل | — |
| `nameAr` | محمد القحطاني | Mohammed Al-Qahtani |
| `bio` | (نص تعريفي — انسخه من `App.tsx`) | — |
| `tags` | `ألعاب`, `سوالف`, `بث يومي` | — |
| `watchLive` | شاهد البث الآن | Watch Live |
| `joinDiscord` | انضم للديسكورد | Join Discord |
| `statsKick` | متابع كيك | Kick Followers |
| `statsViews` | زيارة | Visits |
| `statsPlatforms` | منصات | Platforms |
| `statusOffline` | غير متصل | Offline |

### 9.4 ملاحظات الـ Layout (حرجة)

**Grid:**
```
lg:grid-cols-[1.15fr_0.85fr]   ← أعمدة غير متساوية، لا تغيّرها
gap-8 lg:gap-10
items-center
justify-items-center lg:justify-items-stretch
```

**الترتيب (responsive):**
| الشاشة | ترتيب النصوص | ترتيب الصورة |
|---|---|---|
| موبايل (`< lg`) | `order-2` (الأسفل) | `order-1` (الأعلى) |
| ديسكتوب (`>= lg`) | `order-1` (يمين في RTL) | `order-2` (يسار) |

**حجم خط iABS:**
```
text-[clamp(96px,24vw,180px)]  ← موبايل: 96px → 24vw
lg:text-[180px]                ← ديسكتوب: ثابت 180px
```

**احترام RTL:**
- `dir="ltr"` على `<h1>` و `KING OF ACCEPTANCE`
- `dir="ltr"` على كل الأرقام والإحصائيات
- `-start-*` / `-end-*` بدل `left` / `right` (Tailwind 3.3+ logical properties)

---

## 10. تشريح علامة iABS — 5 طبقات

هذه **أهم لقطة في التصميم**. لو كسرت أي طبقة = شكل مختلف تماماً.

### 10.1 الترتيب من الخلف للأمام

```
┌─ الطبقة 0: الهالة (wm-mark::before) ─────────────┐
│  radial-gradient أحمر + blur(30px) + تنفّس 4.5s    │
├─ الطبقة 1: العمق البعيد (wm-depth-2) ─────────────┤
│  translate(7px, 7px) + stroke rgba(255,45,45,.10)  │
├─ الطبقة 2: العمق القريب (wm-depth-1) ─────────────┤
│  translate(3px, 3px) + stroke rgba(255,45,45,.22)  │
├─ الطبقة 3: الحروف (wm-letter × 4) ────────────────┤
│  stroke rgba(255,70,70,.9) + دخول متتابع + طفو    │
│  z-10                                             │
├─ الطبقة 4: اللمعة الزاحفة (wm-sheen) ─────────────┤
│  background-clip:text + تدرّج يتحرك 4.5s          │
│  z-20                                             │
└────────────────────────────────────────────────────┘
```

### 10.2 لماذا هذا يعمل

| الطبقة | القيمة |
|---|---|
| **الهالة** | `filter: blur(30px)` + `radial-gradient(ellipse 55% 45% at 50% 55%, rgba(255,45,45,.28), transparent 70%)` + `inset: -12% -6%` |
| **wm-stroke** | `-webkit-text-stroke: 2px` (2.5px على `>=768px`)، `color: transparent` |
| **wm-depth-1** | `translate(3px, 3px)` — يعطي إحساس "الحفر" |
| **wm-depth-2** | `translate(7px, 7px)` — ظل أبعد وأخفت |
| **`paint-order`** | `stroke fill` — يرسم الحد أولاً ثم التعبئة |
| **`select-none`** | يمنع تحديد النص بالماوس عند التحويم |

### 10.3 التوقيتات (الحرف × 4)

| الحرف | `wm-in` delay | `wm-wave` delay |
|---|---|---|
| `i` | `0ms` | `0ms` |
| `A` | `90ms` | `0.45s` |
| `B` | `180ms` | `0.9s` |
| `S` | `270ms` | `1.35s` |

> الحرف يدخل كل `90ms` عن سابقه. الموجة تتأخر `450ms` لكل حرف،
> فيصبح عند Permanente الأربع في أوقات مختلفة — يعطي إحساس "الموجة".

### 10.4 اللمعة الزاحفة (wm-sheen)

```css
background: linear-gradient(100deg,
    transparent 30%,
    rgba(255, 255, 255, 0.55) 46%,
    rgba(255, 120, 120, 0.6) 50%,
    rgba(255, 255, 255, 0.55) 54%,
    transparent 70%);
background-size: 280% 100%;
-webkit-background-clip: text;
background-clip: text;
animation: wm-sheen 4.5s ease-in-out infinite;
```

```css
@keyframes wm-sheen {
  0% { background-position: 130% 0; }
  55%, 100% { background-position: -130% 0; }
}
```

**النتيجة:** شريط أبيض يتحرك من اليمين لليسار مرة واحدة كل 4.5 ثانية، ثم يتوقف (لأن `55%` و `100%` متطابقان).

### 10.5 Hover

```css
.wm-mark:hover .wm-stroke {
    color: rgba(255, 45, 45, 0.14);
    -webkit-text-stroke-color: rgba(255, 90, 90, 1);
}
```

### 10.6 KING OF ACCEPTANCE

```jsx
<p className="font-gaming text-xl sm:text-2xl md:text-4xl text-stroke mt-1 tracking-wide" dir="ltr" aria-hidden="true">
  KING OF ACCEPTANCE
</p>
```

- `.text-stroke` → حد أبيض `1.5px` (`2px` على `>=768px`) بتعتيم `0.22`، والتعبئة شفافة
- `aria-hidden="true"` → يمنع قارئ الشاشة من قراءة الكلمة (لأن `h1` يقول iABS)

---

## 11. بطاقة الصورة الشخصية

### 11.1 الطبقات

| العنصر | الموضع | الحجم | الحركة |
|---|---|---|---|
| `profile-3d-ring` | `inset: -14px` | يتبع الصورة | `spin 6s linear infinite` |
| `profile-3d-ring-inner` | `inset: -7px` | يتبع الصورة | `spin 13s linear infinite reverse` |
| `tech-corner` ×4 | `-6px` من الزوايا | `14×14px` | ثابت |
| الصورة | — | `w-48→sm:64→md:72` | `hover:scale-[1.03]` (500ms) |
| `profile-scanner` | يمر فوق الصورة | `height: 22%` | `scanMove 3.6s linear infinite` |
| شارة Kick | `-bottom-2 -end-1` | `w-12→sm:14` | `animate-pulse` على التوهج |
| شارة الحالة | `-top-2 -start-2` | `max-w-[150px]` | `animate-float-soft` (5s) |
| شارة KICK | `top-1/3 -end-2` | مخفي تحت 420px | `animate-float` (7s), delay `-2s` |

### 11.2 حلقات الدوران

```css
.profile-3d-ring {
  border: 1px solid transparent;
  border-top-color:    rgba(255, 45, 45, 0.9);
  border-bottom-color: rgba(255, 45, 45, 0.9);
  opacity: 0.55;
}
.profile-3d-ring-inner {
  border: 1px dashed rgba(255, 45, 45, 0.35);
}
```

> **السر:** الحد الخارجي فقط (أعلى + أسفل) ملوّن → تبدو كـ "دائرة تدور" لا كنقطة.

### 11.3 الماسح (Scanner)

```css
.profile-scanner {
  position: absolute;
  inset: 0;
  height: 22%;
  width: 100%;
  top: -22%;
  background: linear-gradient(to bottom, transparent, rgba(255,45,45,0.35), transparent);
  animation: scanMove 3.6s linear infinite;
  z-index: 20;
}
@keyframes scanMove {
  0%   { top: -22%; opacity: 0; }
  12%  { opacity: 1; }
  88%  { opacity: 1; }
  100% { top: 104%;  opacity: 0; }
}
```

> `z-index: 20` يجعله فوق الصورة. بدونها الماسح يختفي خلف `<img>`.

### 11.4 زوايا HUD

```css
.tech-corner { position: absolute; width: 14px; height: 14px; border-color: #FF2D2D; opacity: 0.7; z-index: 25; }
.tech-corner-tl { top: -6px; left: -6px; border-top-width: 2px; border-left-width: 2px; }
/* نفس النمط لـ tr, bl, br */
```

### 11.5 الـ Vignette الداخلي

```jsx
<div className="absolute inset-0 shadow-[inset_0_0_40px_rgba(0,0,0,0.75)] pointer-events-none" />
```

يعطي ظلاً داخلياً حول الصورة الدائرية → يعزلها عن الخلفية. → 

---

## 12. مكونات مشتركة

### 12.1 Reveal (الظهور عند التمرير)

```tsx
const Reveal: React.FC<{ children: React.ReactNode; delay?: number; className?: string; as?: 'div' | 'section' }> = ({ children, delay = 0, className = '' }) => {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (typeof IntersectionObserver === 'undefined') { el.classList.add('is-visible'); return; }
        const obs = new IntersectionObserver((entries) => {
            entries.forEach((e) => { if (e.isIntersecting) { el.classList.add('is-visible'); obs.disconnect(); } });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
        obs.observe(el);
        return () => obs.disconnect();
    }, []);
    return <div ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>;
};
```

**الاستخدام:** `<Reveal delay={120}>...</Reveal>`

| المعامل | القيمة |
|---|---|
| `threshold` | `0.12` (12% من العنصر يظهر) |
| `rootMargin` | `0px 0px -40px 0px` (يتأخر 40px قبل التشغيل) |
| مدة الانتقال | `0.7s var(--ease)` |
| بداية الحركة | `translateY(30px) scale(0.995)` |
| `obs.disconnect()` | يوقف المراقب بعد أول ظهور |

### 12.2 SectionHeading (عنوان القسم)

```tsx
const SectionHeading: React.FC<{ no: string; title: string; sub?: string; en?: string }> = ({ no, title, sub, en }) => (
    <div className="flex items-end gap-3 md:gap-4 mb-6 md:mb-9">
        <span className="font-gaming text-3xl sm:text-4xl md:text-6xl leading-none text-stroke-red select-none shrink-0" dir="ltr">{no}</span>
        <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl sm:text-2xl md:text-4xl font-black tracking-tight text-white">{title}</h2>
                {en && <span className="hidden sm:inline text-[10px] font-bold tracking-[0.3em] text-white/30 uppercase" dir="ltr">{en}</span>}
            </div>
            {sub && <p className="text-[13px] md:text-sm text-white/50 mt-1 font-medium">{sub}</p>}
            <div className="mt-2.5 md:mt-3 h-px w-full bg-gradient-to-l from-[#FF2D2D]/60 via-white/10 to-transparent" />
        </div>
    </div>
);
```

**التفاصيل:**
- الرقم (`01`, `02`...) بـ `font-gaming` + `text-stroke-red` = حد أحمر بلا تعبئة
- الخط الفاصل: `h-px` بتدرّج `from-[#FF2D2D]/60 via-white/10 to-transparent` (من اليسار في RTL)
- `tracking-[0.3em]` للاسم الإنجليزي الصغير

### 12.3 Marquee (الشريط المتحرك)

```tsx
const Marquee: React.FC<{ lang: Language }> = ({ lang }) => {
    const items = lang === 'ar'
        ? ['بث يومي مباشر', 'ملك القبول', 'مجتمع الأساطير', 'تفاعل لا يتوقف', 'جوائز ودروبس', 'ألعاب وتحديات', 'سوالف وفعاليات']
        : ['DAILY LIVE', 'KING OF ACCEPTANCE', 'LEGENDS COMMUNITY', 'NONSTOP HYPE', 'DROPS & REWARDS', 'GAMES & CHALLENGES', 'CHATTING & EVENTS'];
    const row = [...items, ...items];
    return (
        <div className="relative -mx-3 sm:-mx-4 md:-mx-8 overflow-hidden border-y border-white/10 bg-black/75 marquee-mask" dir="ltr" aria-hidden="true">
            <div className="flex w-max animate-marquee gap-0 py-2.5 md:py-3">
                {row.map((t, i) => (
                    <span key={i} className="flex items-center gap-6 px-6 whitespace-nowrap text-[12px] md:text-sm font-black tracking-[0.25em] text-white/60">
                        <span className={i % 2 ? 'text-white/60' : 'text-[#FF2D2D]'}>{t}</span>
                        <span className="w-1.5 h-1.5 rotate-45 bg-[#FF2D2D]/70 inline-block" />
                    </span>
                ))}
            </div>
        </div>
    );
};
```

**السر في الحيلة:**
- `row = [...items, ...items]` — **تكرار القائمة مرتين**
- الحركة `translateX(50%)` — تساوي عرض النسخة الواحدة بالضبط
- النتيجة: حركة لانهائية سلسة بدون "قفزة"
- `w-max` ضروري — بدونه يتقيد بعرض الحاوية
- `marquee-mask` يخفي الطرفين بتدرّج
- `-mx-*`Negative يجعله يمتد خارج الـ container

**المعنى:** `28s linear infinite` لدورة كاملة.

### 12.4 DeferredMount (تحميل مؤجل)

```tsx
const DeferredMount: React.FC<{ children: React.ReactNode; rootMargin?: string; minHeight?: number }> = ({ children, rootMargin = '700px', minHeight = 220 }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [show, setShow] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (typeof IntersectionObserver === 'undefined') { setShow(true); return; }
        const obs = new IntersectionObserver(
            (entries) => { if (entries.some(e => e.isIntersecting)) { setShow(true); obs.disconnect(); } },
            { rootMargin, threshold: 0 }
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, [rootMargin]);
    return <div ref={ref} className="h-full" style={show ? undefined : { minHeight }}>{show ? children : null}</div>;
};
```

> يحمّل كود القسم فقط عندما يقترب الزائر منه بـ `700px` (لتحسين السرعة).

---

## 13. ترتيب أقسام الصفحة الرئيسية

| # | القسم | `id` | دالة القسم | دالة عند البث المباشر |
|---|---|---|---|---|
| 0 | الجذر `grain relative min-h-screen` | — | — | — |
| 1 | `<ArenaBackground/>` | — | `fixed inset-0 z-0` | — |
| 2 | الحاوية `relative z-10 max-w-[1200px]` | — | — | — |
| 3 | **Header / Nav** (sticky) | — | دائماً | دائماً |
| 4 | **تحدي 60 يوم** `<Challenge60/>` | `challenge60` | دائماً | دائماً |
| 5 | **HERO** | `top` | دائماً | دائماً |
| 6 | `<Marquee/>` | — | دائماً | دائماً |
| 7 | **السوشيال Bento** | `socials` | `01` | `01` |
| 8 | **المسرح المباشر** (بث + شات) | `live` | **مخفي** | `02` |
| 9 | **مقر المجتمع** (ديسكورد + يوتيوب) | — | `02` | `03` |
| 10 | **الدعم / التبرع** `<SupportArena/>` | `support` | `03` | `04` |
| 11 | **المودريتورز** `<ModeratorsSection/>` | `moderators` | `04` | `05` |
| 12 | **الاستطلاع (Poll)** | — | عند وجوده | عند وجوده |
| 13 | **تقرير آخر جلسة** | — | **عند عدم البث** | مخفي |
| 14 | **الرعاة + اللقطات** | — | دائماً | دائماً |
| 15 | **الجدول + الأسئلة الشائعة** | `schedule` | حسب الإعدادات | حسب الإعدادات |
| 16 | **الإحصائيات + أساطير الشات** | — | دائماً | دائماً |
| 17 | **Footer** | — | دائماً | دائماً |
| 18 | `<AIChat/>` (بوت عائم) | — | دائماً | دائماً |

### 13.1 الـ Header

```tsx
<div className="relative z-10 max-w-[1200px] mx-auto px-3 sm:px-4 md:px-8">
```

يحتوي على (من اليمين لليسار في RTL):
- شعار iABS
- نقطة `LIVE` نابضة
- `Challenge60Mini` (حلقة تقدم صغيرة + "DAY n / 60")
- روابط التنقل (اختفت على الموبايل)
- زر تحديث
- مبدّل `AR / EN`

---

## 14. كتالوج كل الأنيميشن

### 14.1 Keyframes من `tailwind.config.js`

| الاسم | المدة / التكرار | الاستخدام |
|---|---|---|
| `fadeInUp` | `0.7s cubic-bezier(0.16,1,0.3,1) forwards` | عمود النصوص في الهيرو، الكروت |
| `fadeIn` | `0.8s ease forwards` | عمود الصورة (delay `150ms`) |
| `slideDown` | `0.4s cubic-bezier(0.16,1,0.3,1) forwards` | القوائم المنسدلة |
| `gradientX` | `4s ease infinite` | تدرّج متحرك |
| `charge` | `0.45s cubic-bezier(0.4,0,0.2,1) forwards` | شحن البطاريات |
| `shinePeriodic` | `5.5s cubic-bezier(0.4,0,0.2,1) infinite` | لمعة `card-sheen` |
| `floatY` | `7s ease-in-out infinite` | شارة KICK |
| `floatSoft` | `5s ease-in-out infinite` | شارة الحالة |
| `pulseRed` | `2.2s ease-in-out infinite` | توهج أحمر نابض |
| `pulse` (Tailwind) | `3.5s cubic-bezier(0.4,0,0.6,1) infinite` | `animate-pulse-slow` |
| `pulse` (Tailwind) | `2s cubic-bezier(0.4,0,0.6,1) infinite` | `animate-pulse` القياسي |
| `marquee` | `28s linear infinite` | الشريط المتحرك → `translateX(50%)` |
| `marqueeRev` | `32s linear infinite` | عكس الاتجاه |
| `aurora` | `14s ease-in-out infinite alternate` | هالات الخلفية |
| `glitchFx` | `0.35s steps(2) infinite` | Cards عند التحويم |
| `tickGlow` | `1.6s ease-in-out infinite` | نبضة-box |
| `spin` | `9s / 18s / 7s linear infinite` | حلقات varied |

### 14.2 Keyframes من `styles.css`

| الاسم | المدة | الاستخدام |
|---|---|---|
| `breathe` | `2.4s ease-in-out infinite` | أيقونة البوت |
| `scanMove` | `3.6s linear infinite` | ماسح الصورة (`5s` على الجوال) |
| `spin` | `6s / 13s linear infinite` | حلقتا الصورة (الثانية reverse) |
| `chat-in` | `0.3s var(--ease) both` | رسائل الشات |
| `live-ring` | `1.8s ease-out infinite` | النقطة الخضراء (موقوفة على الجوال) |
| `tier-grow` | `0.8s var(--ease) forwards` | أعمدة الأuther |
| `bar-grow` | `0.9s var(--ease) forwards` | أشرطة النمو |
| `wm-aura` | `4.5s ease-in-out infinite` | هالة علامة iABS |
| `wm-in` | `0.6s var(--ease) forwards` | دخول حروف iABS |
| `wm-wave` | `4s ease-in-out infinite` | طفو حروف iABS |
| `wm-sheen` | `4.5s ease-in-out infinite` | اللمعة الزاحفة |

### 14.3 Transitions (بدون keyframes)

| العنصر | الانتقال |
|---|---|
| `.reveal` | `opacity .7s, transform .7s var(--ease)` |
| `.btn-arena` | `transform .2s var(--ease), box-shadow .2s, background .2s` |
| صورة البروفايل | `duration-500 hover:scale-[1.03]` |
| الصورة عند التحويم | `duration-700 scale-110 rotate-1` |
| الأزرار | `active:scale-[0.98]` |
| `.d60-bar-fill` | `width .9s var(--ease)` |
| `html` | `scroll-behavior: smooth` |

### 14.4 Hover states

```css
.btn-arena:hover       { transform: translateY(-2px); }
.btn-arena:active      { transform: translateY(1px) scale(0.99); }
.wm-mark:hover .wm-stroke { stroke-color: rgba(255,90,90,1); fill: rgba(255,45,45,.14); }
.theater-scroll::-webkit-scrollbar-thumb:hover { /* تدرّج أفتح */ }
```

```html
:focus-visible { outline: 2px solid #FF2D2D; outline-offset: 3px; border-radius: 12px; }
```

---

## 15. حارس الأداء و reduced-motion

### 15.1 على الجوال (`max-width: 767px`)

**المظهر يبقى نفس** — فقط الأداء يتحسّن:

| العنصر | التغيير |
|---|---|
| كل `--tw-backdrop-blur-*` | مخفّضة إلى `5px–10px` |
| `.glass` | `blur(12px)` → `blur(8px)` |
| `.glass-soft` | `backdrop-filter: none` + خلفية `rgba(255,255,255,0.055)` |
| `.card-sheen::before` | `animation: none; opacity: 0` |
| `.grain::after` | `display: none` |
| `.profile-scanner` | `3.6s` → `5s` |
| `.live-dot` | `animation: none` |
| `[hover: none]` | `.btn-arena:hover { transform: none }` |

### 15.2 reduced-motion

```css
@media (prefers-reduced-motion: reduce) {
  .reveal { opacity: 1; transform: none; transition: none; }
  *, *::before, *::after {
    animation-duration: 0.001s !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001s !important;
  }
  html { scroll-behavior: auto; }
}

@media (prefers-reduced-motion: reduce) {
  .card-sheen::before,
  .profile-3d-ring,
  .profile-3d-ring-inner,
  .profile-scanner,
  .wm-mark::before,
  .wm-sheen,
  .wm-letter,
  .live-dot { animation: none !important; opacity: 1 !important; }
}
```

**للاختبار:** Chrome DevTools → `Ctrl+Shift+M` → `Rendering` → `Emulate CSS prefers-reduced-motion: reduce`

**في JS:**
```js
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; // تخطَّ الكانفاس
```

### 15.3 قائمة الأداء الإضافية

| التقنية | الفائدة |
|---|---|
| `loading="eager"` على صورة البروفايل | لأنها LCP — لا تأجلها |
| `preload` لصور الخلفية بـ `media` | تحميل مسبق للجوال والديسكتوب |
| `media="print" onload="this.media='all'"` للخطوط | تحميل غير معطِّل |
| `will-change: opacity, transform` على `.wm-letter` | ترفع الطبقة قبل الحركة |
| `will-change: auto` على `.responsive_bg` | لا ترفع طبقة لصورة ثابتة |
| sprite pre-render للجسيمات | بدل `shadowBlur` كل إطار |
| DPR cap (`1.5` / `1`) | يمنع اللوحة الضخمة على شاشات 4K |
| `passive: true` للـ listeners | لا يعطّل التمرير |
| إيقاف `requestAnimationFrame` عند إخفاء التبويب | توفير بطارية |
| إيقاف الرسم أثناء التمرير (`220ms`) | تمرير سلس |
| `lazy()` للمكوّنات الثقيلة | تقليل الحزمة الأولى |

---

## 16. الأصول (Assets) المطلوبة

انسخها إلى `public/` في مشروعك الجديد:

### 16.1 مطلوبة للهوية البصرية

| الملف | الحجم | الاستخدام | إلزامي |
|---|---|---|---|
| `bg-pc.jpg` | 86 KB | خلفية الديسكتوب (`>=768px`) | ✅ نعم |
| `bg-mobile.jpg` | 62 KB | خلفية الجوال (`<768px`) | ✅ نعم |
| `favicon-192.png` | 62 KB | أيقونة 192 | ✅ نعم |
| `favicon-32.png` | 8.6 KB | أيقونة 32 | ✅ نعم |
| `favicon.png` | 183 KB | الأيقونة الأساسية | ✅ نعم |
| `apple-touch-icon.png` | 55 KB | أيقونة iOS | ✅ نعم |

### 16.2 اختيارية

| الملف | الاستخدام |
|---|---|
| `channels4_banner.jpg` | بانر صفحة GitHub / README |
| `og-cover.jpg` | صورة OpenGraph |
| `og-badge.png` | شارة OpenGraph |
| `creators-mark.png` | علامة صنّاع المحتوى |
| `discord-banner.jpg` | بانر بطاقة الديسكورد |
| `streamlabs-mark.png` | شعار Streamlabs |
| `ai-icon.png` | أيقونة البوت |
| `ps5-console.png` / `ps5-dualsense.png` |usanFAB giveaway |

**نسخ سريع:**
```bash
# من مشروعك الجديد — للقراءة فقط من المشروع الأصلي
copy "C:\Users\MOH\Documents\GG\iABS_AR-main (1)\iABS_AR-main\public\*" "C:\Users\MOH\Documents\GG\iabs-clone\public\"
```

> هذا **قراءة فقط** — الموقع الأصلي لا يتأثر نهائياً.

### 16.3 الصورة الشخصية (`branding.profileImage`)

هذه من قاعدة البيانات (Supabase) في الموقع الأصلي، أو من `public/favicon.png` كبديل.

```html
<img src="/favicon.png" alt="iABS" class="w-full h-full object-cover" />
```

> **شرط المطابقة:** الصورة **مربعة** و**عالية الدقة** (الأفضل `512×512` أو أعلى).
> لأنها تُعرض داخل دائرة بـ `object-cover`، فأي نسبة غير مربعة ستُقصّ.

---

## 17. قائمة تحقق للمطابقة

استخدم هذه القائمة **للتأكد** أن نسختك مطابقة.

### 17.1 الخطوط

- [ ] روابط Google Fonts بالضبط (Outfit + Tajawal + Bangers + Cairo)
- [ ] النمط `media="print" onload="this.media='all'"` موجود
- [ ] `preconnect` لـ `fonts.googleapis.com` و `fonts.gstatic.com`
- [ ] **Bangers** يظهر على `iABS` و `KING OF ACCEPTANCE` و أرقام الأقسام
- [ ] **Tajawal** يظهر على كل النص العربي
- [ ] لا يوجد وميض خط بديل عند أول تحميل
- [ ] (اختياري) `Bangers` محمّل محلياً لضمان الشكل دائماً

### 17.2 الألوان

- [ ] `#050505` خلفية الصفحة
- [ ] `#FF2D2D` اللون المميز في كل مكان
- [ ] `#53FC18` أخضر البث فقط
- [ ] `::selection` = خلفية `#FF2D2D` + نص `#000`
- [ ] scrollbar بتدرّج أحمر
- [ ] `theme-color` = `#FF2D2D`

### 17.3 علامة iABS

- [ ] 5 طبقات موجودة (هالة + عمقان + حروف + لمعة)
- [ ] الحروف 4 منفصلة (`.wm-letter`)
- [ ] التوقيتات `0/90/180/270ms` صحيحة
- [ ] `-webkit-text-stroke` = `2px` (2.5px على `>=768px`)
- [ ] `wm-depth-1` = `translate(3px,3px)`
- [ ] `wm-depth-2` = `translate(7px,7px)`
- [ ] `wm-sheen` يتحرك `4.5s` بـ `background-clip: text`
- [ ] `wm-mark::before` بالهالة + `blur(30px)`
- [ ] `dir="ltr"` على `<h1>`
- [ ] الحجم: `clamp(96px,24vw,180px)` → `lg:180px`
- [ ] Hover يغيّر لون الحد إلى `rgba(255,90,90,1)`

### 17.4 الهيرو

- [ ] Grid = `lg:grid-cols-[1.15fr_0.85fr]`
- [ ] ترتيب `order` صحيح على الموبايل والديسكتوب
- [ ] `animate-fade-in-up` على النصوص
- [ ] `animate-fade-in` + `delay: 150ms` على الصورة
- [ ] الزر الأساسي بتدرّج `from-[#ff4d4d] to-[#FF2D2D]` + `shadow-[0_0_35px_rgba(255,45,45,0.45)]`
- [ ] الزر الثانوي `bg-white/[0.06] border-white/15`
- [ ] `btn-arena` على الاثنين
- [ ] 3 بطاقات إحصائية بـ `backdrop-blur`

### 17.5 الصورة الشخصية

- [ ] `profile-3d-ring` يدور `6s`
- [ ] `profile-3d-ring-inner` يدور `13s reverse`
- [ ] `profile-scanner` يمر `3.6s`
- [ ] 4 `tech-corner` ظاهرة
- [ ] `shadow-[0_0_70px_rgba(255,45,45,0.3)]` على الدائرة
- [ ] `shadow-[inset_0_0_40px_rgba(0,0,0,0.75)]` داخلياً
- [ ] شارة Kick مع `rotate-6` / `-rotate-6`
- [ ] شارة الحالة بـ `animate-float-soft`
- [ ] شارة KICK بـ `animate-float` + `delay: -2s` ومخفية تحت `420px`
- [ ] `hover:scale-110 rotate-1` على الصورة

### 17.6 الخلفية

- [ ] صورة `bg-pc.jpg` / `bg-mobile.jpg` مع `media` breakpoint عند `768px`
- [ ] `.grid-lines` بشبكة `56px` + mask شعاعي
- [ ] 3 دوائر `animate-aurora` بتأخيرات `0 / -6s / -3s`
- [ ] `<canvas>` يعمل بـ 52/30 جسيم
- [ ] `.grain` على الجذر
- [ ] `fixed inset-0 z-0`

### 17.7 الأقسام

- [ ] `SectionHeading` بالرقم + `text-stroke-red`
- [ ] الخط الفاصل `from-[#FF2D2D]/60 via-white/10 to-transparent`
- [ ] `Marquee` بتكرار `2×` + `animate-marquee` + `marquee-mask`
- [ ] `Reveal` يعمل على كل قسم

### 17.8 الأداء

- [ ] critical CSS في `<head>`
- [ ] boot placeholder داخل `#root`
- [ ] `preload` لصور الخلفية
- [ ] `loading="eager"` لصورة البروفايل
- [ ] reduced-motion مدعوم
- [ ] حارس الجوال مفعّل
- [ ] Lighthouse ≥ 90

### 17.9 RTL

- [ ] `<html lang="ar" dir="rtl">`
- [ ] `font-arabic` على الجذر
- [ ] `dir="ltr"` على النصوص اللاتينية والأرقام
- [ ] `start`/`end` بدل `left`/`right`
- [ ] لا يوجد أي قفز أفقي (horizontal scroll)

---

## أخطاء شائعة وحلولها

| العَرَض | السبب | الحل |
|---|---|---|
| الخط يظهر مختلف | الحِمل لم يكتمل أو النمط غير متزامن | تأكد من `media="print" onload` + `display=swap` |
| وميض عند أول رسم | critical CSS ناقص | انسخ §7.2 كاملاً |
| `iABS` بدون ظل/عمق | `wm-*` غير مُعرَّفة | انسخ §6.1 كاملاً |
| الحروف لا تدخل بالترتيب | `nth-child` لا يطابق | تأكد أن الحروف الـ4 **مباشرة داخل** نفس الأب |
| اللمعة لا تظهر | `background-clip: text` غير مدعوم | أضف `-webkit-background-clip` (موجود) |
| الصورة قديمة/مcipared | `prefers-reduced-motion` مفعّل | أطفئه من DevTools للاختبار |
| الشريط يقفز | القائمة غير مكررة | `row = [...items, ...items]` |
| هالات ضوئية تُرهق الجهاز | `blur` بدل تدرّج شعاعي | استخدم `radial-gradient` بدون `filter` |
| الجسيمات ثقيلة على الجوال | DPR كبير | خفّض `DPR` إلى `1` |
| تمرير غير سلس | `backdrop-filter` كثير | طبّق حارس الجوال §15.1 |
| الألوان تختلف قليلاً | استنساخ يدوي | انسخ القيم حرفياً من §3 |

---

## الخلاصة

**المطابقة الكاملة تتحقق بـ 7 عناصر فقط:**

1. ✅ **الخطوط** (§2) — Bangers + Tajawal + Outfit + Cairo بنفس الأوزان
2. ✅ **الألوان** (§3) — `#FF2D2D` / `#53FC18` / `#050505` + `cubic-bezier(0.16,1,0.3,1)`
3. ✅ **الخلفية** (§8) — صورة + شبكة + 3 هالات + كانفاس جسيمات
4. ✅ **علامة iABS** (§10) — 5 طبقات بتوقيتات `0/90/180/270ms`
5. ✅ **أنيميشن مربّط الصورة** (§11) — `6s` / `13s reverse` / `3.6s`
6. ✅ **CSS الكامل** (§6) — انسخه حرفياً
7. ✅ **Tailwind config** (§4) — انسخه حرفياً

> **تذكير أخير:** هذا الدليل للمعلومات فقط.
> نفّذ كل شيء في **مشروع جديد مستقل** — لا تلمس أي ملف في `iABS_AR-main`.

---

*هذا التوثيق لا يحتوي على أي تغيير على الموقع الأصلي.*
*كل ما فيه نسخ من القيم الموجودة في ملفات المشروع للرجوع إليها.*
