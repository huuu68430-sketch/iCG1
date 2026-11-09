import { audit, clearAdminCookie, json, requireAdmin, revokeAdminSession } from '../../lib/adminAuth';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
    const auth = await requireAdmin(req);
    if (auth) {
        await revokeAdminSession(auth.jti);
        await audit(auth.staff.staff_name, 'ADMIN_LOGOUT', {});
    }
    clearAdminCookie(res);
    return json(res, 200, { ok: true });
}
