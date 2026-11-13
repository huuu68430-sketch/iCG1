# دخول العضو ودخول الإدارة — بعد التصحيح

## المشكلة التي كانت موجودة

لما العضو يسجّل دخول أو ينشئ حسابه، كان الموقع يوديه على **ساحة الألعاب** (`/home`)
بدل صفحته الخاصة. وفي المقابل، كلمة سر الإدارة كانت تُقرأ من جدول
`app_config` داخل المتصفح — أي أن أي زائر كان يقدر يقرأها ( بل يغيّرها ) بالمفتاح
المنشور في حزمة الموقع، فيدخل لوحة التحكم. ولهذا كان الخلط بين «صفحة العضو»
و«الإدارة» وارداً.

## القاعدة الجديدة

| من يدخل | إلى أين | من يثبّت ذلك |
|---|---|---|
| عضو (اسم كيك + كلمة سر) | **صفحة العضو** `/user-dashboard` | السيرفر: `POST /api/auth/login` (كوكي `icg1_session` + صفّ جلسة في `sessions`) |
| عضو من رابط غرفة/لعبة | نفس اللعبة | الرابط (`?r=CODE` / `?cn=CODE` / `?view=`) |
| إدارة (كلمة سر الإدارة) | **لوحة التحكم** `/admin-panel` | السيرفر: `POST /api/admin/login` (كوكي `icg1_admin` + جلسة مشرف) |
| مستضيف (كلمة سر المضيف) | صفحة المضيف `/#/host` | السيرفر: `POST /api/auth/config-check` (نعم/لا فقط) |

الدور لم يعد يُشتق من `localStorage` وحده: التخزين المحلي علامةُ تنفيس فقط،
والصلاحية الحقيقية في كوكي `HttpOnly` يمنحه السيرفر فقط.

## ما تغيّر في الشيفرة

* `components/GlobalPasswordPage.tsx`
  * دخول العضو: `POST /api/auth/login` بدل قراءة `users.password_hash` من المتصفح.
  * إنشاء الحساب: `POST /api/auth/register` بدل `insert` مباشر في `users`.
  * بوابة الإدارة: `POST /api/admin/login` (جلسة مشرف حقيقية).
  * بوابة المستضيف: `POST /api/auth/config-check`.
  * لم يعد المتصفح يقرأ `app_config` أبداً.
* `App.tsx`: بعد الدخول — العضو ⇒ `USER_DASHBOARD`، الإدارة ⇒ `ADMIN_PANEL`.
* `components/UserDashboard.tsx`: زر «ساحة الألعاب» في اللوحة (رجوع للّعِب).
* `components/Layout.tsx`: زر البيت في الشريط الجانبي ⇒ ساحة الألعاب (كان يذهب للوحة العضو).
* `api/_handlers/auth/login.ts` و `register.ts` و `kick/callback.ts`:
  تسجيل الجلسة في جدول `sessions` (كان ناقصاً — فكان `/api/me` يرفض الجلسة بعد الدخول).
* `api/_handlers/user/game-key.ts` (جديد): مفتاح اللعبة (تجزئة كلمة سر الحساب)
  لصاحب الجلسة الحقيقية فقط — بدل قراءته من `users` في المتصفح.
* `services/memberIdentity.ts`: `syncGameKey` صار يستدعي السيرفر.

## خطوة لازمة في القاعدة (مرة واحدة)

شغّل `supabase/auth_lockdown.sql` في **Supabase → SQL Editor**. هو يغلق على المفتاح
المنشور في المتصفح: `app_config` (كلمة سر الإدارة) و`users.password_hash` (تجزئات
كلمات سر الأعضاء) وكتابة حقول الإشراف في `profiles`.

> بدون هذه الخطوة يبقى الموقع يعمل، لكن الأسرار تبقى مقروءة للعامة — فنفّذها.

## التحقّق بعد التنفيذ

```bash
# كلمة سر الإدارة يجب أن ترجع 401/403 (ولا تُقرأ أبداً)
curl -s "<SUPABASE_URL>/rest/v1/app_config?select=key,value" \
  -H "apikey: <VITE_SUPABASE_ANON_KEY>" -H "Authorization: Bearer <VITE_SUPABASE_ANON_KEY>"
# ↑ يجب ألا يعرض كلمة السر
```
