# iCG1 — ساحة الألعاب التفاعلية على Kick

موقع ألعاب جماعية مباشرة لمجتمع قناة Kick: فوازير، مافيا، سيف كود، كراسي موسيقية، مسابقات ونقاط ولوحة متصدرين.

- الموقع المباشر: https://icg1.vercel.app/
- المستودع: https://github.com/huuu68430-sketch/iCG1

## التشغيل محليًا

```bash
npm install
npm run dev     # http://localhost:5000
```

انسخ `.env.example` إلى `.env` واملأ القيم (لا ترفع `.env` إلى GitHub أبدًا).

## النشر على Vercel

1. ادخل إلى vercel.com ← **Add New → Project** واختر المستودع `huuu68430-sketch/iCG1`.
2. الإعدادات (تُضبط تلقائيًا من `vercel.json`، لكن تحقق منها):
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
   - **Root Directory**: `./`
3. من **Settings ← Environment Variables** أضف متغيرات الإنتاج (نفس أسماء `.env.example`).
4. **Deploy**. الرابط المتوقع: `https://icg1.vercel.app/`

## بعد النشر (SEO)

1. افتح `https://icg1.vercel.app/sitemap.xml` للتأكد أنه يعمل.
2. Google Search Console ← **Sitemaps** ← أرسل: `https://icg1.vercel.app/sitemap.xml`
3. اطلب فهرسة الصفحة الرئيسية (IndexNow عبر Search Console ← URL Inspection ← Request indexing).
4. لاحظ: الأرشفة التدريجية تستغرق أيامًا إلى أسابيع، وسرعة الموقع + المحتوى العربي هي ما يرفع الترتيب — ليست كل شيء دفعة واحدة.

## الأمان — ملاحظات مهمة

- **إبطال التوكن المسرب**: كان رابط `origin` القديم في إعدادات Git يحتوي توكن GitHub (`ghp_…`) ظاهرًا. إذا كان التوكن حيًّا، أبطله الآن من github.com ← Settings ← Developer settings ← Personal access tokens. المستودع الجديد نظيف.
- **RLS في Supabase**: تأكد أن جدول `app_config` **لا يسمح** بقراءة `anon` (وإلا يمكن لأي شخص قراءة كلمة سر الإدارة من الشبكة). يجب أن تكون القراءة عبر `service_role` فقط (دوال `/api`)، وأن تكون سياسات `app_config` مرفوضة للعامة. هذا أهم إعداد أمني خارج الكود.
- **قيّد مفاتيح API بنطاق الموقع**: من لوحة Google Cloud (قيود HTTP referrers ← `icg1.vercel.app`) ولوحة Pexels، حتى لو ظهر المفتاح في الحزمة لا يمكن استخدامه من خارج موقعك.
- **كلمات السر**: تُخزّن بـ scrypt؛ الحسابات القديمة بـ SHA-256 تُرقّى تلقائيًا عند أول دخول.

## البنية

- `api/` — دوال خادم (Vercel Serverless): تسجيل دخول، جلسات HttpOnly، إدارة، CSRF، Rate-Limit.
- `components/` — واجهات الألعاب واللوحات.
- `public/` — الأصول الثابتة، `robots.txt`، `sitemap.xml`، `site.webmanifest`.
