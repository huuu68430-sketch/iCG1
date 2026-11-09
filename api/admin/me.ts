import { json, requireAdmin } from '../_lib/adminAuth';

export default async function handler(req: any, res: any) {
    if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
    const auth = await requireAdmin(req);
    if (!auth) return json(res, 401, { ok: false, error: 'غير مسجل' });
    return json(res, 200, { ok: true, staff: auth.staff });
}
