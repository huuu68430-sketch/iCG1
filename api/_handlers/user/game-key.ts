// مفتاح اللعبة: تجزئة كلمة سر الحساب نفسه — تُستعمل داخل المافيا لإثبات
// ملكية الحساب. لا تُقرأ من قاعدة البيانات في المتصفح (كان يُقرأها أي زائر):
// المصدر الوحيد هو جلسة حقيقية (تسجيل دخول بكلمة سر) فيستلم صاحبها تجزئته هو.
import { supabaseAdmin } from '../../_lib/supabase';
import { requireSession } from '../../_lib/auth';

export default async function handler(req: any, res: any) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    // جلسة حقيقية فقط: كوكي العضو (icg1_member) لا يكفي — ذلك يمنح أي اسم موجود
    // فلو كان باباً يُعيد تجزئات الآخرين.
    const session = await requireSession(req);
    if (!session) return res.status(401).json({ ok: false, error: 'لا توجد جلسة' });

    const { data, error } = await supabaseAdmin
        .from('users')
        .select('password_hash')
        .eq('id', session.userId)
        .maybeSingle();
    if (error || !data?.password_hash) return res.status(404).json({ ok: false, error: 'لا يوجد مفتاح' });

    return res.status(200).json({ ok: true, game_key: String(data.password_hash) });
}
