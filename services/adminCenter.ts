/**
 * عقد «مركز تحكم الإدارة» — ملف واحد يحدد ثلاثة أشياء:
 *  1. الأقسام الـ19 بنفس ترتيب وتسميات التصميم المرجعي (iCG1 Admin Control Center.html)
 *  2. شكل الصفوف الذي ترجعه /api/admin/data (تسميات الحالة عربية جاهزة للعرض)
 *  3. أسماء أوامر الكتابة التي يقبلها /api/admin/mutate
 *
 * قاعدة صارمة: ما في ولا رقم مولّد عشوائياً في هذا الملف. كل حقل هنا له عمود
 * فعلي في Supabase أو مشتق من تجميع صفوف موجودة.
 */

export type SectionId =
    | 'home' | 'an' | 'users' | 'sanc' | 'reports' | 'games' | 'tour' | 'eco'
    | 'store' | 'inv' | 'mem' | 'ann' | 'notif' | 'sup' | 'staff' | 'promo'
    | 'arena' | 'audit' | 'sys';

/** [مفتاح الحقل, التسمية, نوع العرض] — type: status | num | time | mono */
export type Col = [string, string, ('status' | 'num' | 'time' | 'mono')?];

/** حقل نموذج: [مفتاح, تسمية, نوع, خيارات؟] */
export type Field = [string, string, ('text' | 'number' | 'date' | 'sel' | 'area' | 'check')?, string[]?];

/** إجراء صف: [أيقونة, تسمية, نوع التنفيذ, أمر؟] */
export type RowAction = [string, string, 'command' | 'modal' | 'copy', string?, boolean?];

export interface SectionDef {
    id: SectionId;
    group: string;
    title: string;
    icon: string;
    cols?: Col[];
    fields?: Field[];
    defaults?: Record<string, string | number>;
    actions?: RowAction[];
    createLabel?: string;
    readOnly?: boolean;
    note?: string;
    /**
     * أزرار النموذج العام. الافتراضي: متاحة ما دامت `fields` موجودة.
     * تُطفأ للأقسام التي تُدار بأوامر خاصة (لاعب، مقتنيات، إشعارات…) حتى لا
     * تظهر أزرار يعرف السيرفر أنها سترفض.
     */
    creatable?: boolean;
    editable?: boolean;
    deletable?: boolean;
    /** قسم مخصص (لوحة/رسوم) بدل جدول */
    custom?: 'home' | 'analytics' | 'economy' | 'arena' | 'system';
}

export const GROUPS = [
    'الرئيسية', 'اللاعبون', 'الأمان والإشراف', 'الألعاب والفعاليات',
    'الاقتصاد والمتجر', 'المجتمع والتفاعل', 'الإدارة والأمان',
] as const;

/** قيم الحالة الملوّنة — نفس قواميس التصميم المرجعي */
export const BAD_STATUSES = ['محظور', 'مغلقة', 'موقوف', 'مخفي', 'مخفية', 'مرفوض', 'منتهي', 'مسودة', 'ملغي'];
export const OK_STATUSES = [
    'نشط', 'مجهّز', 'تم الحل', 'مكتملة', 'مكتمل', 'منشور', 'جارية', 'التسجيل مفتوح',
    'تم الإرسال', 'مقبول', 'مفعّل', 'موثّق', 'مكتملة', 'نشط',
];

export const GAME_CODES = [
    'MAHMAH_GAME', 'EMOJI_CODE', 'LETTER_GAME', 'TIME_BOMB', 'MAP_GUESSER', 'TYPING_RACE',
    'SAFE_CODE', 'TRUTH_OR_LIE', 'MUSICAL_CHAIRS', 'SPIN_WHEEL', 'FLAG_QUIZ', 'HIGHER_LOWER',
    'BLUR_GUESS', 'CUP_SHUFFLE', 'DRAWING_CHALLENGE', 'GLASS_BRIDGE_V2',
];

