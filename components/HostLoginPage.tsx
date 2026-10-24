import React, { useState, useEffect } from 'react';
import { User, LogIn, Sparkles, Trophy, Star, Shield, ArrowRight, ChevronRight, Loader2, Crown, Zap, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { supabase } from '../services/supabase';
import { ProAvatar } from './ProAvatar';

interface HostLoginPageProps {
  onSuccess: (hostData: { name: string; kickUsername: string; avatar?: string; points: number }) => void;
  onBack: () => void;
}

export const HostLoginPage: React.FC<HostLoginPageProps> = ({ onSuccess, onBack }) => {
  const [kickUsername, setKickUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'LOGIN' | 'PROFILE'>('LOGIN');
  const [hostData, setHostData] = useState<any>(null);
  const [points, setPoints] = useState(0);
  const [wins, setWins] = useState(0);
  const [avatar, setAvatar] = useState('');

  // Particles
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 3 + 1,
    delay: Math.random() * 5,
    duration: Math.random() * 10 + 10,
  }));

  const handleLogin = async () => {
    const username = kickUsername.trim().toLowerCase();
    if (!username) {
      setError('أدخل اسم المستخدم في Kick');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Fetch avatar from Kick
      let avatarUrl = '';
      try {
        const res = await fetch(`/kick-api/api/v2/channels/${username}`);
        if (res.ok) {
          const data = await res.json();
          avatarUrl = data?.user?.profile_pic || '';
        }
      } catch (e) {
        console.warn('[HostLogin] Could not fetch Kick avatar');
      }

      // Fetch points from leaderboard
      const { data: lbData, error: lbError } = await supabase
        .from('leaderboard')
        .select('score, wins')
        .ilike('username', username)
        .order('score', { ascending: false })
        .limit(1);

      if (lbError) {
        console.error('[HostLogin] Leaderboard error:', lbError);
      }

      // Fetch profile for fallback avatar
      const { data: profileData } = await supabase
        .from('profiles')
        .select('avatar_url')
        .ilike('username', username)
        .limit(1);

      const userPoints = lbData?.[0]?.score || 0;
      const userWins = lbData?.[0]?.wins || 0;
      const lbAvatar = profileData?.[0]?.avatar_url || '';

      setPoints(userPoints);
      setWins(userWins);
      setAvatar(avatarUrl || lbAvatar);
      setHostData({ name: username, kickUsername: username });
      setStep('PROFILE');
    } catch (e) {
      setError('حدث خطأ، حاول مرة أخرى');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnter = () => {
    onSuccess({
      name: hostData.name,
      kickUsername: hostData.kickUsername,
      avatar: avatar,
      points: points,
    });
  };

  return (
    <div className="icg1-auth relative w-full h-full flex items-center justify-center overflow-hidden" dir="rtl">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-black via-emerald-950/20 to-black" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-emerald-500/5 blur-[150px] rounded-full animate-pulse" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-teal-600/5 blur-[120px] rounded-full" />
      <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-cyan-600/5 blur-[100px] rounded-full" />

      {/* Floating Particles */}
      {particles.map(p => (
        <div key={p.id} className="absolute rounded-full bg-emerald-500/20 animate-pulse pointer-events-none"
          style={{
            left: `${p.x}%`, top: `${p.y}%`,
            width: `${p.size}px`, height: `${p.size}px`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}

      {/* Main Card */}
      <div className="relative z-10 w-full max-w-md mx-4" style={{ animation: 'fadeIn 0.6s ease-out' }}>

        {step === 'LOGIN' && (
          <div className="relative">
            {/* Trial Badge */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20">
              <div className="px-6 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full shadow-[0_0_25px_rgba(245,158,11,0.4)] border border-amber-400/50">
                <span className="text-black font-black text-[11px] uppercase tracking-[0.25em] flex items-center gap-1.5">
                  <Sparkles size={12} /> تجريبي <span className="text-amber-900/60">BETA</span>
                </span>
              </div>
            </div>

            {/* Card */}
            <div className="bg-gradient-to-b from-white/[0.06] to-white/[0.02] backdrop-blur-2xl border border-white/10 rounded-[2rem] p-8 pt-10 shadow-[0_30px_80px_rgba(0,0,0,0.5)]">
              
              {/* Header Icon */}
              <div className="flex flex-col items-center mb-8">
                <div className="relative mb-5">
                  <div className="absolute inset-0 bg-emerald-500/20 blur-[40px] rounded-full scale-150 animate-pulse" />
                  <div className="relative w-20 h-20 bg-gradient-to-br from-emerald-500/20 to-teal-600/20 rounded-full flex items-center justify-center border-2 border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                    <User size={36} className="text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg border border-amber-300/50">
                    <Crown size={12} className="text-black" />
                  </div>
                </div>
                <h1 className="text-3xl font-black text-white mb-1 tracking-tight" style={{ textShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
                  دخول المستضيف
                </h1>
                <p className="text-emerald-500/50 font-bold text-[10px] uppercase tracking-[0.4em]">Host Access Portal</p>
              </div>

              {/* Features Row */}
              <div className="flex items-center justify-center gap-4 mb-8">
                {[
                  { icon: Trophy, label: 'نقاط', color: 'text-yellow-500' },
                  { icon: Star, label: 'إحصائيات', color: 'text-cyan-400' },
                  { icon: Shield, label: 'آمن', color: 'text-emerald-400' },
                ].map((f, i) => (
                  <div key={i} className="flex flex-col items-center gap-1.5 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/5">
                    <f.icon size={16} className={f.color} />
                    <span className="text-[10px] text-white/40 font-bold">{f.label}</span>
                  </div>
                ))}
              </div>

              {/* Input */}
              <div className="space-y-4 mb-6">
                <div className="relative">
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                    <div className="w-5 h-5 bg-emerald-500 rounded-md flex items-center justify-center">
                      <span className="text-[10px] font-black text-black">K</span>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={kickUsername}
                    onChange={(e) => { setKickUsername(e.target.value); setError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    placeholder="اسم المستخدم في Kick"
                    className="w-full bg-black/40 border-2 border-white/10 focus:border-emerald-500/50 rounded-2xl px-4 py-4 pr-14 text-white font-bold text-base text-right outline-none transition-all placeholder:text-white/20 shadow-inner focus:shadow-[0_0_20px_rgba(16,185,129,0.1)]"
                    dir="ltr"
                    style={{ textAlign: 'left' }}
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-xl" style={{ animation: 'fadeIn 0.3s ease-out' }}>
                    <AlertTriangle size={14} className="text-red-400" />
                    <span className="text-red-400 text-sm font-bold">{error}</span>
                  </div>
                )}
              </div>

              {/* Login Button */}
              <button
                onClick={handleLogin}
                disabled={isLoading || !kickUsername.trim()}
                className="w-full relative group py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-2xl text-white font-black text-lg tracking-wider transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 shadow-[0_10px_30px_rgba(16,185,129,0.3)] hover:shadow-[0_15px_40px_rgba(16,185,129,0.4)] overflow-hidden border border-emerald-400/20"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000 skew-x-[-20deg]" />
                {isLoading ? (
                  <div className="flex items-center justify-center gap-3">
                    <Loader2 size={22} className="animate-spin" />
                    <span>جاري البحث...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-3">
                    <LogIn size={22} />
                    <span>دخول</span>
                  </div>
                )}
              </button>

              {/* Back Button */}
              <button
                onClick={onBack}
                className="w-full mt-4 py-3 text-white/30 hover:text-white/60 font-bold text-sm transition-all flex items-center justify-center gap-2"
              >
                <ChevronRight size={16} />
                <span>العودة للرئيسية</span>
              </button>
            </div>
          </div>
        )}

        {step === 'PROFILE' && hostData && (
          <div className="relative" style={{ animation: 'zoomBounce 0.5s ease-out' }}>
            {/* Trial Badge */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20">
              <div className="px-6 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full shadow-[0_0_25px_rgba(245,158,11,0.4)] border border-amber-400/50">
                <span className="text-black font-black text-[11px] uppercase tracking-[0.25em] flex items-center gap-1.5">
                  <Sparkles size={12} /> نسخة تجريبية <span className="text-amber-900/60">TRIAL</span>
                </span>
              </div>
            </div>

            {/* Profile Card */}
            <div className="bg-gradient-to-b from-white/[0.06] to-white/[0.02] backdrop-blur-2xl border border-white/10 rounded-[2rem] p-8 pt-12 shadow-[0_30px_80px_rgba(0,0,0,0.5)]">
              
              {/* Avatar */}
              <div className="flex flex-col items-center mb-6">
                <div className="relative mb-4">
                  <div className="absolute inset-0 bg-emerald-500/20 blur-[50px] rounded-full scale-[2] animate-pulse" />
                  <div className="relative">
                    <ProAvatar url={avatar} username={hostData.kickUsername} size="w-24 h-24" className="shadow-[0_0_40px_rgba(16,185,129,0.3)] overflow-visible" />
                  </div>
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                    <div className="px-3 py-0.5 bg-emerald-500/20 border border-emerald-500/30 rounded-full">
                      <span className="text-emerald-400 font-black text-[9px] uppercase tracking-widest">Host</span>
                    </div>
                  </div>
                </div>
                <h2 className="text-2xl font-black text-white mt-2 tracking-tight">{hostData.kickUsername}</h2>
                <p className="text-white/30 text-sm font-bold">مستضيف في ساحة iCG1</p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                {/* Points */}
                <div className="relative group bg-gradient-to-br from-yellow-500/10 to-orange-500/5 border border-yellow-500/20 rounded-2xl p-4 flex flex-col items-center justify-center overflow-hidden hover:scale-105 transition-all">
                  <div className="absolute inset-0 bg-yellow-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <Trophy size={22} className="text-yellow-500 mb-2 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
                  <div className="text-2xl font-black text-white font-mono tracking-tighter drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
                    {points.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-yellow-500/60 font-bold uppercase tracking-widest mt-1">نقطة</div>
                </div>

                {/* Wins */}
                <div className="relative group bg-gradient-to-br from-cyan-500/10 to-blue-500/5 border border-cyan-500/20 rounded-2xl p-4 flex flex-col items-center justify-center overflow-hidden hover:scale-105 transition-all">
                  <div className="absolute inset-0 bg-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <Star size={22} className="text-cyan-400 mb-2 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
                  <div className="text-2xl font-black text-white font-mono tracking-tighter drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
                    {wins}
                  </div>
                  <div className="text-[10px] text-cyan-400/60 font-bold uppercase tracking-widest mt-1">فوز</div>
                </div>
              </div>

              {/* Trial Info */}
              <div className="bg-gradient-to-r from-amber-500/5 to-orange-500/5 border border-amber-500/15 rounded-xl p-3 mb-6 flex items-center gap-3">
                <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center shrink-0">
                  <Zap size={16} className="text-amber-400" />
                </div>
                <div className="flex-1">
                  <div className="text-amber-400 font-black text-xs">الباقة التجريبية</div>
                  <div className="text-white/30 text-[10px] font-bold">وصول كامل لجميع الألعاب والميزات</div>
                </div>
                <div className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/30 rounded-md">
                  <span className="text-amber-400 font-black text-[9px] uppercase">Free</span>
                </div>
              </div>

              {/* Enter Button */}
              <button
                onClick={handleEnter}
                className="w-full relative group py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-2xl text-white font-black text-lg tracking-wider transition-all duration-300 active:scale-95 shadow-[0_10px_30px_rgba(16,185,129,0.3)] hover:shadow-[0_15px_40px_rgba(16,185,129,0.4)] overflow-hidden border border-emerald-400/20"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000 skew-x-[-20deg]" />
                <div className="flex items-center justify-center gap-3">
                  <ArrowRight size={22} />
                  <span>دخول لوحة التحكم</span>
                </div>
              </button>

              {/* Change Account */}
              <button
                onClick={() => { setStep('LOGIN'); setKickUsername(''); }}
                className="w-full mt-3 py-2 text-white/20 hover:text-white/50 font-bold text-xs transition-all flex items-center justify-center gap-1.5"
              >
                <User size={12} />
                <span>تغيير الحساب</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-6 opacity-20">
          <div className="flex items-center justify-center gap-2">
            <Shield size={12} className="text-emerald-500" />
            <span className="text-[9px] text-white uppercase tracking-[0.4em] font-bold">iCG1 — دخول آمن</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes zoomBounce {
          0% { opacity: 0; transform: scale(0.8); }
          70% { transform: scale(1.03); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};
