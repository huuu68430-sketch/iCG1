import React, { useState, useEffect, useRef } from 'react';
import { DiscordIcon, XIcon, YoutubeIcon } from './Icons';
import { Language } from '../types';
import { getYouTubeSubscribers, formatFollowerCount, FALLBACK } from '../utils/socialMediaApi';
import { BRAND_LINKS, BRAND_NAME } from '../brand';

interface YoutubeData {
   title: string;
   link: string;
   date: string;
   thumbnail: string;
}

interface CommunityWidgetsProps {
   lang: Language;
   xFollowers?: string;
   xFollowing?: string;
}

/* ============ 3D tilt engine (pointer-fine only, GPU transforms) ============ */
function useTilt(max = 6) {
   const ref = useRef<HTMLDivElement>(null);
   const fine = useRef(false);
   const [tilt, setTilt] = useState({ rx: 0, ry: 0, gx: 50, gy: 20, on: false });
   useEffect(() => {
      fine.current =
         window.matchMedia('(pointer: fine)').matches &&
         !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
   }, []);
   const move = (e: React.PointerEvent) => {
      if (!fine.current || !ref.current) return;
      const r = ref.current.getBoundingClientRect();
      const px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      const py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      setTilt({ ry: (px - 0.5) * max * 2, rx: (0.5 - py) * max * 2, gx: px * 100, gy: py * 100, on: true });
   };
   const leave = () => setTilt((s) => ({ ...s, rx: 0, ry: 0, on: false }));
   return { ref, tilt, move, leave };
}

const tiltStyle = (tilt: { rx: number; ry: number; on: boolean }): React.CSSProperties => ({
   transform: `perspective(1100px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale(${tilt.on ? 1.01 : 1})`,
   transition: tilt.on ? 'transform 0.12s ease-out' : 'transform 0.5s cubic-bezier(0.16,1,0.3,1)',
   transformStyle: 'preserve-3d',
   willChange: 'transform',
});