export const RARITIES = ['عادي', 'غير شائع', 'نادر', 'ملحمي', 'أسطوري', 'حصري'];
export const SANCTION_KINDS = ['تحذير', 'كتم مؤقت', 'منع الدردشة', 'منع التفاعل', 'تقييد حساب', 'حظر مؤقت', 'حظر دائم'];
export const REPORT_KINDS = ['سلوك مخالف', 'تعليق مسيء', 'غش في لعبة', 'انتحال حساب', 'محتوى غير لائق', 'إساءة لمستخدم', 'أخرى'];
export const TICKET_CATS = ['مشكلة حساب', 'مشكلة مشتريات', 'مشكلة رصيد', 'مشكلة لعبة', 'بلاغ', 'اقتراح', 'مشكلة تقنية'];
export const PRIORITIES = ['منخفضة', 'متوسطة', 'عالية'];
export const ANN_KINDS = ['عام', 'صيانة', 'فعالية', 'بطولة', 'متجر', 'مكافأة', 'عاجل'];
export const AUDIENCES = ['جميع اللاعبين', 'أعضاء VIP', 'لاعب محدد'];
export const STAFF_ROLES = ['Super Admin', 'Admin', 'Game Manager', 'Store Manager', 'Community Moderator', 'Support Agent', 'Events Manager', 'Analyst'];
export const TOURNAMENT_STAGES = ['مسودة', 'التسجيل مفتوح', 'التسجيل مغلق', 'جارية', 'مكتملة'];
export const ARENA_THEMES = ['الافتراضي', 'الأزرق النيون', 'ساحة الذهب', 'الظل الخفي'];
export const ARENA_FX = ['بلا جزيئات', 'ثلج', 'شرر', 'احتفال'];

