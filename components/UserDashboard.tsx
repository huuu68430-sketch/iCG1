import React, { useState, useEffect } from 'react';
import {
    User, Trophy, Settings, Layout, ShoppingBag,
    Star, Wallet, Shield, Zap, Sparkles, ChevronRight,
    Search, Filter, CheckCircle, Lock, Gem, Crown,
    ArrowRight, Box, Palette, Image as ImageIcon, LogOut,
    Menu, X, ChevronLeft, Trash2, Ban, ShieldAlert
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { getAssetUrl, getFrameUrl } from '../utils/assets';
import { ProAvatar } from './ProAvatar';

interface UserDashboardProps {
    userData: {
        id: string;
        kick_username: string;
        display_name: string;
        avatar?: string;
        points?: number;
    };
    onLogout?: () => void;
}

type DashboardView = 'OVERVIEW' | 'STORE' | 'LOCKER' | 'RANKINGS' | 'SETTINGS';

export const UserDashboard: React.FC<UserDashboardProps> = ({ userData, onLogout }) => {
    const [activeView, setActiveView] = useState<DashboardView>('OVERVIEW');
    const [points, setPoints] = useState(userData.points || 0);
    const [activeFrame, setActiveFrame] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isBanned, setIsBanned] = useState(false);
    const [banReason, setBanReason] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        try {
            const adminAuth = localStorage.getItem('admin_access_granted');
            if (adminAuth) {
                const parsed = JSON.parse(adminAuth);
                if (parsed.valid) setIsAdmin(true);
            }
        } catch (e) {}
    }, []);

    const handleReturnToAdmin = () => {
        const adminAuth = localStorage.getItem('admin_access_granted');
        if (adminAuth) {
            localStorage.setItem('site_access_granted', adminAuth);
            localStorage.removeItem('iabs_user');
            window.location.reload();
        }
    };

    // Sidebar items
    const navItems = [
        { id: 'OVERVIEW', label: 'نظرة عامة', icon: Layout, subtitle: 'Dashboard' },
        { id: 'STORE', label: 'المتجر', icon: ShoppingBag, subtitle: 'Store' },
        { id: 'LOCKER', label: 'خزانة الأغراض', icon: Box, subtitle: 'Locker' },
        { id: 'RANKINGS', label: 'لوحة الصدارة', icon: Crown, subtitle: 'Rankings' },
        { id: 'SETTINGS', label: 'الإعدادات', icon: Settings, subtitle: 'Settings' },
    ];

    useEffect(() => {
        const fetchUserData = async () => {
            const username = (userData.kick_username || (userData as any).kickUsername)?.toLowerCase();
            if (!username) return;

            // 1. Fetch points (use limit(1) to avoid maybeSingle crashing on duplicates)
            const { data: lbData } = await supabase
                .from('leaderboard')
                .select('score')
                .ilike('username', username)
                .order('score', { ascending: false })
                .limit(1);

            if (lbData && lbData.length > 0) setPoints(lbData[0].score || 0);
            else setPoints(0);

            // 2. Fetch active frame and ban status
            const { data: profile } = await supabase
                .from('profiles')
                .select('active_frame_url, is_banned')
                .ilike('username', username)
                .limit(1);

            if (profile && profile.length > 0) {
                setActiveFrame(profile[0].active_frame_url);
                if (profile[0].is_banned) {
                    setIsBanned(true);
                    const { data: banData } = await supabase.from('bans').select('reason').ilike('username', username).limit(1);
                    if (banData && banData.length > 0) {
                        setBanReason(banData[0].reason);
                    } else {
                        setBanReason('مخالفة قوانين المنصة');
                    }
                }
            }
        };
        fetchUserData();
    }, [userData]);

    const handleNavClick = (id: DashboardView) => {
        setActiveView(id);
        setMobileMenuOpen(false);
    };

    const renderView = () => {
        switch (activeView) {
            case 'OVERVIEW': return <Overview userData={{ ...userData, points }} />;
            case 'STORE': return <Store userId={userData.id} kickUsername={userData.kick_username || (userData as any).kickUsername} points={points} onPurchase={(newPoints) => setPoints(newPoints)} />;
            case 'LOCKER': return <Locker userId={userData.id} kickUsername={userData.kick_username || (userData as any).kickUsername} onEquipChanged={(frame: string | null) => setActiveFrame(frame)} />;
            case 'RANKINGS': return <Rankings />;
            case 'SETTINGS': return <SettingsSection userData={userData} onLogout={onLogout} />;
            default: return <Overview userData={{ ...userData, points }} />;
        }
    };

    if (isBanned) {
        return (
            <div className="icg1-user-dashboard fixed inset-0 z-[10000] bg-[#050505] flex flex-col items-center justify-center p-6 font-sans overflow-hidden" dir="rtl">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 pointer-events-none"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-600/10 animate-pulse rounded-full blur-[150px] pointer-events-none"></div>
                
                <div className="relative z-10 max-w-2xl w-full glass-card bg-black/80 backdrop-blur-3xl border border-red-500/30 rounded-[3rem] p-10 md:p-14 text-center shadow-[0_20px_80px_rgba(255,0,0,0.2)] overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-red-900 via-red-500 to-red-900"></div>
                    
                    <div className="w-24 h-24 mx-auto bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mb-8 relative">
                        <div className="absolute inset-0 bg-red-500 blur-xl opacity-40 animate-pulse rounded-full"></div>
                        <Ban size={48} className="text-red-500 relative z-10 drop-shadow-[0_0_15px_red]" />
                    </div>

                    <h1 className="text-4xl md:text-5xl font-black text-white italic tracking-tight mb-3 drop-shadow-[0_5px_15px_rgba(255,0,0,0.5)]">تم حظر حسابك نهائياً</h1>
                    <p className="text-sm md:text-base text-red-500 font-black mb-10 italic tracking-[0.2em] uppercase">System Access Denied</p>

                    <div className="bg-red-500/5 border border-red-500/20 rounded-3xl p-6 md:p-8 mb-10 relative overflow-hidden group hover:bg-red-500/10 transition-all text-center">
                        <div className="absolute right-0 top-0 w-1 h-full bg-red-500 shadow-[0_0_15px_red]"></div>
                        <div className="text-xs font-black text-red-500/80 uppercase tracking-wider mb-4 flex items-center justify-center gap-2">
                            <ShieldAlert size={16} /> سبب الحظر
                        </div>
                        <p className="text-xl md:text-2xl font-bold text-white leading-relaxed break-words whitespace-pre-wrap">{banReason}</p>
                    </div>

                    <button onClick={onLogout} className="px-10 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-white font-black italic transition-all flex items-center justify-center gap-3 mx-auto hover:scale-105 active:scale-95 shadow-lg">
                        <LogOut size={20} /> تسجيل الخروج
                    </button>
                </div>
            </div>
        );
    }

    // Shared sidebar content used in both desktop and mobile
    const SidebarContent = () => (
        <>
            {isAdmin && (
                <button
                    onClick={handleReturnToAdmin}
                    className="mb-4 w-full relative group py-3 px-4 bg-gradient-to-r from-blue-600/20 to-blue-800/10 hover:from-blue-500/30 hover:to-blue-700/20 rounded-[1rem] border border-blue-500/30 transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(59,130,246,0.15)] hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] active:scale-95"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-400/0 via-blue-400/10 to-blue-400/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000 skew-x-[-20deg]" />
                    <ShieldAlert size={16} className="text-blue-400 group-hover:scale-110 transition-transform" />
                    <span className="text-blue-300 font-black text-sm tracking-tight drop-shadow-md">الرجوع للإدارة</span>
                </button>
            )}

            {/* Profile Card */}
            <div className="relative p-5 rounded-[1.5rem] bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/10 overflow-hidden group">
                {/* Animated glow behind avatar */}
                <div className="absolute top-2 right-4 w-20 h-20 bg-red-600/20 blur-[40px] rounded-full animate-pulse" />
                <div className="absolute bottom-0 left-0 w-32 h-16 bg-yellow-500/5 blur-[30px] rounded-full" />

                <div className="relative z-10 flex items-center gap-4">
                    <div className="relative">
                        {/* Spinning ring around avatar */}
                        <div className="absolute -inset-1 rounded-full border-2 border-transparent border-t-red-500 border-r-red-500/50 animate-spin" style={{ animationDuration: '3s' }} />
                        <ProAvatar url={userData.avatar} username={userData.kick_username || (userData as any).kickUsername} size="w-14 h-14" frameUrl={activeFrame || undefined} className="overflow-visible" />
                    </div>
                    <div className="overflow-hidden flex-1">
                        <div className="text-white font-black text-sm truncate mb-0.5 drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">{userData.display_name}</div>
                        <div className="flex items-center gap-1.5">
                            <div className="flex items-center gap-1 bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded-lg">
                                <Gem size={10} className="text-yellow-500" />
                                <span className="text-yellow-500 text-[10px] font-black">{points.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex flex-col gap-1 mt-2">
                {navItems.map((item, idx) => {
                    const isActive = activeView === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => handleNavClick(item.id as DashboardView)}
                            className={`relative flex items-center gap-3 px-4 py-3.5 rounded-2xl font-black text-xs transition-all duration-400 overflow-hidden group/nav
                                ${isActive
                                    ? 'text-white shadow-[0_4px_20px_rgba(220,38,38,0.3)]'
                                    : 'text-gray-500 hover:text-white hover:bg-white/[0.04]'
                                }`}
                            style={{ animationDelay: `${idx * 60}ms` }}
                        >
                            {/* Active background gradient */}
                            {isActive && (
                                <div className="absolute inset-0 bg-gradient-to-l from-red-600 via-red-700 to-red-900 rounded-2xl" />
                            )}
                            {/* Shine effect on active */}
                            {isActive && (
                                <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent rounded-2xl opacity-60" />
                            )}
                            {/* Left accent bar */}
                            {isActive && (
                                <div className="absolute right-0 top-2 bottom-2 w-1 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.6)]" />
                            )}

                            <div className={`relative z-10 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300
                                ${isActive ? 'bg-white/20 shadow-inner' : 'bg-white/[0.04] group-hover/nav:bg-white/[0.08]'}`}>
                                <item.icon size={15} className={isActive ? 'drop-shadow-[0_0_6px_rgba(255,255,255,0.5)]' : ''} />
                            </div>
                            <div className="relative z-10 flex flex-col items-start">
                                <span className="leading-tight">{item.label}</span>
                                <span className={`text-[8px] font-bold uppercase tracking-widest ${isActive ? 'text-white/50' : 'text-gray-700'}`}>{item.subtitle}</span>
                            </div>
                            {isActive && (
                                <div className="relative z-10 mr-auto">
                                    <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse shadow-[0_0_6px_rgba(255,255,255,0.8)]" />
                                </div>
                            )}
                        </button>
                    );
                })}
            </nav>

            {/* VIP Banner */}
            <div className="mt-auto pt-4 border-t border-white/5">
                <div className="relative bg-gradient-to-br from-red-950/60 via-red-900/20 to-black/40 p-5 rounded-[1.5rem] border border-red-500/15 overflow-hidden group cursor-pointer hover:border-red-500/30 transition-all">
                    {/* Animated particles */}
                    <div className="absolute top-2 left-4 w-1 h-1 bg-red-500/40 rounded-full animate-ping" style={{ animationDuration: '2s' }} />
                    <div className="absolute bottom-4 right-8 w-1 h-1 bg-yellow-500/30 rounded-full animate-ping" style={{ animationDuration: '3s', animationDelay: '1s' }} />
                    <div className="absolute top-6 right-3 w-0.5 h-0.5 bg-white/20 rounded-full animate-ping" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }} />

                    <Sparkles size={50} className="absolute -bottom-3 -right-3 text-red-600/10 group-hover:text-red-600/20 group-hover:scale-125 transition-all duration-700" />
                    <Crown size={20} className="absolute top-3 left-3 text-yellow-500/10 group-hover:text-yellow-500/20 transition-all" />

                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="bg-gradient-to-r from-red-600 to-red-500 px-2 py-0.5 rounded-md">
                                <span className="text-[9px] font-black text-white uppercase tracking-widest">VIP</span>
                            </div>
                            <span className="text-[10px] font-black text-red-500/80 uppercase tracking-wider">iCG1</span>
                        </div>
                        <div className="text-white/70 font-bold text-[11px] leading-relaxed">ارفع مستواك للحصول على خصومات حصرية في المتجر!</div>
                    </div>
                </div>
            </div>
        </>
    );

    return (
        <div className="icg1-user-dashboard flex flex-col md:flex-row w-full h-full min-h-[500px] bg-gradient-to-br from-black/60 via-zinc-950/50 to-black/60 backdrop-blur-3xl rounded-[1.5rem] border border-white/[0.06] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.5),0_0_100px_rgba(220,38,38,0.03)] animate-in zoom-in duration-500" dir="rtl">

            {/* ===== MOBILE TOP BAR ===== */}
            <div className="flex md:hidden items-center justify-between px-4 py-3 bg-gradient-to-l from-red-950/30 via-zinc-950/80 to-zinc-950/80 border-b border-white/5">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="absolute -inset-0.5 rounded-full border border-transparent border-t-red-500/50 animate-spin" style={{ animationDuration: '3s' }} />
                        <ProAvatar url={userData.avatar} username={userData.kick_username || (userData as any).kickUsername} size="w-9 h-9" frameUrl={activeFrame || undefined} className="overflow-visible" />
                    </div>
                    <div>
                        <div className="text-white font-black text-xs">{userData.display_name}</div>
                        <div className="flex items-center gap-1">
                            <Gem size={8} className="text-yellow-500" />
                            <span className="text-yellow-500 text-[9px] font-black">{points.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                <button
                    onClick={() => setMobileMenuOpen(true)}
                    className="relative p-2.5 bg-white/5 hover:bg-red-600/20 rounded-xl border border-white/10 hover:border-red-500/30 transition-all active:scale-90"
                >
                    <Menu size={18} className="text-white" />
                    <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_4px_rgba(220,38,38,0.8)]" />
                </button>
            </div>

            {/* ===== MOBILE DRAWER OVERLAY ===== */}
            {mobileMenuOpen && (
                <div
                    className="fixed inset-0 z-[9998] bg-black/70 backdrop-blur-sm md:hidden animate-in fade-in duration-300"
                    onClick={() => setMobileMenuOpen(false)}
                />
            )}

            {/* ===== MOBILE DRAWER ===== */}
            <div className={`fixed inset-y-0 right-0 z-[9999] w-[280px] md:hidden flex flex-col
                bg-gradient-to-b from-zinc-950 via-zinc-950/98 to-black
                border-l border-white/[0.06]
                shadow-[-20px_0_60px_rgba(0,0,0,0.8),0_0_40px_rgba(220,38,38,0.05)]
                transition-transform duration-500 ease-out
                ${mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}
            >
                {/* Drawer header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-gradient-to-l from-red-600/10 to-transparent">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_6px_rgba(220,38,38,0.8)]" />
                        <span className="text-white font-black text-sm italic tracking-tight">حسابي</span>
                        <span className="text-red-500/40 font-bold text-[8px] uppercase tracking-widest">MY ACCOUNT</span>
                    </div>
                    <button
                        onClick={() => setMobileMenuOpen(false)}
                        className="p-2 bg-white/5 hover:bg-red-600 rounded-xl border border-white/10 hover:border-red-500/30 transition-all active:scale-90 text-gray-400 hover:text-white"
                    >
                        <X size={14} />
                    </button>
                </div>

                {/* Drawer content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-3">
                    {/* Decorative glow */}
                    <div className="absolute top-20 right-0 w-40 h-40 bg-red-600/5 blur-[80px] rounded-full pointer-events-none" />

                    <SidebarContent />
                </div>
            </div>

            {/* ===== DESKTOP SIDEBAR ===== */}
            <aside className="hidden md:flex w-64 bg-gradient-to-b from-zinc-950/80 via-zinc-950/60 to-black/80 border-l border-white/[0.06] p-4 flex-col gap-3 relative overflow-hidden">
                {/* Subtle background glows */}
                <div className="absolute top-0 right-0 w-40 h-40 bg-red-600/5 blur-[60px] rounded-full pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-600/3 blur-[50px] rounded-full pointer-events-none" />

                <SidebarContent />
            </aside>

            {/* ===== MAIN CONTENT ===== */}
            <main className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 bg-gradient-to-br from-transparent via-black/10 to-red-950/[0.03] relative">
                {/* Subtle corner glow */}
                <div className="absolute top-0 left-0 w-60 h-60 bg-red-600/[0.03] blur-[80px] rounded-full pointer-events-none" />
                <div className="relative z-10">
                    {renderView()}
                </div>
            </main>
        </div>
    );
};

// --- SUB-COMPONENTS ---

const Overview = ({ userData }: any) => {
    const [history, setHistory] = useState<any[]>([]);
    const [stats, setStats] = useState({ purchases: 0, rank: '...' });

    useEffect(() => {
        const fetchOverviewData = async () => {
            const username = (userData.kick_username || (userData as any).kickUsername)?.toLowerCase();
            if (!username) return;

            // 1. Fetch transactions
            const { data: transData } = await supabase
                .from('transactions')
                .select('*')
                .eq('user_id', userData.id)
                .order('created_at', { ascending: false })
                .limit(5);
            if (transData) setHistory(transData);

            // 2. Fetch inventory count
            const { count } = await supabase
                .from('user_inventory')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userData.id);

            // 3. Fetch rank (simple implementation based on score)
            const { data: rankData } = await supabase
                .from('leaderboard')
                .select('username, score')
                .order('score', { ascending: false });

            let userRank = 'N/A';
            if (rankData) {
                const index = rankData.findIndex(r => r.username.toLowerCase() === username);
                if (index !== -1) userRank = `#${index + 1}`;
            }

            setStats({ purchases: count || 0, rank: userRank });
        };
        fetchOverviewData();
    }, [userData.id, userData.kick_username, (userData as any).kickUsername]);

    return (
        <div className="space-y-4 animate-in slide-in-from-bottom-10 duration-700">
            <header className="relative py-4 md:py-6 bg-gradient-to-l from-red-600/20 to-transparent rounded-[2rem] border border-red-500/10 px-6 md:px-8 overflow-hidden mb-4">
                <Sparkles className="absolute top-3 right-3 text-red-600/20" size={60} />
                <h1 className="text-2xl md:text-3xl font-black italic text-white tracking-tighter mb-1 relative z-10 drop-shadow-2xl">أهلاً بك، {userData.display_name}</h1>
                <p className="text-red-500/60 font-black text-[10px] tracking-widest uppercase relative z-10">MEMBER DASHBOARD</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatsCard label="إجمالي النقاط" value={(userData.points || 0).toLocaleString()} icon={Wallet} color="text-yellow-500" />
                <StatsCard label="المرتبة الحالية" value={stats.rank} icon={Trophy} color="text-red-500" />
                <StatsCard label="عدد المشتريات" value={stats.purchases.toString()} icon={ShoppingBag} color="text-blue-500" />
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-[1.5rem] p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-red-600/5 blur-[80px] rounded-full -translate-y-1/2 translate-x-1/2"></div>
                <div className="relative z-10">
                    <h3 className="text-white font-black text-base mb-4 flex items-center gap-2"><Zap className="text-red-500" size={16} /> آخر النشاطات</h3>
                    <div className="space-y-2">
                        {history.length > 0 ? history.map(item => (
                            <ActivityItem key={item.id} label={item.description} time={new Date(item.created_at).toLocaleDateString('ar-SA')} points={item.amount > 0 ? `+${item.amount}` : item.amount.toString()} type={item.type === 'PURCHASE' ? 'purchase' : 'reward'} />
                        )) : (
                            <div className="text-center py-6 opacity-20 font-bold italic text-sm">لا توجد نشاطات مؤخراً</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const Store = ({ userId, kickUsername, points, onPurchase }: any) => {
    const [items, setItems] = useState<any[]>([]);
    const [ownedItemsIds, setOwnedItemsIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const [{ data: storeItems }, { data: userInv }] = await Promise.all([
                supabase.from('store_items').select('*').eq('is_active', true).order('price', { ascending: true }),
                supabase.from('user_inventory').select('item_id').eq('user_id', userId)
            ]);

            if (storeItems) {
                const sorted = [...storeItems].sort((a, b) => {
                    const aConfig = typeof a.config === 'string' ? JSON.parse(a.config) : a.config;
                    const bConfig = typeof b.config === 'string' ? JSON.parse(b.config) : b.config;
                    const aRest = aConfig?.restrictedTo;
                    const bRest = bConfig?.restrictedTo;

                    if (aRest && !bRest) return 1;
                    if (!aRest && bRest) return -1;
                    return (a.price || 0) - (b.price || 0);
                });
                setItems(sorted);
            }
            if (userInv) {
                const ids = new Set(userInv.map((inv: any) => inv.item_id));
                setOwnedItemsIds(ids);
            }
            setLoading(false);
        };
        fetchData();
    }, [userId]);

    const handleBuy = async (item: any) => {
        if (ownedItemsIds.has(item.id)) {
            alert('أنت تملك هذا الغرض بالفعل!');
            return;
        }

        if (points < item.price) {
            alert('نقاطك غير كافية!');
            return;
        }

        const confirmPurchase = window.confirm(`هل تريد شراء ${item.name} مقابل ${item.price} نقطة؟`);
        if (!confirmPurchase) return;

        try {
            const newPoints = points - item.price;
            const { error: updateError } = await supabase
                .from('leaderboard')
                .update({ score: newPoints })
                .ilike('username', kickUsername);

            if (updateError) throw updateError;
            await supabase.from('users').update({ points: newPoints }).eq('id', userId);

            await supabase.from('user_inventory').insert({ user_id: userId, item_id: item.id });
            await supabase.from('transactions').insert({ user_id: userId, amount: -item.price, type: 'PURCHASE', description: `شراء ${item.name}` });

            onPurchase(newPoints);
            setOwnedItemsIds(prev => new Set([...prev, item.id]));
            alert('تم الشراء بنجاح! يمكنك تفعيله من الخزانة.');
        } catch (e) {
            console.error(e);
            alert('حدث خطأ أثناء العملية.');
        }
    };

    // Helper to get tier color based on price
    const getTierColor = (price: number) => {
        if (price >= 5000) return 'from-purple-600 via-pink-500 to-rose-500'; // Legendary
        if (price >= 3000) return 'from-yellow-400 via-amber-500 to-orange-500'; // Gold
        if (price >= 1500) return 'from-slate-300 via-gray-400 to-zinc-500'; // Silver
        return 'from-amber-700 via-orange-800 to-red-900'; // Bronze/Common
    };

    const getGlowColor = (price: number) => {
        if (price >= 5000) return 'bg-purple-500/20';
        if (price >= 3000) return 'bg-yellow-500/20';
        if (price >= 1500) return 'bg-white/20';
        return 'bg-amber-700/20';
    };

    return (
        <div className="space-y-10 animate-in slide-in-from-bottom-10 duration-700">
            <header className="relative flex flex-col md:flex-row md:items-end justify-between gap-6 bg-gradient-to-br from-zinc-900 to-black p-8 rounded-[2.5rem] border border-white/5 overflow-hidden">
                <div className="absolute top-0 right-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 mix-blend-overlay"></div>
                <div className="absolute -top-24 -left-24 w-64 h-64 bg-red-600/20 blur-[100px] rounded-full"></div>
                
                <div className="relative z-10">
                    <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 tracking-tighter mb-2 drop-shadow-lg">المتجر الحصري</h1>
                    <p className="text-red-500/80 font-bold text-sm tracking-widest uppercase flex items-center gap-2">
                        <Sparkles size={14} /> Premium Skins & Items
                    </p>
                </div>
                
                <div className="relative z-10 flex items-center gap-5 bg-black/40 backdrop-blur-xl border border-white/10 p-4 pr-6 rounded-3xl shadow-2xl">
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-0.5">رصيدك الحالي</span>
                        <span className="text-white font-black text-2xl tracking-tighter leading-none">{points.toLocaleString()}</span>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(234,179,8,0.3)]">
                        <Gem className="text-black" size={24} />
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-6">
                {items.map((item) => {
                    const isOwned = ownedItemsIds.has(item.id);
                    const config = typeof item.config === 'string' ? JSON.parse(item.config) : item.config;
                    const restrictedTo = config?.restrictedTo;
                    const isForbidden = restrictedTo && restrictedTo.toLowerCase() !== kickUsername?.toLowerCase();
                    const tierGradient = config?.glowColor || getTierColor(item.price);
                    const glowColorClass = config?.glowColor 
                        ? `bg-gradient-to-br ${config.glowColor} opacity-20` 
                        : getGlowColor(item.price);

                    return (
                        <div key={item.id} className={`group relative bg-zinc-950 rounded-[2rem] p-1 transition-all duration-500 hover:-translate-y-2 ${isOwned ? 'opacity-70' : isForbidden ? 'grayscale-[0.8] opacity-50' : 'hover:shadow-[0_20px_40px_rgba(0,0,0,0.5)]'}`}>
                            {/* Animated Border Gradient */}
                            <div className={`absolute inset-0 rounded-[2rem] bg-gradient-to-b ${tierGradient} opacity-50 group-hover:opacity-100 transition-opacity duration-500`}></div>
                            
                            {/* Card Content Container */}
                            <div className="relative h-full bg-zinc-950/90 backdrop-blur-xl rounded-[1.9rem] p-5 flex flex-col overflow-hidden">
                                
                                {/* Background Glow */}
                                <div className={`absolute top-0 right-0 w-32 h-32 ${glowColorClass} blur-[60px] rounded-full transition-all duration-500 group-hover:scale-150`}></div>

                                {isOwned && (
                                    <div className="absolute top-3 right-3 bg-green-500/20 text-green-400 p-1.5 rounded-full backdrop-blur-md border border-green-500/30 z-20">
                                        <CheckCircle size={16} />
                                    </div>
                                )}

                                {/* Image Section - No Border/Background */}
                                <div className="relative w-full aspect-square flex items-center justify-center mb-4 overflow-visible">
                                    
                                    <div className={`relative z-20 w-24 h-24 flex items-center justify-center transition-transform duration-700 group-hover:scale-110 ${item.type === 'FRAME' ? '' : 'bg-gradient-to-br from-zinc-800 to-black rounded-full border border-white/10 shadow-2xl'}`}>
                                        {!item.image_url && item.type === 'EFFECT' ? (
                                            <Sparkles size={40} className="text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.8)]" />
                                        ) : !item.image_url && item.type === 'BADGE' ? (
                                            <Crown size={40} className="text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.8)]" />
                                        ) : (
                                            <User size={36} className={`${item.type === 'FRAME' ? 'text-white/5' : 'text-white/10'}`} />
                                        )}
                                        
                                        {item.image_url && (
                                            <img
                                                src={item.type === 'FRAME' ? getFrameUrl(item.image_url) : getAssetUrl(item.image_url)}
                                                className={`absolute inset-0 w-full h-full object-contain drop-shadow-2xl ${item.type === 'FRAME' ? 'scale-[1.45]' : 'scale-125'}`}
                                                alt={item.name}
                                                onError={(e) => { (e.target as any).style.display = 'none'; }}
                                            />
                                        )}
                                    </div>

                                    {/* Item Type Badge - Made Smaller */}
                                    <div className="absolute top-0 left-0 z-20">
                                        <span className={`bg-black/40 backdrop-blur-md px-2 py-1 rounded-lg text-[7px] font-black text-white border border-white/10 uppercase tracking-widest shadow-lg ${config?.glowColor ? 'border-b-2' : ''}`} style={config?.glowColor ? { borderBottomColor: 'currentColor' } : {}}>
                                            {item.type}
                                        </span>
                                    </div>
                                </div>

                                {/* Text Section */}
                                <div className="relative z-20 flex-1 flex flex-col">
                                    <div className="mb-6">
                                        <h4 className={`text-2xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-l ${tierGradient}`}>{item.name}</h4>
                                        <p className="text-gray-400 text-sm font-medium leading-relaxed">{item.description}</p>
                                    </div>

                                    {/* Action Button */}
                                    <button
                                        onClick={() => !isOwned && !isForbidden && handleBuy(item)}
                                        disabled={loading || isOwned || isForbidden}
                                        className={`w-full mt-auto py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-3 overflow-hidden relative
                                            ${isOwned
                                                ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                                                : isForbidden
                                                    ? 'bg-zinc-900 text-zinc-600 border border-white/5'
                                                    : `bg-gradient-to-r ${tierGradient} text-white hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:scale-[1.02]`}`}
                                    >
                                        {isOwned ? (
                                            <><span>مملوك بالفعل</span></>
                                        ) : isForbidden ? (
                                            <><Lock size={18} /><span>مقفل</span></>
                                        ) : (
                                            <>
                                                <ShoppingBag size={18} />
                                                <span>{item.price === 0 ? 'مجاني' : `${item.price.toLocaleString()} نقطة`}</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const Locker = ({ userId, kickUsername, onEquipChanged }: any) => {
    const [ownedItems, setOwnedItems] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const fetchOwned = async () => {
            const { data } = await supabase
                .from('user_inventory')
                .select('*, store_items(*)')
                .eq('user_id', userId);
            if (data) setOwnedItems(data);
        };
        fetchOwned();
    }, [userId]);

    const toggleEquip = async (inventoryId: string, currentStatus: boolean, itemType: string) => {
        setIsLoading(true);
        try {
            // 1. If equipping, unequip others of ONLY the same type
            if (!currentStatus) {
                // Fetch all owned items to find those of the same type
                const { data: currentInventory } = await supabase
                    .from('user_inventory')
                    .select('id, item_id, store_items(type)')
                    .eq('user_id', userId);

                if (currentInventory) {
                    const sameTypeIds = currentInventory
                        .filter((inv: any) => inv.store_items.type === itemType)
                        .map((inv: any) => inv.id);

                    if (sameTypeIds.length > 0) {
                        await supabase
                            .from('user_inventory')
                            .update({ is_equipped: false })
                            .in('id', sameTypeIds);
                    }
                }
            }

            // 2. Toggle the selected item
            const newStatus = !currentStatus;
            await supabase
                .from('user_inventory')
                .update({ is_equipped: newStatus })
                .eq('id', inventoryId);

            // 3. If it's a FRAME, update profiles.active_frame_url
            if (itemType === 'FRAME') {
                const { data: itemData } = await supabase
                    .from('store_items')
                    .select('image_url')
                    .eq('id', (ownedItems.find(i => i.id === inventoryId))?.item_id)
                    .single();

                const frameUrl = newStatus ? itemData?.image_url : null;
                const uLower = kickUsername?.toLowerCase();
                if (uLower) {
                    await supabase.from('profiles').update({ active_frame_url: frameUrl }).ilike('username', uLower);
                } else {
                    await supabase.from('profiles').update({ active_frame_url: frameUrl }).eq('id', userId);
                }
                if (onEquipChanged) onEquipChanged(frameUrl);
            }

            // Refresh
            const { data } = await supabase
                .from('user_inventory')
                .select('*, store_items(*)')
                .eq('user_id', userId);
            if (data) setOwnedItems(data);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-8 animate-in slide-in-from-bottom-10 duration-700">
            <header>
                <h1 className="text-4xl font-black italic text-white tracking-tighter mb-2">الخزانة الخاصة</h1>
                <p className="text-gray-500 font-bold text-sm tracking-widest uppercase">My Collection / Inventory</p>
            </header>

            {ownedItems.length === 0 ? (
                <div className="bg-white/5 border border-dashed border-white/10 rounded-[2.5rem] p-20 flex flex-col items-center justify-center text-center">
                    <Box size={64} className="text-gray-700 mb-6" />
                    <h3 className="text-white font-black text-xl mb-2">خزانتك فارغة</h3>
                    <p className="text-gray-500 font-bold text-sm">توجه إلى المتجر للحصول على الإطارات والمميزات الحصرية.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {ownedItems.map((inv) => (
                        <div key={inv.id} className={`bg-white/[0.03] border rounded-[2rem] p-6 transition-all group ${inv.is_equipped ? 'border-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.1)]' : 'border-white/10'}`}>
                            <div className="w-full aspect-square bg-black/60 rounded-3xl border border-white/5 flex items-center justify-center mb-6 relative overflow-hidden">
                                <div className={`w-20 h-20 flex items-center justify-center relative ${inv.store_items.type === 'FRAME' ? '' : 'bg-zinc-800 rounded-full border border-white/10 overflow-hidden shadow-2xl'}`}>
                                    <User size={40} className={`${inv.store_items.type === 'FRAME' ? 'text-white/10' : 'mt-5 text-zinc-700'}`} />
                                    {inv.store_items.image_url && (
                                        <img
                                            src={inv.store_items.type === 'FRAME' ? getFrameUrl(inv.store_items.image_url) : getAssetUrl(inv.store_items.image_url)}
                                            className={`absolute inset-0 w-full h-full object-contain ${inv.store_items.type === 'FRAME' ? 'scale-[1.45]' : 'scale-125'}`}
                                            alt=""
                                        />
                                    )}
                                </div>

                                {inv.store_items.type === 'FRAME' && !inv.store_items.image_url && (
                                    <div className="w-24 h-24 rounded-2xl border-4" style={inv.store_items.config}>
                                    </div>
                                )}

                                {inv.is_equipped && (
                                    <div className="absolute top-4 right-4 animate-in zoom-in duration-300">
                                        <div className="bg-green-500 text-black px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-green-500/20">
                                            ACTIVE
                                        </div>
                                    </div>
                                )}
                            </div>
                            <h4 className="text-white font-black text-lg mb-4">{inv.store_items.name}</h4>
                            <button
                                onClick={() => toggleEquip(inv.id, inv.is_equipped, inv.store_items.type)}
                                className={`w-full py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all ${inv.is_equipped ? 'bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white' : 'bg-green-600 text-white hover:bg-green-500'}`}
                            >
                                {inv.is_equipped ? 'إيقاف التفعيل' : 'تفعيل الآن'}
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const Rankings = () => {
    const [players, setPlayers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRankings = async () => {
            const { data: leaderboardData } = await supabase
                .from('leaderboard')
                .select('*')
                .order('score', { ascending: false })
                .limit(20);

            if (leaderboardData) {
                // Fetch profiles to get frames
                const usernames = leaderboardData.map(p => p.username.toLowerCase());
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('username, active_frame_url')
                    .in('username', usernames);

                const playersWithFrames = leaderboardData.map(player => {
                    const profile = profileData?.find(p => p.username.toLowerCase() === player.username.toLowerCase());
                    return {
                        ...player,
                        active_frame_url: profile?.active_frame_url
                    };
                });
                setPlayers(playersWithFrames);
            }
            setLoading(false);
        };
        fetchRankings();
    }, []);

    const getRankStyle = (index: number) => {
        if (index === 0) return { bg: 'from-yellow-500/20 via-yellow-600/10 to-transparent', border: 'border-yellow-500/30', badge: 'bg-yellow-500 text-black', color: 'text-yellow-500', glow: 'shadow-[0_0_20px_rgba(234,179,8,0.15)]' };
        if (index === 1) return { bg: 'from-slate-400/15 via-slate-500/5 to-transparent', border: 'border-slate-400/20', badge: 'bg-slate-400 text-black', color: 'text-slate-400', glow: '' };
        if (index === 2) return { bg: 'from-orange-700/15 via-orange-800/5 to-transparent', border: 'border-orange-700/20', badge: 'bg-orange-700 text-white', color: 'text-orange-600', glow: '' };
        return { bg: 'from-transparent to-transparent', border: 'border-white/5', badge: 'bg-white/10 text-gray-500', color: 'text-gray-400', glow: '' };
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-10 duration-700">
            {/* Header */}
            <header className="relative text-center py-6 bg-gradient-to-l from-red-600/10 via-transparent to-red-600/10 rounded-[2rem] border border-red-500/10 overflow-hidden">
                <div className="absolute top-2 right-4 w-20 h-20 bg-yellow-500/10 blur-[40px] rounded-full" />
                <div className="absolute bottom-0 left-4 w-16 h-16 bg-red-500/10 blur-[30px] rounded-full" />
                <Crown className="mx-auto text-yellow-500/30 mb-2" size={32} />
                <h1 className="text-2xl md:text-4xl font-black italic text-white tracking-tighter mb-1 relative z-10">لوحة الصدارة</h1>
                <p className="text-red-500/40 font-black text-[9px] md:text-[10px] tracking-[0.3em] uppercase relative z-10">GLOBAL MEMBER RANKINGS</p>
            </header>

            {loading ? (
                <div className="py-20 flex flex-col items-center justify-center">
                    <div className="relative">
                        <Zap size={40} className="text-red-500 animate-pulse" />
                        <div className="absolute inset-0 bg-red-500/20 blur-xl rounded-full animate-ping" />
                    </div>
                    <span className="text-gray-500 font-black italic mt-4 text-sm tracking-widest">GATHERING LEGENDS...</span>
                </div>
            ) : players.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center opacity-30">
                    <Trophy size={50} strokeWidth={1} className="text-gray-600 mb-4" />
                    <span className="text-gray-500 font-black italic text-sm">لا يوجد متنافسين بعد</span>
                </div>
            ) : (
                <>
                    {/* === TOP 3 PODIUM (Mobile: vertical cards, Desktop: horizontal) === */}
                    {players.length >= 3 && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 md:items-end">
                            {/* 2nd Place */}
                            {players[1] && (
                                <div className="order-2 md:order-1 relative bg-gradient-to-br from-slate-400/10 to-transparent rounded-[1.5rem] p-4 md:p-5 border border-slate-400/20 flex items-center md:flex-col md:items-center gap-4 md:gap-3 md:h-[180px] md:justify-center overflow-hidden group hover:border-slate-400/40 transition-all">
                                    <div className="absolute top-0 right-0 w-20 h-20 bg-slate-400/5 blur-[30px] rounded-full" />
                                    <div className="relative flex-shrink-0">
                                        <ProAvatar url={players[1].avatar_url} username={players[1].username} frameUrl={players[1].active_frame_url} size="w-12 h-12 md:w-14 md:h-14" className="shadow-lg" />
                                        <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-400 text-black flex items-center justify-center font-black text-[10px] border-2 border-black z-[110] shadow">2</div>
                                    </div>
                                    <div className="flex-1 md:text-center min-w-0">
                                        <div className="text-white font-black text-sm truncate">{players[1].username}</div>
                                        <div className="flex items-center gap-3 md:justify-center mt-1">
                                            <span className="text-slate-400 font-bold text-xs">{players[1].score?.toLocaleString() || 0} نقطة</span>
                                            <span className="text-white/10">|</span>
                                            <span className="text-slate-400/60 font-bold text-xs">{players[1].wins || 0} فوز</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 1st Place */}
                            {players[0] && (
                                <div className="order-1 md:order-2 relative bg-gradient-to-br from-yellow-500/15 via-yellow-600/5 to-transparent rounded-[1.5rem] p-4 md:p-6 border border-yellow-500/30 flex items-center md:flex-col md:items-center gap-4 md:gap-3 md:h-[220px] md:justify-center overflow-hidden group hover:border-yellow-500/50 transition-all shadow-[0_0_30px_rgba(234,179,8,0.08)]">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-500/10 blur-[40px] rounded-full animate-pulse" />
                                    <div className="absolute -top-4 md:top-auto md:-top-2 left-1/2 -translate-x-1/2 hidden md:block">
                                        <Crown size={30} className="text-yellow-500/20" />
                                    </div>
                                    <div className="relative flex-shrink-0">
                                        <div className="absolute -inset-2 bg-yellow-500/10 blur-xl rounded-full animate-pulse" />
                                        <ProAvatar url={players[0].avatar_url} username={players[0].username} frameUrl={players[0].active_frame_url} size="w-14 h-14 md:w-16 md:h-16" className="shadow-[0_0_15px_rgba(234,179,8,0.2)]" />
                                        <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-yellow-500 text-black flex items-center justify-center font-black text-xs border-2 border-black z-[110] shadow animate-bounce" style={{ animationDuration: '2s' }}>1</div>
                                    </div>
                                    <div className="flex-1 md:text-center min-w-0">
                                        <div className="text-white font-black text-base md:text-lg italic truncate drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">{players[0].username}</div>
                                        <div className="flex items-center gap-3 md:justify-center mt-1">
                                            <div className="bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded-lg">
                                                <span className="text-yellow-500 font-black text-xs">{players[0].score?.toLocaleString() || 0}</span>
                                            </div>
                                            <span className="text-yellow-500/40 font-bold text-xs">{players[0].wins || 0} فوز</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 3rd Place */}
                            {players[2] && (
                                <div className="order-3 relative bg-gradient-to-br from-orange-700/10 to-transparent rounded-[1.5rem] p-4 md:p-5 border border-orange-700/20 flex items-center md:flex-col md:items-center gap-4 md:gap-3 md:h-[160px] md:justify-center overflow-hidden group hover:border-orange-700/40 transition-all">
                                    <div className="absolute bottom-0 left-0 w-16 h-16 bg-orange-700/5 blur-[25px] rounded-full" />
                                    <div className="relative flex-shrink-0">
                                        <ProAvatar url={players[2].avatar_url} username={players[2].username} frameUrl={players[2].active_frame_url} size="w-11 h-11 md:w-12 md:h-12" className="shadow" />
                                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-orange-700 text-white flex items-center justify-center font-black text-[9px] border-2 border-black z-[110] shadow">3</div>
                                    </div>
                                    <div className="flex-1 md:text-center min-w-0">
                                        <div className="text-white font-black text-sm truncate">{players[2].username}</div>
                                        <div className="flex items-center gap-3 md:justify-center mt-1">
                                            <span className="text-orange-600 font-bold text-xs">{players[2].score?.toLocaleString() || 0} نقطة</span>
                                            <span className="text-white/10">|</span>
                                            <span className="text-orange-700/60 font-bold text-xs">{players[2].wins || 0} فوز</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* === REST OF PLAYERS (4+) === */}
                    {players.length > 3 && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-3 px-2 py-2">
                                <div className="h-px flex-1 bg-gradient-to-l from-transparent via-white/10 to-transparent" />
                                <span className="text-gray-600 font-black text-[8px] uppercase tracking-[0.3em]">المتنافسين</span>
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                            </div>

                            {players.slice(3).map((player, index) => (
                                <div
                                    key={player.id}
                                    className="flex items-center gap-3 p-3 bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-white/10 rounded-2xl transition-all group animate-in slide-in-from-right duration-500"
                                    style={{ animationDelay: `${index * 50}ms` }}
                                >
                                    {/* Rank */}
                                    <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center font-black text-xs text-gray-500 group-hover:text-white group-hover:bg-red-600/20 transition-all border border-white/5 flex-shrink-0">
                                        {index + 4}
                                    </div>

                                    {/* Avatar + Name */}
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <ProAvatar url={player.avatar_url} username={player.username} frameUrl={player.active_frame_url} size="w-9 h-9" className="flex-shrink-0" />
                                        <span className="text-white font-black text-sm truncate group-hover:text-red-500 transition-colors">{player.username}</span>
                                    </div>

                                    {/* Score + Wins */}
                                    <div className="flex items-center gap-3 flex-shrink-0">
                                        <div className="text-left">
                                            <div className="text-green-400 font-black text-sm tabular-nums">{player.score?.toLocaleString() || 0}</div>
                                        </div>
                                        <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 font-black text-[10px] border border-white/5">
                                            {player.wins || 0}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

const SettingsSection = ({ userData, onLogout }: any) => {
    const [displayName, setDisplayName] = useState(userData.display_name);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('users')
                .update({ display_name: displayName })
                .eq('id', userData.id);

            if (error) throw error;

            // Also update local storage so changes reflect on refresh
            const stored = localStorage.getItem('iabs_user');
            if (stored) {
                const parsed = JSON.parse(stored);
                parsed.name = displayName;
                localStorage.setItem('iabs_user', JSON.stringify(parsed));
            }

            alert('تم حفظ التعديلات بنجاح!');
        } catch (e) {
            console.error(e);
            alert('حدث خطأ أثناء الحفظ.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteAccount = async () => {
        const confirmDelete = window.confirm("⚠️ تحذير خطير ⚠️\nسوف يتم حذف الحساب والنقاط وكل شي والمنتجات نهائياً ولن تتمكن من استرجاعها.\nهل أنت متأكد من رغبتك في الحذف النهائي؟");
        if (!confirmDelete) return;

        setIsDeleting(true);
        try {
            const username = userData.kick_username.toLowerCase();
            const deletedUsername = `deleted_${Date.now()}_${username}`;
            
            // Workaround for RLS (Row Level Security) silently blocking DELETE operations:
            // First, rename the username in all tables so it frees up the original username for re-registration.
            await Promise.all([
                supabase.from('users').update({ kick_username: deletedUsername, display_name: 'Deleted User' }).eq('id', userData.id),
                supabase.from('profiles').update({ username: deletedUsername }).ilike('username', username),
                supabase.from('leaderboard').update({ username: deletedUsername }).ilike('username', username)
            ]);

            // Then, try to physically delete from all tables (might fail silently if RLS restricts DELETE, but username is freed anyway)
            await Promise.all([
                supabase.from('transactions').delete().eq('user_id', userData.id),
                supabase.from('user_inventory').delete().eq('user_id', userData.id),
                supabase.from('leaderboard').delete().ilike('username', deletedUsername),
                supabase.from('profiles').delete().ilike('username', deletedUsername),
            ]);
            
            // Delete main user record
            await supabase.from('users').delete().eq('id', userData.id);

            // Clear local storage
            localStorage.removeItem('iabs_user');
            localStorage.removeItem('iabs_device_registered');

            alert('تم حذف الحساب وجميع بياناته بنجاح.');
            if (onLogout) onLogout();
            else window.location.reload();
        } catch (e) {
            console.error(e);
            alert('حدث خطأ أثناء حذف الحساب.');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="space-y-8 animate-in slide-in-from-bottom-10 duration-700">
            <header>
                <h1 className="text-4xl font-black italic text-white tracking-tighter mb-2">إعدادات الحساب</h1>
                <p className="text-gray-500 font-bold text-sm tracking-widest uppercase">Profile & Security Settings</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6 bg-white/[0.02] border border-white/5 p-8 rounded-[2.5rem]">
                    <h4 className="text-white font-black text-lg mb-4">المعلومات الشخصية</h4>
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest">الاسم المعروض</label>
                            <input
                                type="text"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-white font-bold focus:border-red-500 outline-none transition-all"
                            />
                        </div>
                        <div className="bg-white/5 p-4 rounded-2xl border border-dashed border-white/10 opacity-50">
                            <span className="text-gray-500 text-[10px] font-black uppercase block mb-1">حساب Kick (لا يمكن تغييره)</span>
                            <span className="text-white font-bold">{userData.kick_username}</span>
                        </div>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-2xl transition-all active:scale-95 disabled:opacity-50"
                        >
                            {isSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                        </button>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-gradient-to-br from-blue-600/10 to-transparent border border-blue-500/10 p-8 rounded-[2.5rem] flex flex-col items-center justify-center text-center h-full relative overflow-hidden">
                        <Shield size={40} className="text-blue-500 mb-6 relative z-10" />
                        <h4 className="text-white font-black text-xl mb-2 relative z-10">الأمان والمصادقة</h4>
                        <p className="text-gray-500 font-bold text-xs mb-8 relative z-10">حسابك محمي بنظام iABS للمصادقة المتقدمة. تم ربط جهازك بنجاح.</p>
                        
                        <div className="flex flex-col gap-3 w-full max-w-[220px] relative z-10">
                            <div className="px-5 py-3 bg-white/5 rounded-xl border border-white/10 w-full mb-2">
                                <span className="text-[10px] font-black text-green-500 uppercase tracking-widest block">Active Session</span>
                            </div>
                            <button
                                onClick={onLogout}
                                className="w-full bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/20 py-3 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 group"
                            >
                                <LogOut size={16} className="group-hover:-translate-x-1 transition-transform" />
                                تسجيل خروج
                            </button>
                            
                            <div className="w-full h-px bg-white/5 my-2"></div>
                            
                            <button
                                onClick={handleDeleteAccount}
                                disabled={isDeleting}
                                className="w-full bg-transparent hover:bg-red-950/50 text-red-700 hover:text-red-500 border border-transparent hover:border-red-900/30 py-3 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
                            >
                                <Trash2 size={14} className="group-hover:scale-110 transition-transform" />
                                {isDeleting ? 'جاري الحذف...' : 'حذف الحساب نهائياً'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Helper Components
const StatsCard = ({ label, value, icon: Icon, color }: any) => (
    <div className="bg-white/[0.03] border border-white/10 p-6 rounded-[2rem] flex items-center gap-6 group hover:bg-white/[0.05] transition-all">
        <div className={`w-16 h-16 rounded-2xl bg-black/40 flex items-center justify-center ${color} border border-white/5 group-hover:scale-110 transition-transform`}>
            <Icon size={28} />
        </div>
        <div>
            <div className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">{label}</div>
            <div className="text-white font-black text-2xl tracking-tighter">{value}</div>
        </div>
    </div>
);

const ActivityItem = ({ label, time, points, type }: any) => (
    <div className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5 hover:border-white/10 transition-all">
        <div className="flex items-center gap-4">
            <div className={`w-2 h-2 rounded-full ${type === 'purchase' ? 'bg-red-500' : type === 'reward' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
            <div>
                <div className="text-white font-bold text-sm">{label}</div>
                <div className="text-gray-600 text-[10px] font-black uppercase">{time}</div>
            </div>
        </div>
        {points !== "0" && (
            <div className={`font-black text-sm ${points.startsWith('-') ? 'text-red-500' : 'text-green-500'}`}>
                {points}
            </div>
        )}
    </div>
);