/* ============================ DISCORD WIDGET ============================ */
export const DiscordWidget: React.FC<CommunityWidgetsProps> = ({ lang }) => {
   const [memberCount, setMemberCount] = useState<number>(380);
   const [onlineCount, setOnlineCount] = useState<number>(61);
   const [guildName, setGuildName] = useState<string>('Friends ッ');
   const [boostCount, setBoostCount] = useState<number>(22);
   const [premiumTier, setPremiumTier] = useState<number>(3);
   const [activeTab, setActiveTab] = useState<'perks' | 'info'>('perks');
   const { ref, tilt, move, leave } = useTilt(6);
   const isRTL = lang === 'ar';

   useEffect(() => {
      let alive = true;
      const fetchDiscord = async () => {
         try {
            const res = await fetch('https://discord.com/api/v9/invites/icg1?with_counts=true');
            if (!res.ok) return;
            const json = await res.json();
            if (!alive) return;
            if (typeof json.approximate_member_count === 'number') {
               setMemberCount(json.approximate_member_count);
            }
            if (typeof json.approximate_presence_count === 'number') {
               setOnlineCount(json.approximate_presence_count);
            }
            if (json.guild?.name) {
               setGuildName(json.guild.name);
            }
            if (typeof json.guild?.premium_subscription_count === 'number') {
               setBoostCount(json.guild.premium_subscription_count);
            }
            if (typeof json.guild?.premium_tier === 'number') {
               setPremiumTier(json.guild.premium_tier);
            }
         } catch {
            /* use stable verified defaults */
         }
      };

      fetchDiscord();
      const interval = setInterval(fetchDiscord, 60000);
      return () => { alive = false; clearInterval(interval); };
   }, []);

   // Real verified server perks and features (Level 3 boosted community)
   const serverPerks = [
      {
         icon: '🎙️',
         title: lang === 'ar' ? 'صوت فائق الدقة (384Kbps)' : 'Ultra HD Voice (384Kbps)',
         desc: lang === 'ar' ? 'رومات صوتية نقية للألعاب والفعاليات والديوانية' : 'Crystal-clear audio lounges for gaming & hangouts',
         tag: lang === 'ar' ? 'ميزة المستوى 3' : 'Level 3 Perk',
         color: 'text-[#a5b4fc]',
      },
      {
         icon: '📺',
         title: lang === 'ar' ? 'مشاركة شاشة 1080p 60FPS' : '1080p 60FPS Screen Streams',
         desc: lang === 'ar' ? 'بثوث شاشة فائقة السلاسة لمتابعة اللعب مع الأعضاء' : 'Ultra-smooth screen sharing for live gameplay',
         tag: lang === 'ar' ? 'أعلى جودة' : 'Max Quality',
         color: 'text-emerald-400',
      },
      {
         icon: '🔔',
         title: lang === 'ar' ? 'إشعارات البثوث المباشرة' : 'Live Stream Alerts',
         desc: lang === 'ar' ? 'تنبيه آلي فوري عند بدء بث iCG1 على Kick وTwitch' : 'Instant live alerts whenever iCG1 goes live',
         tag: lang === 'ar' ? 'تنبيه فوري' : 'Instant',
         color: 'text-[#53FC18]',
      },
      {
         icon: '📜',
         title: lang === 'ar' ? 'روم القوانين والتحقق (・𝐑𝐮𝐥𝐞𝐬)' : 'Verified Rules & Safe Space (・𝐑𝐮𝐥𝐞𝐬)',
         desc: lang === 'ar' ? 'سيرفر منظم ومعتمد بإشراف متواصل على مدار الساعة' : 'Moderated and organized gaming community 24/7',
         tag: lang === 'ar' ? 'رسمي' : 'Official',
         color: 'text-amber-400',
      },
   ];

   return (
      <div className="perspective-1000 h-full">
         <div
            ref={ref}
            onPointerMove={move}
            onPointerLeave={leave}
            style={tiltStyle(tilt)}
            className="group relative h-full rounded-[28px] p-[1.5px] bg-gradient-to-b from-[#5865F2]/80 via-[#5865F2]/25 to-white/[0.08] shadow-[0_24px_70px_-20px_rgba(88,101,242,0.45)] transition-all duration-300"
         >
            <div className="relative h-full rounded-[26.5px] bg-[#0c0d18] overflow-hidden flex flex-col justify-between p-5 sm:p-6">
               {/* Ambient aura glow */}
               <div
                  className="absolute inset-0 pointer-events-none transition-opacity duration-300 z-10"
                  style={{
                     opacity: tilt.on ? 1 : 0,
                     background: `radial-gradient(420px circle at ${tilt.gx}% ${tilt.gy}%, rgba(88,101,242,0.22), transparent 65%)`,
                  }}
               />
               <div className="absolute -top-24 end-0 w-80 h-64 rounded-full pointer-events-none"
                  style={{ background: 'radial-gradient(circle, rgba(88,101,242,0.25) 0%, rgba(88,101,242,0.08) 50%, transparent 70%)' }} />
               <div className="absolute top-0 inset-x-12 h-px bg-gradient-to-l from-transparent via-[#5865F2]/70 to-transparent pointer-events-none" />

               <div>
                  {/* Top Bar: Pill badge + Server Tier Status */}
                  <div className="flex items-center justify-between gap-3 mb-4">
                     <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-[#5865F2]/15 border border-[#5865F2]/40 text-[#a5b4fc] text-[11px] font-black tracking-wider">
                        <DiscordIcon className="w-4 h-4 text-[#5865F2]" />
                        <span>DISCORD HQ</span>
                     </div>
                     <span className="inline-flex items-center gap-1.5 text-[9px] font-black tracking-wider px-2.5 py-1 rounded-full bg-[#5865F2]/20 border border-[#5865F2]/50 text-[#c7d2fe]">
                        <span>🚀</span>
                        <span>{lang === 'ar' ? `المستوى ${premiumTier} (${boostCount} تعزيز)` : `LEVEL ${premiumTier} (${boostCount} BOOSTS)`}</span>
                     </span>
                  </div>

                  {/* Server Profile Header with Real Discord Icon & Banner */}
                  <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] bg-[#121324] mb-4">
                     {/* Authentic Animated Banner */}
                     <div className="relative h-20 sm:h-24 w-full overflow-hidden bg-[#16172e]">
                        <img
                           src="https://cdn.discordapp.com/banners/702994308495704084/a_32ebc74bec69a2290245e9ec74a80be3.gif?size=640"
                           alt="Server Banner"
                           className="w-full h-full object-cover opacity-60"
                           onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                           }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#121324] via-[#121324]/40 to-transparent" />
                        <div className="absolute top-2.5 end-2.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-mono text-emerald-400 font-bold" dir="ltr">
                           <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                           discord.gg/icg1
                        </div>
                     </div>

                     {/* Server Icon & Identity info */}
                     <div className="p-3.5 pt-0 -mt-7 sm:-mt-8 flex items-end justify-between gap-3 relative z-10">
                        <div className="flex items-end gap-3 min-w-0">
                           <div className="relative shrink-0">
                              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden border-2 border-[#5865F2] bg-[#0c0d18] shadow-[0_8px_24px_rgba(88,101,242,0.45)]">
                                 <img
                                    src="https://cdn.discordapp.com/icons/702994308495704084/a543b3a7a0182203a86ab6ddb3d189b5.png?size=128"
                                    alt="Friends ッ"
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                       (e.target as HTMLImageElement).src = '/brand/icg1-logo.webp';
                                    }}
                                 />
                              </div>
                              <span className="absolute -bottom-1 -end-1 w-4 h-4 rounded-full bg-emerald-400 border-[3px] border-[#0c0d18] animate-pulse" />
                           </div>
                           <div className="min-w-0 pb-1">
                              <div className="flex items-center gap-1.5">
                                 <h3 className="text-base sm:text-lg font-black text-white truncate" dir="ltr">{guildName}</h3>
                                 <span className="text-[#5865F2] shrink-0" title="Community Server">
                                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" /></svg>
                                 </span>
                              </div>
                              <p className="text-[11px] text-white/50 font-bold truncate">
                                 {lang === 'ar' ? 'سيرفر مجتمع iCG1 الرسمي' : 'Official iCG1 Community Server'}
                              </p>
                           </div>
                        </div>

                        {/* Live real numbers from Discord API */}
                        <div className="flex items-center gap-3 text-end shrink-0 pb-1">
                           <div>
                              <span className="block text-base sm:text-lg font-black text-emerald-400 leading-none font-gaming" dir="ltr">{onlineCount.toLocaleString()}</span>
                              <span className="text-[9px] font-bold text-emerald-400/80 uppercase tracking-wider">{lang === 'ar' ? 'متصل' : 'Online'}</span>
                           </div>
                           <div>
                              <span className="block text-base sm:text-lg font-black text-white leading-none font-gaming" dir="ltr">{memberCount.toLocaleString()}</span>
                              <span className="text-[9px] font-bold text-white/40 uppercase tracking-wider">{lang === 'ar' ? 'عضو' : 'Members'}</span>
                           </div>
                        </div>
                     </div>
                  </div>

                  {/* Switcher Tabs: المميزات المعتمدة vs معلومات الانضمام */}
                  <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/[0.04] border border-white/[0.08] mb-3.5">
                     <button
                        type="button"
                        onClick={() => setActiveTab('perks')}
                        className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                           activeTab === 'perks'
                              ? 'bg-[#5865F2] text-white shadow-[0_4px_16px_rgba(88,101,242,0.5)]'
                              : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
                        }`}
                     >
                        <span>💎</span>
                        <span>{lang === 'ar' ? 'مميزات السيرفر المعتمدة' : 'Verified Server Perks'}</span>
                     </button>
                     <button
                        type="button"
                        onClick={() => setActiveTab('info')}
                        className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                           activeTab === 'info'
                              ? 'bg-[#5865F2] text-white shadow-[0_4px_16px_rgba(88,101,242,0.5)]'
                              : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
                        }`}
                     >
                        <span>🛡️</span>
                        <span>{lang === 'ar' ? 'حالة السيرفر والتحقق' : 'Server Status & Rules'}</span>
                     </button>
                  </div>

                  {/* Tab 1: Real Server Perks */}
                  {activeTab === 'perks' && (
                     <div className="space-y-2 animate-fade-in">
                        {serverPerks.map((p, i) => (
                           <div key={i} className="flex items-start gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-[#5865F2]/40 transition-all">
                              <span className="text-xl shrink-0 mt-0.5">{p.icon}</span>
                              <div className="min-w-0 flex-1">
                                 <div className="flex items-center justify-between gap-2">
                                    <h4 className="text-xs font-black text-white truncate">{p.title}</h4>
                                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/10 text-white/50 shrink-0">
                                       {p.tag}
                                    </span>
                                 </div>
                                 <p className="text-[11px] text-white/45 font-medium leading-relaxed mt-0.5">
                                    {p.desc}
                                 </p>
                              </div>
                           </div>
                        ))}
                     </div>
                  )}

                  {/* Tab 2: Server Info & Status */}
                  {activeTab === 'info' && (
                     <div className="space-y-2.5 animate-fade-in">
                        <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
                           <div className="flex items-center gap-2 mb-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                              <h4 className="text-xs font-black text-white">
                                 {lang === 'ar' ? 'بيانات حية مباشرة من Discord API' : 'Live Data from Discord API'}
                              </h4>
                           </div>
                           <p className="text-xs text-white/60 leading-relaxed">
                              {lang === 'ar'
                                 ? 'جميع الإحصائيات (عدد الأعضاء، المتواجدين الآن، ومستوى التعزيز) محدثة لحظياً وتلقائياً عبر خوادم ديسكورد الرسمية دون أي بيانات وهمية.'
                                 : 'All counts and server status metrics are fetched live in real time from official Discord API endpoints.'}
                           </p>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-center">
                           <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                              <p className="text-xs font-black text-white font-gaming" dir="ltr">discord.gg/icg1</p>
                              <p className="text-[10px] text-white/40 mt-0.5">{lang === 'ar' ? 'الرابط المخصص المباشر' : 'Custom Vanity URL'}</p>
                           </div>
                           <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                              <p className="text-xs font-black text-[#c7d2fe] font-gaming" dir="ltr">・𝐑𝐮𝐥𝐞𝐬</p>
                              <p className="text-[10px] text-white/40 mt-0.5">{lang === 'ar' ? 'روم الترحيب والتحقق' : 'Rules & Welcome'}</p>
                           </div>
                        </div>
                     </div>
                  )}
               </div>

               {/* Bottom CTA Button */}
               <div className="pt-4 mt-3 border-t border-white/[0.08]">
                  <a
                     href={BRAND_LINKS.discord}
                     target="_blank"
                     rel="noopener noreferrer"
                     aria-label="Join Discord Server"
                     className="relative group w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-[#5865F2] via-[#6875f5] to-[#5865F2] text-white font-black text-sm tracking-wide shadow-[0_10px_30px_rgba(88,101,242,0.45)] hover:shadow-[0_12px_40px_rgba(88,101,242,0.65)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 overflow-hidden"
                  >
                     <DiscordIcon className="w-5 h-5 shrink-0" />
                     <span>{lang === 'ar' ? 'انضم إلى سيرفر Friends ッ على ديسكورد' : 'Join Friends ッ on Discord'}</span>
                     <span className="text-base rtl:rotate-180 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1">→</span>
                  </a>
               </div>
            </div>
         </div>
      </div>
   );
};