export const SECTIONS: SectionDef[] = [
    { id: 'home', group: 'الرئيسية', title: 'نظرة عامة', icon: 'home', custom: 'home' },
    { id: 'an', group: 'الرئيسية', title: 'مركز التحليلات', icon: 'chart', custom: 'analytics' },

    {
        id: 'users', group: 'اللاعبون', title: 'إدارة المتسابقين', icon: 'users',
        cols: [
            ['name', 'اللاعب'], ['id', 'المعرف', 'mono'], ['pts', 'النقاط', 'num'], ['bal', 'الرصيد', 'num'],
            ['wins', 'الفوز', 'num'], ['rank', 'الرتبة'], ['member', 'العضوية'], ['status', 'الحالة'],
        ],
        actions: [
            ['edit', 'تعديل الإحصائيات', 'modal', 'stats'],
            ['eye', 'الملف الإداري (CRM)', 'modal', 'crm'],
            ['crown', 'عضوية VIP', 'modal', 'member'],
            ['ban', 'حظر / فك الحظر', 'command', 'ban.apply', true],
        ],
        note: 'النقاط = leaderboard.score، الرصيد = profiles.credits. الرتبة مشتقة من النقاط ولا تُعدَّل يدوياً. كل تعديل إحصائي يتطلب سبباً ويسجَّل في سجل العمليات.',
    },

    {
        id: 'sanc', group: 'الأمان والإشراف', title: 'المحظورون والعقوبات', icon: 'ban',
        cols: [
            ['player', 'اللاعب'], ['type', 'النوع'], ['reason', 'السبب'],
            ['end', 'الانتهاء', 'time'], ['admin', 'المشرف'], ['status', 'الحالة'],
        ],
        fields: [
            ['player', 'اسم اللاعب'],
            ['type', 'النوع', 'sel', SANCTION_KINDS],
            ['reason', 'السبب'],
            ['end', 'تاريخ الانتهاء', 'date'],
        ],
        defaults: { admin: 'المشرف العام', status: 'نشط' },
        createLabel: 'عقوبة جديدة',
        actions: [
            ['check', 'رفع العقوبة', 'command', 'ban.lift'],
        ],
        note: 'الحظر يغيّر حالة الحساب فقط، ولا يمس النقاط أو الرصيد أو المقتنيات.',
    },

    {
        id: 'reports', group: 'الأمان والإشراف', title: 'إدارة المجتمع والبلاغات', icon: 'flag',
        cols: [
            ['from', 'صاحب البلاغ'], ['target', 'المبلغ عنه'], ['kind', 'النوع'],
            ['reason', 'السبب'], ['time', 'الوقت', 'time'], ['status', 'الحالة'],
        ],
        fields: [
            ['from', 'صاحب البلاغ'], ['target', 'المبلغ عنه'],
            ['kind', 'النوع', 'sel', REPORT_KINDS],
            ['reason', 'السبب'],
        ],
        defaults: { status: 'جديد' },
        editable: false, deletable: false,
        actions: [
            ['check', 'قبول البلاغ', 'command', 'report.status'],
            ['x', 'رفض البلاغ', 'command', 'report.reject'],
        ],
        note: 'البلاغات تصل من قسم «البلاغات» في إعدادات العضو. الاعتراضات على العقوبات تصل هنا أيضاً وتُعلَّم كنوع اعتراض.',
    },

    {
        id: 'games', group: 'الألعاب والفعاليات', title: 'مركز إدارة الألعاب', icon: 'game',
        cols: [
            ['name', 'اللعبة'], ['plays', 'مرات اللعب', 'num'], ['players', 'اللاعبون', 'num'],
            ['reward', 'مكافأة الفوز', 'num'], ['status', 'الحالة'],
        ],
        fields: [
            ['name', 'الاسم الظاهر'],
            ['position', 'الترتيب في الرئيسية', 'number'],
        ],
        actions: [
            ['power', 'تشغيل / إيقاف', 'command', 'game.toggle'],
            ['eye', 'إظهار / إخفاء من الرئيسية', 'command', 'game.visible'],
        ],
        deletable: false, creatable: false,
        note: 'مرات اللعب من مجمّع game_leaderboard الحقيقي، ومكافأة الفوز من جدول GAME_POINTS في الكود. الإيقاف والإخفاء يؤثر مباشرة على الصفحة الرئيسية.',
    },

    {
        id: 'tour', group: 'الألعاب والفعاليات', title: 'البطولات والفعاليات', icon: 'trophy',
        cols: [
            ['name', 'البطولة'], ['game', 'اللعبة'], ['start', 'البداية', 'time'],
            ['registered', 'المسجلون', 'num'], ['max', 'الحد الأقصى', 'num'],
            ['prize', 'الجائزة', 'num'], ['status', 'الحالة'],
        ],
        fields: [
            ['name', 'الاسم'],
            ['game', 'اللعبة', 'sel', GAME_CODES],
            ['start', 'البداية', 'date'],
            ['max', 'الحد الأقصى للمشاركين', 'number'],
            ['prize', 'جائزة المركز الأول', 'number'],
            ['note', 'ملاحظات للاعبين', 'area'],
        ],
        defaults: { status: 'مسودة' },
        actions: [
            ['chev', 'المرحلة التالية', 'command', 'tour.advance'],
        ],
        note: 'عدد المسجلين حقيقي من جدول التسجيل؛ العضو يسجّل من بطاقة «البطولات» في رئيسية لوحة العضو.',
    },

    {
        id: 'eco', group: 'الاقتصاد والمتجر', title: 'مركز الاقتصاد والأرصدة', icon: 'coin', custom: 'economy',
    },

    {
        id: 'store', group: 'الاقتصاد والمتجر', title: 'إدارة المتجر', icon: 'bag',
        cols: [
            ['name', 'المنتج'], ['rarity', 'الندرة'], ['price', 'السعر', 'num'],
            ['sold', 'المبيعات', 'num'], ['status', 'الحالة'],
        ],
        fields: [
            ['name', 'الاسم'],
            ['description', 'الوصف'],
            ['rarity', 'الندرة', 'sel', RARITIES],
            ['price', 'السعر', 'number'],
            ['sort', 'الترتيب', 'number'],
            ['is_active', 'معروض للبيع', 'check'],
        ],
        createLabel: 'منتج جديد',
        defaults: { is_active: 1, sort: 0 },
        actions: [
            ['eye', 'إخفاء / إظهار', 'command', 'store.toggle'],
        ],
        note: 'المتجر الحقيقي هنا هو الإطارات (جدول frames) لأن العضو يشتري منها فعلاً؛ المبيعات معدودة من user_frames.',
    },

    {
        id: 'inv', group: 'الاقتصاد والمتجر', title: 'الخزائن والمقتنيات', icon: 'box',
        cols: [
            ['player', 'اللاعب'], ['item', 'المقتنى'], ['rarity', 'الندرة'],
            ['source', 'المصدر'], ['status', 'الحالة'], ['time', 'التاريخ', 'time'],
        ],
        fields: [
            ['player', 'اللاعب'],
            ['item', 'المقتنى', 'sel'],
        ],
        createLabel: 'منح مقتنى',
        defaults: { source: 'منح إداري', status: 'غير مجهّز' },
        editable: false, deletable: false,
        actions: [
            ['power', 'تفعيل / إلغاء التجهيز', 'command', 'inv.toggle'],
            ['trash', 'سحب المقتنى', 'command', 'inv.revoke', true],
        ],
    },

    {
        id: 'mem', group: 'الاقتصاد والمتجر', title: 'العضويات والرتب', icon: 'crown',
        cols: [
            ['name', 'الاسم'], ['kind', 'النوع'], ['min', 'الحد الأدنى للنقاط', 'num'],
            ['discount', 'الخصم', 'num'], ['perk', 'المزايا'], ['status', 'الحالة'],
        ],
        fields: [
            ['name', 'الاسم'],
            ['kind', 'النوع', 'sel', ['رتبة', 'عضوية']],
            ['min', 'الحد الأدنى للنقاط', 'number'],
            ['discount', 'نسبة الخصم %', 'number'],
            ['duration', 'مدة العضوية بالأيام', 'number'],
            ['perk', 'المزايا'],
        ],
        defaults: { status: 'نشط' },
        note: 'سلّم الرُتب العشر مزروع من السلّم المستخدم فعلياً في لوحة العضو، ولوحة العضو تقرأه من القاعدة الآن.',
    },

    {
        id: 'ann', group: 'المجتمع والتفاعل', title: 'البث والإعلانات', icon: 'mega',
        cols: [
            ['title', 'العنوان'], ['kind', 'النوع'], ['when', 'الوقت', 'time'], ['status', 'الحالة'],
        ],
        fields: [
            ['title', 'العنوان'],
            ['body', 'النص', 'area'],
            ['kind', 'النوع', 'sel', ANN_KINDS],
            ['when', 'النشر', 'sel', ['نشر فوري', 'جدولة', 'مسودة']],
            ['scheduled_at', 'تاريخ الجدولة', 'date'],
        ],
        defaults: { status: 'منشور' },
        actions: [
            ['power', 'إيقاف البث', 'command', 'ann.unpublish'],
        ],
        note: 'الإعلان المنشور يظهر فوراً للبث (overlay) ولكل عضو في بطاقة «الإعلانات» بلوحة العضو.',
    },

    {
        id: 'notif', group: 'المجتمع والتفاعل', title: 'مركز الإشعارات', icon: 'bell',
        cols: [
            ['title', 'العنوان'], ['to', 'المستلمون'], ['time', 'الوقت', 'time'], ['status', 'الحالة'],
            ['read', 'المقروء', 'num'],
        ],
        fields: [
            ['title', 'العنوان'],
            ['body', 'المحتوى', 'area'],
            ['to', 'المستلمون', 'sel', AUDIENCES],
            ['target', 'اسم اللاعب (عند التحديد)'],
        ],
        defaults: { status: 'تم الإرسال' },
        editable: false, deletable: false,
        note: 'الإشعار يوصل لجرس العضو مباشرة. عدد المقروء محسوب من إشعارات القراء الحقيقية.',
    },

    {
        id: 'sup', group: 'المجتمع والتفاعل', title: 'مركز الدعم', icon: 'life',
        cols: [
            ['subj', 'الموضوع'], ['cat', 'التصنيف'], ['pri', 'الأولوية'],
            ['from', 'اللاعب'], ['time', 'الوقت', 'time'], ['status', 'الحالة'],
        ],
        fields: [
            ['subj', 'الموضوع'],
            ['cat', 'التصنيف', 'sel', TICKET_CATS],
            ['pri', 'الأولوية', 'sel', PRIORITIES],
            ['from', 'اللاعب'],
            ['body', 'التفاصيل', 'area'],
        ],
        defaults: { status: 'جديدة' },
        editable: false, deletable: false,
        actions: [
            ['check', 'رد وإغلاق', 'modal', 'reply'],
            ['eye', 'إعادة فتح', 'command', 'ticket.reopen'],
        ],
        note: 'التذاكر تصل من قسم «الدعم» في إعدادات العضو، والرد يظهر عنده هناك.',
    },

    {
        id: 'staff', group: 'الإدارة والأمان', title: 'المشرفون والصلاحيات', icon: 'shield',
        cols: [
            ['name', 'المشرف'], ['role', 'الدور'], ['perm', 'الصلاحيات'],
            ['last', 'آخر دخول', 'time'], ['status', 'الحالة'],
        ],
        fields: [
            ['name', 'اسم المشرف'],
            ['role', 'الدور', 'sel', STAFF_ROLES],
            ['perm', 'الصلاحيات', 'sel', ['كل الصلاحيات', 'الألعاب والبطولات', 'المتجر والاقتصاد', 'المجتمع والدعم', 'الإشراف والعقوبات', 'قراءة فقط']],
        ],
        defaults: { status: 'نشط' },
        actions: [
            ['power', 'تنشيط / تعطيل', 'command', 'staff.toggle'],
        ],
        note: 'الصلاحيات تُطبَّق في السيرفر فعلياً: كل أمر إداري يفحص دور المشرف قبل التنفيذ، وتعطيل المشرف يمنعه من الدخول.',
    },

    {
        id: 'promo', group: 'الإدارة والأمان', title: 'الأكواد الترويجية', icon: 'tag',
        cols: [
            ['code', 'الكود'], ['val', 'المكافأة', 'num'], ['used', 'الاستخدام', 'num'],
            ['max', 'الحد الأقصى', 'num'], ['end', 'الانتهاء', 'time'], ['status', 'الحالة'],
        ],
        fields: [
            ['code', 'الكود'],
            ['val', 'المكافأة', 'number'],
            ['max', 'الحد الأقصى للاستخدام', 'number'],
            ['end', 'الانتهاء', 'date'],
            ['note', 'ملاحظة'],
        ],
        defaults: { used: 0, status: 'نشط' },
        actions: [
            ['copy', 'نسخ الكود', 'copy'],
            ['power', 'تفعيل / إيقاف', 'command', 'promo.toggle'],
        ],
        note: 'الكود يُستخدَم من العضو في إعدادات الحساب، ومن الشات عبر البث كما هو معتاد — والاستخدام ذرّي في السيرفر.',
    },

    { id: 'arena', group: 'الإدارة والأمان', title: 'إدارة الساحة', icon: 'monitor', custom: 'arena' },

    {
        id: 'audit', group: 'الإدارة والأمان', title: 'سجل العمليات', icon: 'log',
        cols: [
            ['time', 'الوقت', 'time'], ['admin', 'المشرف'], ['type', 'العملية'],
            ['target', 'الهدف'], ['detail', 'التفاصيل'],
        ],
        readOnly: true,
        note: 'كل عملية كتابة إدارية تسجَّل تلقائياً في audit_logs — لا يمكن حذف أي سطر منه من الواجهة.',
    },

    { id: 'sys', group: 'الإدارة والأمان', title: 'النظام والنسخ الاحتياطي', icon: 'server', custom: 'system' },
];

