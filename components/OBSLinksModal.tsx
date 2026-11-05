import React, { useState } from 'react';
import {
    X, Copy, Check, Sparkles, Armchair, Swords,
    Image as ImageIcon, Zap, Gift, Flag, Users2,
    Keyboard, Gem, Coffee, PaintBucket, ExternalLink, AlertTriangle, Shield, TrendingUp, Eye,
    CheckCircle2, Share2, Monitor, Layout as LayoutIcon, Globe, Info, ShieldOff, Vote
} from 'lucide-react';
import { ViewState } from '../types';

interface OBSLinksModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface GameLink {
    id: ViewState;
    label: string;
    icon: any;
}

const GAMES: GameLink[] = [
    { id: 'FAWAZIR_GAME', label: 'الفوازير', icon: Sparkles },
    { id: 'MUSICAL_CHAIRS', label: 'الكراسي الموسيقية', icon: Armchair },
    { id: 'MASAQIL_WAR', label: 'حرب المصاقيل', icon: Swords },
    { id: 'BLUR_GUESS', label: 'تخمين الصورة', icon: ImageIcon },
    { id: 'SPIN_WHEEL', label: 'الروليت', icon: Zap },
    { id: 'RAFFLE', label: 'سحب الجوائز', icon: Gift },
    { id: 'FLAG_QUIZ', label: 'تحدي الأعلام', icon: Flag },
    { id: 'TEAM_BATTLE', label: 'حرب الفرق', icon: Users2 },
    { id: 'TYPING_RACE', label: 'سباق الكتابة', icon: Keyboard },
    { id: 'GRID_HUNT', label: 'صائد الماوس باد', icon: Gem },
    { id: 'CUP_SHUFFLE', label: 'تحدي الأكواب', icon: Coffee },
    { id: 'TERRITORY_WAR', label: 'حرب الألوان', icon: PaintBucket },
    { id: 'TRUTH_OR_LIE', label: 'صادق أم كذاب', icon: AlertTriangle },
    { id: 'FORBIDDEN_WORDS', label: 'الممنوع مرغوب', icon: ShieldOff },
    { id: 'VOTING_GAME', label: 'لعبة التصويت', icon: Vote },
    { id: 'LETTER_GAME', label: 'حروف مع منصور', icon: LayoutIcon },
];