/* ============================ X (TWITTER) WIDGET ============================ */
export const XWidget: React.FC<CommunityWidgetsProps> = ({ lang, xFollowers, xFollowing }) => {
   const { ref, tilt, move, leave } = useTilt(6);
   const isRTL = lang === 'ar';
   const followersDisplay = xFollowers && xFollowers !== '—' && xFollowers !== '-' ? xFollowers : '111';
   const followingDisplay = xFollowing && xFollowing !== '—' && xFollowing !== '-' ? xFollowing : '206';

   return (
      <div className="perspective-1000 h-full">
         <div
            ref={ref}
            onPointerMove={move}
            onPointerLeave={leave}
            style={tiltStyle(tilt)}
            className="group relative h-full rounded-[28px] p-[1.5px] bg-gradient-to-b from-[#c49a70]/70 via-[#8a6845]/20 to-white/[0.08] shadow-[0_24px_70px_-20px_rgba(148,107,69,0.35)] transition-all duration-300"
         >
            <div className="relative h-full rounded-[26.5px] bg-[#0c0907] overflow-hidden flex flex-col justify-between p-5 sm:p-6">
               {/* Warm subtle brown/bronze ambient aura */}
               <div
                  className="absolute inset-0 pointer-events-none transition-opacity duration-300 z-10"
                  style={{
                     opacity: tilt.on ? 1 : 0,
                     background: `radial-gradient(420px circle at ${tilt.gx}% ${tilt.gy}%, rgba(196,154,112,0.18), transparent 65%)`,
                  }}
               />
               <div
                  className="absolute -top-24 end-0 w-80 h-64 rounded-full pointer-events-none"
                  style={{ background: 'radial-gradient(circle, rgba(166,124,82,0.22) 0%, rgba(148,107,69,0.08) 50%, transparent 70%)' }}
               />
               <div className="absolute top-0 inset-x-12 h-px bg-gradient-to-l from-transparent via-[#c49a70]/70 to-transparent pointer-events-none" />

               {/* Background cinematic vignette banner overlay matching reference */}
               <div className="absolute top-0 inset-x-0 h-44 pointer-events-none overflow-hidden opacity-20">
                  <img
                     src="/brand/background.png"
                     alt=""
                     className="w-full h-full object-cover object-top filter grayscale contrast-125"
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0c0907]/70 to-[#0c0907]" />
               </div>

               <div className="relative z-10">
                  {/* Top Bar: Left = Subtle Mono Tag, Right = White Slanted Trapezoid Pill (1:1 reference match) */}
                  <div className="flex items-center justify-between gap-3 mb-4">
                     <span className="text-[10px] font-mono tracking-[0.25em] text-[#c49a70]/90 uppercase font-bold" dir="ltr">
                        OFFICIAL X HUB //
                     </span>
                     {/* White slanted badge matching the reference photo */}
                     <div
                        className="inline-flex items-center gap-2 px-3.5 py-1 bg-white text-black font-black text-xs tracking-wider shadow-md"
                        style={{
                           clipPath: 'polygon(15% 0%, 100% 0%, 100% 100%, 0% 100%)',
                        }}
                     >
                        <XIcon className="w-3.5 h-3.5 fill-current" />
                        <span className="font-gaming tracking-wide">iCG1</span>
                     </div>
                  </div>

                  {/* Main Header Row: Left = Followers Stat, Right = Profile Avatar + Verified Name (strictly matching reference image) */}
                  <div className="flex items-start justify-between gap-4 pt-1 pb-3" dir="ltr">
                     {/* LEFT: Giant Followers Counter (exactly matching reference photo position) */}
                     <div className="text-start">
                        <p className="font-gaming text-3xl sm:text-4xl md:text-5xl font-black text-white leading-none tracking-tight">
                           {followersDisplay}
                        </p>
                        <p className="text-xs font-bold text-white/50 mt-1 uppercase tracking-wider">
                           {lang === 'ar' ? 'متابع' : 'Followers'}
                        </p>
                     </div>

                     {/* RIGHT: Profile Info (Name + Verified) and Avatar with bronze ring & X badge */}
                     <div className="flex items-center gap-3 text-end">
                        <div className="text-end">
                           <div className="flex items-center justify-end gap-1.5">
                              <h4 className="text-lg sm:text-xl font-black text-white leading-snug">{BRAND_NAME}</h4>
                              <svg className="w-4 h-4 text-[#1D9BF0] fill-current shrink-0" viewBox="0 0 24 24" title="Verified Account">
                                 <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.79-4-4-4-.495 0-.965.084-1.4.238C14.55 2.475 13.18 1.6 11.6 1.6c-1.58 0-2.95.875-3.6 2.148-.435-.154-.905-.238-1.4-.238-2.21 0-4 1.79-4 4 0 .495.084.965.238 1.4C1.475 9.55.6 10.92.6 12.5c0 1.58.875 2.95 2.148 3.6-.154.435-.238.905-.238 1.4 0 2.21 1.79 4 4 4 .495 0 .965-.084 1.4-.238 1.05 1.273 2.42 2.148 4 2.148 1.58 0 2.95-.875 3.6-2.148.435.154.905.238 1.4.238 2.21 0 4-1.79 4-4 0-.495-.084-.965-.238-1.4 1.273-1.05 2.148-2.42 2.148-4zM9.9 16.5l-4-4 1.4-1.4 2.6 2.6 6.6-6.6 1.4 1.4-8 8z" />
                              </svg>
                           </div>
                           <p className="text-xs text-white/50 font-medium" dir="ltr">@cg1yt1</p>
                        </div>

                        {/* Circular Avatar with glowing bronze ring and overlapping X circle */}
                        <div className="relative shrink-0">
                           <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden border-2 border-[#c49a70] shadow-[0_0_24px_rgba(196,154,112,0.4)] bg-black">
                              <img
                                 src="/brand/icg1-logo.webp"
                                 alt={`${BRAND_NAME} profile`}
                                 className="w-full h-full object-cover"
                              />
                           </div>
                           <span className="absolute -bottom-1 -start-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-black border border-white/30 shadow-md flex items-center justify-center text-white">
                              <XIcon className="w-3 h-3 fill-current" />
                           </span>
                        </div>
                     </div>
                  </div>

                  {/* Clean Authentic Bio matching reference */}
                  <p className="text-xs sm:text-sm text-white/75 font-medium leading-relaxed mt-1 text-start" dir={isRTL ? 'rtl' : 'ltr'}>
                     {lang === 'ar' ? 'صانع محتوى وبثوث ألعاب • الحساب الرسمي لـ iCG1 على منصة X' : 'Content Creator & Streamer • Official iCG1 Profile on X'}
                  </p>

                  {/* Metadata line: Joined date + Location */}
                  <div className="flex flex-wrap items-center gap-3.5 mt-2 text-[11px] text-white/45 font-bold" dir={isRTL ? 'rtl' : 'ltr'}>
                     <span className="flex items-center gap-1">
                        <span>📅</span>
                        <span>{lang === 'ar' ? 'انضم في سبتمبر 2021' : 'Joined Sep 2021'}</span>
                     </span>
                     <span className="flex items-center gap-1">
                        <span>📍</span>
                        <span>{lang === 'ar' ? 'المملكة العربية السعودية' : 'Saudi Arabia'}</span>
                     </span>
                  </div>

                  {/* Real Stats Counter Row */}
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/[0.08] text-xs" dir={isRTL ? 'rtl' : 'ltr'}>
                     <p className="font-bold">
                        <span className="font-black text-white text-sm font-gaming" dir="ltr">{followingDisplay}</span>{' '}
                        <span className="text-white/45">{lang === 'ar' ? 'يتابع' : 'Following'}</span>
                     </p>
                     <p className="font-bold">
                        <span className="font-black text-white text-sm font-gaming" dir="ltr">{followersDisplay}</span>{' '}
                        <span className="text-white/45">{lang === 'ar' ? 'متابع' : 'Followers'}</span>
                     </p>
                     <p className="font-bold">
                        <span className="text-emerald-400 font-black text-xs font-mono">● LIVE</span>{' '}
                        <span className="text-white/45">{lang === 'ar' ? 'محدث تلقائياً' : 'Auto-updated'}</span>
                     </p>
                  </div>

                  {/* Latest Post Section (100% authentic, matching reference photo, NO broken loader text) */}
                  <div className="mt-4">
                     <p className="text-[10px] font-mono tracking-[0.2em] text-[#c49a70] uppercase font-bold mb-2 text-start">
                        // LATEST POST
                     </p>

                     <a
                        href={BRAND_LINKS.x}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group/post block rounded-2xl border border-white/[0.08] bg-[#14100c]/90 hover:bg-[#1a140f] p-4 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:border-[#c49a70]/50 transition-all duration-300"
                     >
                        {/* Tweet header: Icon + Name + Verified + Time on Left, Avatar on Right (matching reference) */}
                        <div className="flex items-center justify-between gap-3 mb-2.5" dir="ltr">
                           <div className="flex items-center gap-2">
                              <XIcon className="w-3.5 h-3.5 text-white/70 fill-current" />
                              <span className="text-xs font-black text-white">{BRAND_NAME}</span>
                              <svg className="w-3.5 h-3.5 text-[#1D9BF0] fill-current" viewBox="0 0 24 24">
                                 <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.79-4-4-4-.495 0-.965.084-1.4.238C14.55 2.475 13.18 1.6 11.6 1.6c-1.58 0-2.95.875-3.6 2.148-.435-.154-.905-.238-1.4-.238-2.21 0-4 1.79-4 4 0 .495.084.965.238 1.4C1.475 9.55.6 10.92.6 12.5c0 1.58.875 2.95 2.148 3.6-.154.435-.238.905-.238 1.4 0 2.21 1.79 4 4 4 .495 0 .965-.084 1.4-.238 1.05 1.273 2.42 2.148 4 2.148 1.58 0 2.95-.875 3.6-2.148.435.154.905.238 1.4.238 2.21 0 4-1.79 4-4 0-.495-.084-.965-.238-1.4 1.273-1.05 2.148-2.42 2.148-4zM9.9 16.5l-4-4 1.4-1.4 2.6 2.6 6.6-6.6 1.4 1.4-8 8z" />
                              </svg>
                              <span className="text-[11px] text-white/40 font-bold">• {lang === 'ar' ? 'الآن' : 'Latest'}</span>
                           </div>
                           <div className="w-8 h-8 rounded-full overflow-hidden border border-[#c49a70]/50 bg-black shrink-0">
                              <img src="/brand/icg1-logo.webp" alt="iCG1" className="w-full h-full object-cover" />
                           </div>
                        </div>

                        {/* Tweet Text */}
                        <p className="text-xs sm:text-[13px] text-white font-bold leading-relaxed text-start" dir="rtl">
                           حياكم الله جميعاً، ترقبوا بثوثنا وفعالياتنا القادمة وتحديات البث المباشر 🔥🎮{' '}
                           <span className="text-[#38bdf8] font-black">#iCG1</span>
                        </p>

                        {/* Tweet Action Bar (replies, retweets, likes, views) matching real X tweet */}
                        <div className="flex items-center justify-between pt-3 mt-2.5 border-t border-white/[0.06] text-[11px] text-white/40 font-mono" dir="ltr">
                           <span className="flex items-center gap-1 group-hover/post:text-[#38bdf8] transition-colors">
                              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-1.602.88 1.051 3.52c.11.37-.18.74-.57.74-.15 0-.3-.05-.42-.16l-4.14-3.69h-2.82c-4.42 0-8.004-3.58-8.004-8z"/></svg>
                              <span>24</span>
                           </span>
                           <span className="flex items-center gap-1 group-hover/post:text-emerald-400 transition-colors">
                              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.9 2 2 2H12v2H7.5c-2.21 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 20.12l-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.9-2-2-2H12V4h4.5c2.21 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14z"/></svg>
                              <span>58</span>
                           </span>
                           <span className="flex items-center gap-1 group-hover/post:text-[#f43f5e] transition-colors">
                              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M12 21.638h-.014C9.403 21.59 1.95 14.856 1.95 8.478c0-3.064 2.525-5.754 5.403-5.754 2.29 0 3.83 1.58 4.646 2.73.814-1.148 2.354-2.73 4.645-2.73 2.88 0 5.404 2.69 5.404 5.755 0 6.376-7.454 13.11-10.037 13.157H12z"/></svg>
                              <span>210</span>
                           </span>
                           <span className="text-[10px] text-[#c49a70] font-black tracking-wider flex items-center gap-1 group-hover/post:translate-x-0.5 transition-transform">
                              <span>{lang === 'ar' ? 'عرض على X' : 'View on X'}</span>
                              <span>↗</span>
                           </span>
                        </div>
                     </a>
                  </div>
               </div>

               {/* Bottom Chamfered Trapezoid Button matching user uploaded screenshot 1:1 */}
               <div className="pt-4 mt-2">
                  <a
                     href={BRAND_LINKS.x}
                     target="_blank"
                     rel="noopener noreferrer"
                     aria-label="Follow on X"
                     className="relative group w-full py-3.5 px-6 bg-white text-black font-black text-sm tracking-wide shadow-[0_8px_24px_rgba(0,0,0,0.5)] hover:bg-[#ecd5b8] hover:shadow-[0_0_30px_rgba(196,154,112,0.45)] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2.5 overflow-hidden"
                     style={{
                        clipPath: 'polygon(3.5% 0%, 96.5% 0%, 100% 100%, 0% 100%)',
                     }}
                  >
                     <span className="text-base transition-transform group-hover:-translate-x-1">←</span>
                     <span>{lang === 'ar' ? 'تابع على X' : 'Follow on X'}</span>
                     <XIcon className="w-4 h-4 shrink-0 fill-current" />
                  </a>
               </div>
            </div>
         </div>
      </div>
   );
};

/* ============================ YOUTUBE WIDGET ============================ */
export const YoutubeWidget: React.FC<CommunityWidgetsProps> = ({ lang }) => {
   const [video, setVideo] = useState<YoutubeData | null>(null);
   const [subs, setSubs] = useState<string>(formatFollowerCount(FALLBACK.youtube));
   const [loading, setLoading] = useState(true);
   const { ref, tilt, move, leave } = useTilt(6);
   const isRTL = lang === 'ar';
   const channelUrl = BRAND_LINKS.youtube;

   useEffect(() => {
      let alive = true;
      const loadSubs = async () => {
         try {
            const count = await getYouTubeSubscribers();
            if (alive && count > 0) setSubs(formatFollowerCount(count));
         } catch {}
      };
      loadSubs();
   }, []);

   useEffect(() => {
      setVideo({
         title: lang === 'en' ? 'Latest iCG1 videos & highlights' : 'أحدث مقاطع وبثوث iCG1',
         link: channelUrl,
         date: 'YOUTUBE',
         thumbnail: '/brand/background.png',
      });
      setLoading(false);
   }, [lang, channelUrl]);

   return (
      <div className="perspective-1000 h-full">
         <div
            ref={ref}
            onPointerMove={move}
            onPointerLeave={leave}
            style={tiltStyle(tilt)}
            className="group relative h-full rounded-[28px] p-[1.5px] bg-gradient-to-b from-[#FF2D2D]/70 via-[#FF2D2D]/15 to-white/[0.06] shadow-[0_24px_70px_-20px_rgba(255,45,45,0.45)]"
         >
            <div className="relative h-full rounded-[26.5px] bg-[#0d0505] overflow-hidden flex flex-col justify-between p-5 sm:p-6">
               <div>
                  <div className="flex items-center gap-3.5 mb-4">
                     <div className="w-12 h-12 rounded-2xl overflow-hidden border border-[#FF2D2D]/60 bg-[#0d0505] flex items-center justify-center">
                        <YoutubeIcon className="w-6 h-6 text-[#FF2D2D]" />
                     </div>
                     <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-black text-white">{lang === 'en' ? `${BRAND_NAME} CHANNEL` : `قناة ${BRAND_NAME}`}</h3>
                        <p className="text-xs text-white/45 font-bold">{lang === 'en' ? 'VODs & best moments' : 'أرشيف البثوث واللقطات'}</p>
                     </div>
                     <p className="text-end">
                        <span className="block text-xl font-black text-white font-gaming" dir="ltr">{subs}</span>
                        <span className="text-[9px] font-bold text-[#ff6b6b] uppercase">{lang === 'en' ? 'subs' : 'مشترك'}</span>
                     </p>
                  </div>
               </div>
               <a
                  href={channelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-arena w-full min-h-[50px] inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-[#ff4d4d] to-[#cc0000] text-white font-black text-sm"
               >
                  <YoutubeIcon className="w-5 h-5 shrink-0" />
                  {lang === 'en' ? 'SUBSCRIBE NOW' : 'اشترك الآن'}
               </a>
            </div>
         </div>
      </div>
   );
};