export const sectionById = (id: SectionId) => SECTIONS.find(s => s.id === id)!;

/* ------------------------------------------------------------------ *
 * أشكال البيانات المرجعة من /api/admin/data
 * ------------------------------------------------------------------ */

export interface Overview {
    players: number; accounts: number; banned: number; sanctions: number;
    credits: number; points: number; wins: number;
    store_active: number; games_active: number; games_total: number;
    tournaments: number; tickets_open: number; reports_new: number;
    plays: number; visits: number; spend: number; inventory: number; promos_active: number;
}

export interface UserRow {
    id: string; name: string; pts: number; bal: number; wins: number;
    rank: string; member: string; status: string; note: string; avatar: string;
    last_seen?: string;
    /** ملف اللاعب الإداري — أقسام CRM الحقيقية */
    games?: { name: string; plays: number; points: number }[];
    spend?: number;
    items?: { name: string; rarity: string; status: string }[];
    reportsAbout?: number;
    activeSanctions?: { type: string; reason: string; end: string }[];
    history?: { time: string; label: string; detail: string }[];
}

export interface DayPoint { day: string; plays: number; points: number; new_players: number; spend: number }
export interface GameRank { game_code: string; name: string; plays: number; points: number; players: number; last_play: string }

export interface StatRow { id: string; [k: string]: string | number }

