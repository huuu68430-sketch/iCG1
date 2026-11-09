/* ==========================================================================
   عميل واجهات العضو — كل كتابة تمشي عبر /api/user/* (سيرفرلس + مفتاح السر
   داخل السيرفر فقط). المتصفح لا يلمس الجداول الجديدة مباشرة أبداً.
   ========================================================================== */

const jsonHeaders = { 'Content-Type': 'application/json' };

export interface ApiResult<T = any> {
    ok: boolean;
    error?: string;
    data?: T;
    [k: string]: any;
}

const send = async (path: string, init: RequestInit = {}): Promise<ApiResult> => {
    try {
        const r = await fetch(path, { credentials: 'include', ...init });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || j.ok === false) return { ...j, ok: false, error: j.error || 'تعذّر تنفيذ العملية' };
        return j;
    } catch {
        return { ok: false, error: 'انقطع الاتصال — حاول مرة أخرى' };
    }
};

const get = (path: string) => send(path);
const post = (path: string, body: Record<string, any> = {}) =>
    send(path, { method: 'POST', headers: jsonHeaders, body: JSON.stringify(body) });

export interface MemberProfile {
    username: string;
    credits: number;
    is_banned: boolean;
    membership: string | null;
    membership_expires_at: string | null;
    active_frame_id: string | null;
}

export interface MemberReport {
    id: string;
    record_type: 'report' | 'appeal';
    target_username: string;
    kind: string;
    reason: string;
    status: string;
    status_ar: string;
    resolution: string | null;
    created_at: string;
    sanction_id: string | null;
}

export interface MemberSanction {
    id: string;
    type: string;
    reason: string;
    ends_at: string | null;
    created_at: string;
}

export interface MemberTicket {
    id: string;
    subject: string;
    category: string;
    priority: string;
    status: string;
    status_ar: string;
    reply: string | null;
    created_at: string;
    updated_at: string | null;
}

export interface MemberNotification {
    id: string;
    title: string;
    body: string;
    audience: string;
    target_username: string | null;
    sent_at: string;
    read: boolean;
}

export interface MemberAnnouncement {
    id: string;
    title: string;
    body: string;
    kind: string;
    at: string;
}

export interface MemberTournament {
    id: string;
    name: string;
    game: string;
    starts_at: string | null;
    prize: number;
    note: string;
    max: number;
    registered: number;
    status: string;
    status_ar: string;
    mine: boolean;
}

export const memberApi = {
    /* ---- الجلسة ---- */
    /** الجلسة تُمنح للاعب معروف فقط؛ الاسم يأتي من حساب كيك الموجود أصلاً */
    start: (username: string) => post('/api/user/session', { username }),
    end: () => send('/api/user/session', { method: 'DELETE' }),
    profile: async (): Promise<{ ok: boolean; username?: string; verified?: boolean; profile?: MemberProfile | null; error?: string }> => get('/api/user/session'),

    /* ---- البلاغات والاعتراضات ---- */
    reports: async (): Promise<{ ok: boolean; reports?: MemberReport[]; sanctions?: MemberSanction[]; banned?: boolean; error?: string }> => get('/api/user/reports'),
    submitReport: (p: { kind: string; target_username?: string; reason: string; detail?: string }) => post('/api/user/reports', p),
    submitAppeal: (p: { sanction_id: string; reason: string; detail?: string }) =>
        post('/api/user/reports', { ...p, record_type: 'appeal' }),

    /* ---- تذاكر الدعم ---- */
    tickets: async (): Promise<{ ok: boolean; tickets?: MemberTicket[]; error?: string }> => get('/api/user/tickets'),
    openTicket: (p: { subject: string; body: string; category?: string; priority?: string }) => post('/api/user/tickets', p),

    /* ---- الإشعارات ---- */
    notifications: async (): Promise<{ ok: boolean; notifications?: MemberNotification[]; unread?: number; error?: string }> => get('/api/user/notifications'),
    readNotification: (id: string) => post('/api/user/notifications', { id }),
    readAllNotifications: () => post('/api/user/notifications', { all: true }),

    /* ---- الإعلانات المعلّقة ---- */
    announcements: async (): Promise<{ ok: boolean; announcements?: MemberAnnouncement[]; error?: string }> => get('/api/user/announcements'),
    dismissAnnouncement: (id: string) => post('/api/user/announcements', { id }),

    /* ---- البطولات ---- */
    tournaments: async (): Promise<{ ok: boolean; tournaments?: MemberTournament[]; error?: string }> => get('/api/user/tournaments'),
    joinTournament: (id: string) => post('/api/user/tournaments', { id }),
    leaveTournament: (id: string) => send(`/api/user/tournaments?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),

    /* ---- الأكواد الترويجية ---- */
    promoHistory: async (): Promise<{ ok: boolean; redemptions?: any[]; error?: string }> => get('/api/user/promo'),
    redeemPromo: (code: string): Promise<ApiResult & { amount?: number }> => post('/api/user/promo', { code }),

    /* ---- المتجر (شراء/تجهيز ذرّي داخل القاعدة) ---- */
    store: async (): Promise<{ ok: boolean; owned?: any[]; equipped?: string | null; vip?: boolean; discount_pct?: number; error?: string }> => get('/api/user/store'),
    buyFrame: (frame_id: string) => post('/api/user/store', { frame_id, action: 'buy' }),
    equipFrame: (frame_id: string) => post('/api/user/store', { frame_id, action: 'equip' }),
};