export const OBSLinksModal: React.FC<OBSLinksModalProps> = ({ isOpen, onClose }) => {
    const [copiedId, setCopiedId] = useState<string | null>(null);

    if (!isOpen) return null;

    const generateLink = (viewId: string) => {
        const baseUrl = window.location.origin;
        return `${baseUrl}/?obs=true&view=${viewId}&transparent=true`;
    };

    const generateSecretLink = () => {
        const baseUrl = window.location.origin;
        return `${baseUrl}/?obs=true&view=TRUTH_OR_LIE&secret=true`;
    };

    const generateStatsLink = () => {
        const baseUrl = window.location.origin;
        return `${baseUrl}/?obs=true&view=TRUTH_OR_LIE&stats=true`;
    };

    const handleCopy = (id: string, text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
            {/* Ultra Premium Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-2xl"
                onClick={onClose}
            >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-blue-500/10 opacity-30"></div>
            </div>

            {/* Modal Container - Ultra Sleek */}
            <div className="relative w-full max-w-5xl bg-[#0a0a0c] border border-white/10 rounded-[2.5rem] shadow-[0_0_100px_rgba(147,51,234,0.15)] overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-8 duration-500">

                {/* Decoration */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-50"></div>

                {/* Header */}
                <div className="p-8 border-b border-white/5 bg-gradient-to-r from-purple-900/10 to-transparent flex items-center justify-between">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-[0_0_30px_rgba(147,51,234,0.4)] ring-1 ring-white/20">
                            <Monitor className="text-white" size={28} />
                        </div>
                        <div>
                            <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase leading-none mb-1">روابط OBS</h2>
                            <p className="text-purple-400/80 font-bold text-xs tracking-[0.2em] uppercase">Professional Stream Engine</p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-12 h-12 rounded-full bg-white/5 hover:bg-red-500/20 text-white/50 hover:text-red-500 flex items-center justify-center transition-all border border-white/5 hover:border-red-500/30 group"
                    >
                        <X size={24} className="group-hover:rotate-90 transition-transform duration-300" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-10">

                    {/* Standard Game Links */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 ml-2">
                            <Globe className="text-purple-400" size={20} />
                            <h3 className="text-xl font-black text-white uppercase tracking-wider">الألعاب الرئيسية</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {GAMES.map((game) => (
                                <div
                                    key={game.id}
                                    className="group relative bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 hover:border-purple-500/30 rounded-3xl p-5 flex flex-col gap-5 transition-all duration-500 hover:translate-y-[-4px] hover:shadow-[0_10px_30px_rgba(0,0,0,0.3)]"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-center shadow-lg group-hover:border-purple-500/40 transition-colors">
                                            <game.icon size={24} className="text-gray-400 group-hover:text-purple-400 transition-colors" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-lg font-black text-white truncate">{game.label}</h3>
                                            <div className="flex gap-2 mt-1">
                                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
                                                <span className="text-[10px] font-bold text-white/40 uppercase tracking-tighter">Ready to Stream</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleCopy(game.id, generateLink(game.id))}
                                            className={`
                                                flex-1 h-12 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 border-2
                                                ${copiedId === game.id
                                                    ? 'bg-green-500/20 text-green-400 border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.2)]'
                                                    : 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-400/50 hover:border-indigo-400'}
                                            `}
                                        >
                                            {copiedId === game.id ? (
                                                <><Check size={18} /> تم النسخ</>
                                            ) : (
                                                <><Copy size={18} /> نسخ الرابط</>
                                            )}
                                        </button>

                                        <button
                                            onClick={() => window.open(generateLink(game.id), '_blank')}
                                            className="w-12 h-12 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/30 flex items-center justify-center text-white/50 hover:text-white transition-all group/btn"
                                            title="معاينة"
                                        >
                                            <ExternalLink size={18} className="group-hover/btn:scale-110 transition-transform" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Pro Links - Truth or Lie Special */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 ml-2 text-yellow-500">
                            <Shield className="animate-pulse" size={20} />
                            <h3 className="text-xl font-black uppercase tracking-wider">روابط احترافية (صادق أم كذاب)</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Stats Page */}
                            <div className="relative group p-6 rounded-[2rem] bg-gradient-to-br from-cyan-500/10 to-transparent border border-cyan-500/20 hover:border-cyan-500/40 transition-all duration-500 overflow-hidden">
                                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <TrendingUp size={120} />
                                </div>
                                <div className="relative z-10 space-y-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-2xl bg-cyan-600 flex items-center justify-center shadow-lg shadow-cyan-900/20">
                                            <TrendingUp size={28} className="text-white" />
                                        </div>
                                        <div>
                                            <h4 className="text-2xl font-black text-white">لوحة الإحصائيات</h4>
                                            <p className="text-cyan-400/80 font-bold text-xs uppercase italic tracking-widest">Live Dynamic Stats</p>
                                        </div>
                                    </div>
                                    <p className="text-gray-400 text-sm font-bold leading-relaxed px-1">
                                        يعرض أرقام الأصوات (صادق/كاذب) والنتيجة النهائية بخلفية شفافة تماماً. مثالي للعرض أعلى البث.
                                    </p>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => handleCopy('stats-link', generateStatsLink())}
                                            className={`
                                                flex-1 h-14 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-3 border-2
                                                ${copiedId === 'stats-link'
                                                    ? 'bg-green-500/20 text-green-400 border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.3)]'
                                                    : 'bg-cyan-600 hover:bg-cyan-500 text-white border-cyan-400 shadow-lg shadow-cyan-900/20'}
                                            `}
                                        >
                                            {copiedId === 'stats-link' ? <><CheckCircle2 size={24} /> تم النسخ</> : <><Copy size={24} /> نسخ رابط الإحصائيات</>}
                                        </button>
                                        <button
                                            onClick={() => window.open(generateStatsLink(), '_blank')}
                                            className="w-14 h-14 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-500/40 flex items-center justify-center text-white/50 hover:text-white transition-all"
                                        >
                                            <ExternalLink size={24} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Secret Content Page */}
                            <div className="relative group p-6 rounded-[2rem] bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/20 hover:border-purple-500/40 transition-all duration-500 overflow-hidden">
                                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Eye size={120} />
                                </div>
                                <div className="relative z-10 space-y-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-2xl bg-purple-600 flex items-center justify-center shadow-lg shadow-purple-900/20">
                                            <Eye size={28} className="text-white" />
                                        </div>
                                        <div>
                                            <h4 className="text-2xl font-black text-white">المحتوى السري</h4>
                                            <p className="text-purple-400/80 font-bold text-xs uppercase italic tracking-widest">Host Secret View</p>
                                        </div>
                                    </div>
                                    <p className="text-gray-400 text-sm font-bold leading-relaxed px-1">
                                        يعرض الصورة أو الحقيقة السرية فقط مع خلفية بتصميم فاخر. هذا الرابط للمذيع فقط ليرى المحتوى!
                                    </p>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => handleCopy('secret-link', generateSecretLink())}
                                            className={`
                                                flex-1 h-14 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-3 border-2
                                                ${copiedId === 'secret-link'
                                                    ? 'bg-green-500/20 text-green-400 border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.3)]'
                                                    : 'bg-purple-600 hover:bg-purple-500 text-white border-purple-400 shadow-lg shadow-purple-900/20'}
                                            `}
                                        >
                                            {copiedId === 'secret-link' ? <><CheckCircle2 size={24} /> تم النسخ</> : <><Copy size={24} /> نسخ رابط المحتوى</>}
                                        </button>
                                        <button
                                            onClick={() => window.open(generateSecretLink(), '_blank')}
                                            className="w-14 h-14 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/40 flex items-center justify-center text-white/50 hover:text-white transition-all"
                                        >
                                            <ExternalLink size={24} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* How to use - Detailed Instructions */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 ml-2 text-indigo-400">
                            <Info size={24} />
                            <h3 className="text-xl font-black uppercase tracking-wider">كيفية ربط الروابط ببرامج البث</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-10">
                            {/* OBS Studio Card */}
                            <div className="bg-gradient-to-br from-[#1e1e2e]/80 to-black/80 border border-white/10 rounded-[2rem] p-8 space-y-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center font-black text-white shadow-lg">OBS</div>
                                    <h4 className="text-2xl font-black text-white italic">إعدادات OBS Studio</h4>
                                </div>
                                <ul className="space-y-3 text-gray-400 font-bold text-sm">
                                    <li className="flex items-start gap-3">
                                        <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/30">1</span>
                                        <span>قم بالضغط على علامة <span className="text-white">+</span> في مصادر الـ <span className="text-white">Sources</span>.</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/30">2</span>
                                        <span>اختر <span className="text-white">Browser Source</span> وقم بتسميته.</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/30">3</span>
                                        <span>الصق الرابط الذي نسخته في مربع الـ <span className="text-white">URL</span>.</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/30">4</span>
                                        <span>اضبط الـ Width على <span className="text-white">1920</span> والـ Height على <span className="text-white">1080</span>.</span>
                                    </li>
                                </ul>
                            </div>

                            {/* Streamlabs Card */}
                            <div className="bg-gradient-to-br from-[#00ffd2]/5 to-black/80 border border-[#00ffd2]/20 rounded-[2rem] p-8 space-y-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-[#00ffd2] flex items-center justify-center font-black text-black shadow-lg shadow-[#00ffd2]/20">SL</div>
                                    <h4 className="text-2xl font-black text-white italic">إعدادات Streamlabs Desktop</h4>
                                </div>
                                <ul className="space-y-3 text-gray-400 font-bold text-sm">
                                    <li className="flex items-start gap-3">
                                        <span className="w-6 h-6 rounded-full bg-[#00ffd2]/10 text-[#00ffd2] flex items-center justify-center shrink-0 border border-[#00ffd2]/20">1</span>
                                        <span>انقر على زر الـ <span className="text-white">+</span> لإضافة مصدر مشهد جديد.</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <span className="w-6 h-6 rounded-full bg-[#00ffd2]/10 text-[#00ffd2] flex items-center justify-center shrink-0 border border-[#00ffd2]/20">2</span>
                                        <span>ابحث عن <span className="text-white">Browser Source</span> ضمن العناصر القياسية.</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <span className="w-6 h-6 rounded-full bg-[#00ffd2]/10 text-[#00ffd2] flex items-center justify-center shrink-0 border border-[#00ffd2]/20">3</span>
                                        <span>قم بتفعيل خيار <span className="text-white">Shutdown source when not visible</span> لتقليل الضغط.</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <span className="w-6 h-6 rounded-full bg-[#00ffd2]/10 text-[#00ffd2] flex items-center justify-center shrink-0 border border-[#00ffd2]/20">4</span>
                                        <span>تأكد من اختيار <span className="text-white">Use Custom Frame Rate</span> وضبطه على 60FPS.</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};