export interface ArenaConfig {
    theme: string; particles: string;
    audio: { enabled: boolean; volume: number; url: string };
}

export interface AdminData {
    overview: Overview;
    analytics: {
        series: DayPoint[];
        rankings: GameRank[];
        topSellers: { name: string; sold: number; revenue: number }[];
        dau: { today: number; week: number; month: number };
    };
    users: UserRow[];
    sanctions: StatRow[];
    reports: StatRow[];
    games: StatRow[];
    tournaments: StatRow[];
    economy: { transactions: { time: string; player: string; detail: string; amount: number }[] };
    store: StatRow[];
    inventory: StatRow[];
    tiers: StatRow[];
    announcements: StatRow[];
    notifications: StatRow[];
    tickets: StatRow[];
    staff: StatRow[];
    promos: StatRow[];
    arena: ArenaConfig;
    audit: StatRow[];
    system: {
        health: { table_name: string; rows: number; size: string }[];
        integrity: Record<string, number>;
        lastExport: string | null;
        migrationsApplied: boolean;
    };
    /** أسماء الحقول الخيارات في النماذج، محسوبة من القاعدة (إطارات، رُتب…) */
    options: { frames: string[]; tiers: string[]; staffNames: string[] };
}

/** خريطة معرّف القسم → مفتاح المصفوفة في AdminData */
export const SECTION_ROWS: Partial<Record<SectionId, keyof AdminData>> = {
    users: 'users', sanc: 'sanctions', reports: 'reports', games: 'games', tour: 'tournaments',
    store: 'store', inv: 'inventory', mem: 'tiers', ann: 'announcements', notif: 'notifications',
    sup: 'tickets', staff: 'staff', promo: 'promos', audit: 'audit',
};

/* ------------------------------------------------------------------ *
 * عميل اللوحة
 * ------------------------------------------------------------------ */

export interface MutateResult { ok: boolean; error?: string; data?: any; audit?: string }

const jsonHeaders = { 'Content-Type': 'application/json' };

export const adminApi = {
    async login(password: string) {
        const r = await fetch('/api/admin/login', {
            method: 'POST', headers: jsonHeaders, credentials: 'include',
            body: JSON.stringify({ password }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) return { ok: false, error: j.error || 'تعذّر تسجيل الدخول' };
        return { ok: true, staff: j.staff };
    },

    async logout() {
        await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' }).catch(() => { });
    },

    async me(): Promise<{ ok: boolean; staff?: { staff_name: string; role: string; permissions: string[] }; error?: string }> {
        const r = await fetch('/api/admin/me', { credentials: 'include' });
        if (!r.ok) return { ok: false, error: 'غير مسجل' };
        return r.json().catch(() => ({ ok: false, error: 'خطأ' }));
    },

    async data(): Promise<AdminData | null> {
        const r = await fetch('/api/admin/data', { credentials: 'include' });
        if (!r.ok) return null;
        return r.json().catch(() => null);
    },

    /** أمر كتابة واحد — السيرفر يفحص الصلاحية ويسجّل العملية */
    async run(command: string, payload: Record<string, any> = {}): Promise<MutateResult> {
        const r = await fetch('/api/admin/mutate', {
            method: 'POST', headers: jsonHeaders, credentials: 'include',
            body: JSON.stringify({ command, payload }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || j.ok === false) return { ok: false, error: j.error || `فشل الأمر (${r.status})` };
        return { ok: true, data: j.data, audit: j.audit };
    },

    /** ملف لاعب كامل للأزرار الإدارية — يُجلب عند الطلب فقط */
    async crm(username: string): Promise<UserRow | null> {
        const r = await fetch(`/api/admin/player?username=${encodeURIComponent(username)}`, { credentials: 'include' });
        if (!r.ok) return null;
        return r.json().catch(() => null);
    },

    async exportUrl(kind: 'json' | 'csv') {
        return `/api/admin/export?format=${kind}`;
    },
};

/** حدود عمليات التعديل اليدوي — نفس قيود التصميم المرجعي */
export const STATS_LIMIT = 10000;
export const MASS_REWARD_LIMIT = 1000;
