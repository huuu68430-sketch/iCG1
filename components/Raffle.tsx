
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChatUser } from '../types';
import { chatService } from '../services/chatService';
import { leaderboardService } from '../services/supabase';
import {
   Gift, Play, Crown, Zap, Users, Sparkles,
   RotateCcw, Home, Settings, Rocket, Star,
   Trophy, Flame, Shield, Target, Cpu, User, UserPlus
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { ProAvatar } from './ProAvatar';

interface RaffleProps {
   channelConnected: boolean;
   onHome: () => void;
}

type RafflePhase = 'SETUP' | 'LOBBY' | 'DRAWING' | 'WINNER';

type EntryMode = 'ALL' | 'MODS' | 'SUBS';

const BOOST_OPTIONS = [5, 10, 25, 50];

const MOD_BADGES = ['moderator', 'broadcaster'];
const SUB_BADGES = ['subscriber', 'sub_gifter', 'vip', 'founder'];

const hasBadge = (user: ChatUser, types: string[]) =>
   !!(user.badges || []).some(b => b && types.includes(b.type));

export const isModeratorUser = (user: ChatUser) =>
   hasBadge(user, MOD_BADGES) || user.role === 'moderator' || user.role === 'owner';

export const isSubscriberUser = (user: ChatUser) =>
   hasBadge(user, SUB_BADGES) || user.role === 'subscriber' || user.role === 'gifter' || user.role === 'vip' || user.role === 'founder';

const STICKERS_IABS_MAPPING: Record<string, string | null> = {
   'iabs324244': '3544675', 'iabsdance': '4428507', 'iabsddddddd': '3109207', 'iabshhhh': '3689146',
   'iabsKSA1': '2942650', 'iabst79eer': '4338825', 'iabst7yyhhh': '3989626', 'iabsw6nn': '4428504',
   'iabs235235': '3329508', 'iabs3': '1014969', 'iabs3oooo': '3989709', 'iabs4': '1014975',
   'iabs505': '3823817', 'iabs66': '1056550', 'iabs7': '1015210', 'iabs7son': '2893352',
   'iabs8': '1015225', 'iabs8rd': '2893346', 'iabsa': '1078051', 'iabsa4lfi': '3329257',
   'iabsashhhhhhhi': '3989578', 'iabsb6666666h': '4937186', 'iabsbatman': '3989610', 'iabsboo': '3330599',
   'iabsdaaaaaaaaaaaanc': '4937181', 'iabsdaaance': '3823818', 'iabsdaaanceee': '3989569',
   'iabsdaaannnccee3434': '4937184', 'iabsdanceee': '3500550', 'iabsddddd': '3109209',
   'iabseat': '3109204', 'iabsewwwwwwwwwww': '3989594', 'iabsfloss': '3989597', 'iabsgoooo': '3330629',
   'iabsgraa7': '3989577', 'iabshaaaaaaaaaahhaa': '3329484', 'iabshhh44': '3689147', 'iabshmmmmmi': '2893345',
   'iabshootee': '3329485', 'iabshuu': '3109190', 'iabsjhj': '3330238', 'iabsknslh': '4953422',
   'iabskoksal': '3989580', 'iabslm': '3329260', 'iabsloooove': '4937189', 'iabsm39bbb': '3329530',
   'iabsm9dom': '3989615', 'iabsmusaeed': '3989609', 'iabsnashb': '2893344', 'iabsqqq': '3330234',
   'iabsqwqw': '3330235', 'iabsr3333333b': '4937191', 'iabsrbbee3': '3989591', 'iabsshhhhhhhhhhh': '3330619',
   'iabssmallcup': '2607940', 'iabsswalllffff': '4937179', 'iabst777yh': '3989623', 'iabsw3lykmm': '3544674'
};
const STICKERS_IABS = Object.keys(STICKERS_IABS_MAPPING).map(s => ({ name: s, id: STICKERS_IABS_MAPPING[s] }));

const SidebarPortal = ({ children }: { children?: React.ReactNode }) => {
   const [mounted, setMounted] = useState(false);
   useEffect(() => { setMounted(true); return () => setMounted(false); }, []);
   const el = document.getElementById('game-sidebar-portal');
   if (!mounted || !el) return null;
   return createPortal(children, el);
};

export const Raffle: React.FC<RaffleProps> = ({ channelConnected, onHome }) => {
   const [phase, setPhase] = useState<RafflePhase>('SETUP');
   const [keyword, setKeyword] = useState('!دخول');
   const [duration, setDuration] = useState(60);
   const [participants, setParticipants] = useState<ChatUser[]>([]);
   const [timeLeft, setTimeLeft] = useState(0);
   const [winner, setWinner] = useState<ChatUser | null>(null);
   const [scrollPosition, setScrollPosition] = useState(0);
   const [reelParticipants, setReelParticipants] = useState<ChatUser[]>([]);
   const [isSpinning, setIsSpinning] = useState(false);
   const [recentMessages, setRecentMessages] = useState<{ user: string, content: string, color?: string }[]>([]);
   const cycleWonRef = useRef<Set<string>>(new Set());
   const [cycleRemaining, setCycleRemaining] = useState(0);
   const [cycleNum, setCycleNum] = useState(1);
const [cycleFlash, setCycleFlash] = useState(false);
const [botCount, setBotCount] = useState(0);
const [entryMode, setEntryMode] = useState<EntryMode>('ALL');
const [subBoost, setSubBoost] = useState(0);
const [skippedCount, setSkippedCount] = useState(0);

const phaseRef = useRef(phase);
const keywordRef = useRef(keyword);
const participantsRef = useRef(participants);
const entryModeRef = useRef<EntryMode>('ALL');
useEffect(() => {
   phaseRef.current = phase;
   keywordRef.current = keyword;
   participantsRef.current = participants;
}, [phase, keyword, participants]);

useEffect(() => { entryModeRef.current = entryMode; }, [entryMode]);

const modCount = useMemo(() => participants.filter(isModeratorUser).length, [participants]);
const subCount = useMemo(() => participants.filter(isSubscriberUser).length, [participants]);

   useEffect(() => {
      cycleWonRef.current.clear();
      setCycleNum(1);
      setCycleFlash(true);
      setTimeout(() => setCycleFlash(false), 800);
      setCycleRemaining(participants.length);
   }, [participants.length]);

   useEffect(() => {
      let timer: number;
      if (phase === 'LOBBY' && timeLeft > 0) {
         timer = window.setInterval(() => setTimeLeft(prev => prev - 1), 1000);
      }
      return () => clearInterval(timer);
   }, [phase, timeLeft]);

   useEffect(() => {
      if (!channelConnected) return;
      const cleanup = chatService.onMessage((msg) => {
         if (phaseRef.current !== 'LOBBY') return;
         const lowerContent = msg.content.toLowerCase().trim();
         const rawContent = msg.content;
         const targetKeyword = keywordRef.current.toLowerCase().trim();
         const targetStickerId = STICKERS_IABS_MAPPING[targetKeyword];
         const isKeywordMatch = targetKeyword && lowerContent.includes(targetKeyword);
         const isStickerIdMatch = targetStickerId && rawContent.includes(targetStickerId);
         const isStickerTagMatch = targetStickerId && lowerContent.includes(`emote:${targetStickerId}:`);
         setRecentMessages(prev => [{
            user: msg.user.username,
            content: msg.content,
            color: msg.user.color
         }, ...prev].slice(0, 5));

         if (isKeywordMatch || isStickerIdMatch || isStickerTagMatch) {
            const mode = entryModeRef.current;
            const allowed = mode === 'ALL' || (mode === 'MODS' ? isModeratorUser(msg.user) : isSubscriberUser(msg.user));
            if (!allowed) {
               setSkippedCount(prev => prev + 1);
               return;
            }
            setParticipants(prev => {
               if (prev.find(p => p.username.toLowerCase() === msg.user.username.toLowerCase())) return prev;
               return [...prev, msg.user];
            });
         }
      });
      return cleanup;
   }, [channelConnected]);

   const fetchRealAvatar = async (username: string) => {
      try {
         // Try multiple proxies to bypass CORS and get user info
         const proxies = [
            `https://corsproxy.io/?${encodeURIComponent(`https://kick.com/api/v2/channels/${username}`)}`,
            `https://api.allorigins.win/get?url=${encodeURIComponent(`https://kick.com/api/v2/channels/${username}`)}`
         ];

         for (const url of proxies) {
            try {
               const res = await fetch(url);
               if (!res.ok) continue;
               const raw = await res.json();
               const data = url.includes('allorigins') ? JSON.parse(raw.contents) : raw;
               if (data?.user?.profile_pic) return data.user.profile_pic;
            } catch (e) { }
         }
      } catch (e) { }
      return null;
   };

   const startRaffle = () => {
      if (participants.length < 1) return;

      // Round-robin: pick from participants who haven't won this cycle
      const wonSet = cycleWonRef.current;
      const eligible = participants.filter(p => !wonSet.has(p.id));
      const boostActive = entryMode === 'ALL' && subBoost > 0;

      const pickWeighted = (pool: ChatUser[]): ChatUser => {
         if (!boostActive) return pool[Math.floor(Math.random() * pool.length)];
         const weights = pool.map(p => (isSubscriberUser(p) ? 1 + subBoost / 100 : 1));
         const total = weights.reduce((a, b) => a + b, 0);
         let roll = Math.random() * total;
         for (let i = 0; i < pool.length; i++) {
            roll -= weights[i];
            if (roll <= 0) return pool[i];
         }
         return pool[pool.length - 1];
      };

      let winUser: ChatUser;
      if (eligible.length > 0) {
         winUser = { ...pickWeighted(eligible) };
      } else {
         // Everyone has won → reset cycle
         wonSet.clear();
         setCycleNum(prev => prev + 1);
         setCycleFlash(true);
         setTimeout(() => setCycleFlash(false), 800);
         winUser = { ...pickWeighted(participants) };
      }
      wonSet.add(winUser.id);
      setCycleRemaining(participants.length - wonSet.size);
      // Ensure we have enough items to spin nicely
      const targetItemsToSpin = 100;
      const reps = Math.max(5, Math.ceil(targetItemsToSpin / participants.length) + 3);
      const fullList = [];
      for (let i = 0; i < reps; i++) {
         fullList.push(...[...participants].sort(() => Math.random() - 0.5));
      }
      const targetRep = reps - 2;
      const targetIdxInRep = Math.floor(participants.length / 2);
      const finalTargetIdx = (targetRep * participants.length) + targetIdxInRep;
      fullList[finalTargetIdx] = winUser;

      // Pad the end to ensure no blank spaces after the winner
      for (let i = 0; i < 5; i++) {
          fullList.push(...[...participants].sort(() => Math.random() - 0.5));
      }

      setReelParticipants(fullList);
      setPhase('DRAWING');
      setIsSpinning(true);
      setWinner(null);
      setScrollPosition(0);

      const itemWidth = 140; // Exact width of the card w-[140px]
      const containerWidth = 700; // Exact max-w-[700px]
      const centerOffset = (containerWidth / 2) - (itemWidth / 2);
      const finalScroll = (finalTargetIdx * itemWidth) - centerOffset;

      setTimeout(() => { setScrollPosition(-finalScroll); }, 100);

      // Start fetching the real avatar in the background immediately
      chatService.fetchKickAvatar(winUser.username).then(realPic => {
         if (realPic) winUser.avatar = realPic;
      }).catch(() => {});

      setTimeout(() => {
         setWinner(winUser);
         setPhase('WINNER');
         setIsSpinning(false);

         confetti({
            particleCount: 500,
            spread: 120,
            origin: { y: 0.4 },
            colors: ['#ff0000', '#ffffff', '#ffd700', '#00ff00', '#ff00ff']
         });
         leaderboardService.recordWin(winUser.username, winUser.avatar || '', 200).catch(() => {});
      }, 8000);
   };

   const resetGame = () => {
      setPhase('SETUP');
      setWinner(null);
      setScrollPosition(0);
      setReelParticipants([]);
   };

   const fullReset = () => {
      resetGame();
      setParticipants([]);
      setSkippedCount(0);
      cycleWonRef.current.clear();
      setCycleNum(1);
      setCycleRemaining(0);
   };

   const selectedSticker = useMemo(() => {
      const s = STICKERS_IABS.find(x => x.name.toLowerCase().trim() === keyword.toLowerCase().trim());
      return s ? `https://files.kick.com/emotes/${s.id}/full` : null;
   }, [keyword]);

   return (
      <>
         <SidebarPortal>
            <div className="space-y-4 animate-in slide-in-from-right duration-500">
               {/* Control Panel */}
               <div className="glass-card p-5 rounded-[2rem] border-2 border-white/5 space-y-5 shadow-2xl relative overflow-hidden bg-black/80 backdrop-blur-3xl">
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-red-600 via-white to-red-600 animate-shimmer"></div>
                  <div className="flex items-center justify-between">
                     <h4 className="text-[12px] font-black text-white uppercase tracking-widest flex items-center gap-3">
                        <Cpu size={16} className="text-red-600" /> مـنـظـومة الـسـحب
                     </h4>
                     <button onClick={resetGame} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/5"><RotateCcw size={14} /></button>
                  </div>

                  {phase === 'SETUP' ? (
                     <div className="space-y-4">
                        <div className="space-y-3">
                           <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">كـلمة الـدخـول</label>
                           <div className="relative group">
                              <input
                                 value={keyword}
                                 onChange={e => setKeyword(e.target.value)}
                                 className="w-full bg-black/60 border-2 border-white/10 rounded-[1.5rem] py-4 px-6 text-white font-black text-lg outline-none focus:border-red-600 transition-all shadow-[inset_0_4px_12px_rgba(0,0,0,1)] text-center italic"
                              />
                              <div className="absolute left-6 top-1/2 -translate-y-1/2 text-red-600 group-hover:scale-125 transition-transform">
                                 {selectedSticker ? <img src={selectedSticker} className="w-8 h-8 object-contain" /> : <Zap size={20} fill="currentColor" />}
                              </div>
                           </div>
                        </div>
                        <div className="space-y-3">
                           <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">نـوع الـسـحـب</label>
                           <div className="grid grid-cols-3 gap-2">
                              {([
                                 { id: 'ALL', label: 'الـعـاد', icon: Users, on: 'bg-red-600 border-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.6)] scale-105' },
                                 { id: 'MODS', label: 'الـمـودات', icon: Shield, on: 'bg-red-600 border-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.6)] scale-105' },
                                 { id: 'SUBS', label: 'الـمـشـتـركـون', icon: Crown, on: 'bg-red-600 border-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.6)] scale-105' }
                              ] as const).map(opt => (
                                 <button
                                    key={opt.id}
                                    onClick={() => { setEntryMode(opt.id); setParticipants([]); setSkippedCount(0); }}
                                    className={`py-3 rounded-[1rem] text-[11px] font-black border-2 transition-all flex flex-col items-center gap-1 ${entryMode === opt.id ? opt.on : 'bg-white/5 border-transparent text-gray-500 hover:text-white'}`}
                                 >
                                    <opt.icon size={14} />
                                    {opt.label}
                                 </button>
                              ))}
                           </div>
                        </div>

                        <div className={`space-y-3 transition-all duration-300 ${entryMode !== 'ALL' ? 'opacity-40 pointer-events-none' : ''}`}>
                           <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center justify-between">
                              <span>مـيـزة الـفـوز لـلـمشـترك</span>
                              <span className="text-[10px] text-red-500 tracking-normal normal-case">اختياري</span>
                           </label>
                           <div className="grid grid-cols-4 gap-2">
                              {BOOST_OPTIONS.map(b => (
                                 <button
                                    key={b}
                                    onClick={() => setSubBoost(prev => (prev === b ? 0 : b))}
                                    className={`py-3 rounded-[1rem] text-[12px] font-black border-2 transition-all ${subBoost === b ? 'bg-gradient-to-br from-amber-500 to-yellow-600 border-amber-300 text-black shadow-[0_0_20px_rgba(245,158,11,0.6)] scale-105' : 'bg-white/5 border-transparent text-gray-500 hover:text-white'}`}
                                 >
                                    {subBoost === b ? <span>+{b}%</span> : <>{b}%</>}
                                 </button>
                              ))}
                           </div>
                           {subBoost > 0 && (
                              <p className="text-[10px] font-bold text-amber-400/90 text-center animate-in fade-in duration-300">
                                 ✦ للمشتركين ترجيح +{subBoost}% في السحب العادي
                              </p>
                           )}
                        </div>

                        <div className="space-y-3">
                           <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">الـمـدة الـزمـنية</label>
                           <div className="grid grid-cols-3 gap-2">
                              {[30, 60, 120].map(s => (
                                 <button key={s} onClick={() => setDuration(s)} className={`py-3 rounded-[1rem] text-[12px] font-black border-2 transition-all ${duration === s ? 'bg-red-600 border-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.6)] scale-105' : 'bg-white/5 border-transparent text-gray-500 hover:text-white'}`}>{s}s</button>
                              ))}
                           </div>
                         </div>
                        <button onClick={() => { setTimeLeft(duration); setPhase('LOBBY'); }} className="w-full bg-white text-black font-black py-5 rounded-[1.8rem] text-xs hover:scale-[1.03] active:scale-95 transition-all italic border-t-8 border-red-600 shadow-[0_30px_60px_rgba(0,0,0,0.5)] uppercase tracking-widest">تـفـعـيل غـرفة الـسحب</button>
                     </div>
                  ) : (
                     <div className="space-y-4">
                        <div className="bg-gradient-to-br from-black to-zinc-900 border-2 border-red-600/50 p-5 rounded-[2rem] flex items-center justify-between shadow-2xl relative overflow-hidden">
                           <div className="absolute top-0 right-0 w-32 h-32 bg-red-600 blur-[80px] opacity-10"></div>
                           <div>
                              <p className="text-[10px] font-black text-red-600 uppercase mb-3 tracking-widest">مـفـتاح</p>
                              <p className="text-2xl font-black text-white italic drop-shadow-lg">{keyword}</p>
                           </div>
                           <div className="text-right">
                              <p className="text-[10px] font-black text-red-600 uppercase mb-3 tracking-widest">زمـن</p>
                              <p className="text-2xl font-black text-white font-mono">{timeLeft}s</p>
                           </div>
                        </div>

                        {phase === 'LOBBY' && (
                           <button
                              onClick={startRaffle}
                              disabled={participants.length === 0}
                              className="w-full bg-red-600 text-white font-black py-5 rounded-[1.8rem] text-xs shadow-[0_20px_60px_rgba(220,38,38,0.5)] hover:scale-105 transition-all flex items-center justify-center gap-4 border-t-2 border-white/20 disabled:opacity-20 relative overflow-hidden group"
                           >
                              <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                              <Rocket size={22} fill="currentColor" /> بـدء الـسحـب الـعـملاق
                           </button>
                        )}
                     </div>
                  )}
               </div>

               {participants.length > 0 && (
                  <div className={`rounded-[1.5rem] px-4 py-3 transition-all duration-500 border ${cycleFlash ? 'bg-amber-500/20 border-amber-400/60 scale-[1.02] shadow-[0_0_30px_rgba(255,215,0,0.3)]' : 'bg-amber-600/10 border-amber-500/20'}`}>
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                           <span className={`w-2 h-2 rounded-full transition-colors duration-500 ${cycleFlash ? 'bg-white animate-ping' : 'bg-amber-500'}`}></span>
                           <span className={`text-[10px] font-black italic uppercase tracking-wider transition-colors duration-500 ${cycleFlash ? 'text-white' : 'text-amber-400'}`}>
                              الدورة {cycleNum}
                           </span>
                        </div>
                        <span className={`text-[9px] font-black transition-colors duration-500 ${cycleFlash ? 'text-white' : 'text-amber-400/70'}`}>
                           متبقي {cycleRemaining}
                        </span>
                     </div>
                     {cycleFlash && (
                        <div className="text-center mt-2">
                           <span className="text-[9px] font-black text-white italic animate-pulse">✦ دورة جديدة ✦</span>
                        </div>
                     )}
                  </div>
               )}

               {/* Participants Stream */}
               <div className="glass-card rounded-[2rem] border-2 border-white/5 flex flex-col h-[300px] shadow-2xl relative overflow-hidden bg-black/60">
                  <div className="p-4 border-b-2 border-white/5 bg-white/5 flex justify-between items-center bg-gradient-to-l from-red-600/30 to-transparent">
                     <span className="text-[12px] font-black text-white uppercase tracking-[0.3em] flex items-center gap-3">
                        <Users size={16} className="text-red-600 animate-pulse" /> قـائمـة الأبطـال
                     </span>
                     <div className="flex items-center gap-2">
                        {entryMode !== 'ALL' && (
                           <span className="px-2 py-1 rounded-lg bg-red-600/20 border border-red-600/40 text-[9px] font-black text-red-400">
                              {entryMode === 'MODS' ? 'المودات فقط' : 'المشتركون فقط'}
                           </span>
                        )}
                        {entryMode === 'ALL' && subBoost > 0 && (
                           <span className="px-2 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-[9px] font-black text-amber-400">
                              +{subBoost}% مشتركين
                           </span>
                        )}
                        <span className="bg-white text-red-600 px-4 py-1.5 rounded-[1rem] text-[14px] font-black italic shadow-2xl border-b-4 border-red-600">
                           {participants.length}
                        </span>
                     </div>
                  </div>
                  <div className="px-4 py-2 border-b border-white/5 bg-black/40 flex items-center justify-between text-[9px] font-black text-gray-500">
                     <span className="flex items-center gap-1.5 text-emerald-400/80"><Shield size={10} /> مودات {modCount}</span>
                     <span className="flex items-center gap-1.5 text-fuchsia-400/80"><Crown size={10} /> مشتركون {subCount}</span>
                     {skippedCount > 0 && (
                        <span className="text-gray-600">مستبعدون {skippedCount}</span>
                     )}
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
                     {participants.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center opacity-10">
                           <Star size={50} className="mb-4 animate-spin-slow opacity-20" />
                           <p className="text-sm font-black tracking-[0.2em] uppercase italic text-center">بانتظار وصول <br />المنافسين...</p>
                        </div>
                     ) : (
                        [...participants].reverse().map((p, i) => (
                           <div key={i} className="flex items-center gap-4 p-3 rounded-[1.5rem] border-2 border-white/5 bg-gradient-to-r from-white/5 to-transparent hover:border-red-600/50 hover:from-white/10 transition-all animate-in slide-in-from-right duration-700 group">
                              <ProAvatar
                                 url={p.avatar}
                                 username={p.username}
                                 size="w-12 h-12"
                                 className="overflow-visible"
                              />
<div className="flex flex-col">
                                  <span className="text-xs font-black text-white group-hover:text-red-500 transition-colors flex items-center gap-2">
                                     {p.username}
                                     {entryMode === 'ALL' && subBoost > 0 && isSubscriberUser(p) && (
                                        <span className="px-1.5 py-0.5 rounded-md bg-gradient-to-br from-amber-400 to-yellow-600 text-black text-[9px] font-black shadow-[0_0_10px_rgba(245,158,11,0.7)]">
                                           +{subBoost}%
                                        </span>
                                     )}
                                     {entryMode === 'MODS' && isModeratorUser(p) && (
                                        <Shield size={11} className="text-emerald-400" />
                                     )}
                                     {entryMode === 'SUBS' && (
                                        <Crown size={11} className="text-fuchsia-400" />
                                     )}
                                  </span>
                                  <span className="text-[8px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">
                                     {entryMode === 'MODS' ? 'Moderator' : entryMode === 'SUBS' ? 'Subscriber' : 'Participant Verified'}
                                  </span>
                               </div>
                              <Sparkles size={14} className="text-amber-500 ml-auto opacity-0 group-hover:opacity-100 group-hover:scale-150 transition-all duration-500" />
                           </div>
                        ))
                     )}
                  </div>
               </div>
            </div>
         </SidebarPortal>

         <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-transparent relative overflow-hidden select-none font-display text-white" dir="ltr">

            <div className="absolute inset-0 z-0 pointer-events-none">
               <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-red-600/50 to-transparent"></div>
               <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-red-600/50 to-transparent"></div>
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] bg-[radial-gradient(circle,rgba(220,38,38,0.05)_0%,transparent_70%)] opacity-30"></div>
               <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
            </div>

             {/* LOBBY / SETUP VIEW */}
            {(phase === 'SETUP' || phase === 'LOBBY') && (
               <div className="text-center animate-in zoom-in duration-1000 flex flex-col items-center z-10 w-full max-w-[90vw]">
                  <div className="relative mb-4 transform-gpu hover:scale-105 transition-all duration-700">
                     <div className="absolute inset-[-30px] bg-red-600 blur-[80px] opacity-30 animate-pulse"></div>
                     <div className="w-20 h-20 bg-gradient-to-br from-red-600 to-black rounded-[1.5rem] flex items-center justify-center shadow-[0_0_60px_rgba(255,0,0,0.8)] relative border-[3px] border-white/10 rotate-[15deg] group overflow-hidden">
                        <Gift size={32} className="text-white drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)]" />
                     </div>
                  </div>

                  {phase === 'SETUP' ? (
                     <div className="space-y-4" dir="rtl">
                         <h1 className="text-3xl md:text-4xl font-black text-white italic tracking-tighter uppercase drop-shadow-[0_20px_50px_rgba(220,38,38,0.5)] select-none">سـحـب بـريـمـيو</h1>
                         <div className="flex items-center justify-center gap-4">
                            <div className="h-px w-16 bg-gradient-to-l from-transparent via-red-600 to-transparent shadow-[0_0_10px_red]"></div>
                            <p className="text-white font-black tracking-[0.5em] text-[8px] uppercase italic drop-shadow-[0_0_5px_white]">iABS GAMING ENGINE</p>
                            <div className="h-px w-16 bg-gradient-to-r from-transparent via-red-600 to-transparent shadow-[0_0_10px_red]"></div>
                         </div>
                         {participants.length > 0 && (
                            <div className="flex items-center justify-center gap-6 mt-2">
                               <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-[1rem]">
                                  <Users size={14} className="text-red-500" />
                                  <span className="text-sm font-black text-white">{participants.length}</span>
                               </div>
                               <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-4 py-2 rounded-[1rem]">
                                  <span className="text-sm font-black text-amber-400">الدورة {cycleNum}</span>
                                  <span className="text-xs font-black text-amber-500/60">|</span>
                                  <span className="text-sm font-black text-amber-400">متبقي {cycleRemaining}</span>
                               </div>
                            </div>
                         )}
                        <button
                           onClick={onHome}
                           className="mt-4 px-5 py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-[1rem] border border-white/10 transition-all font-black text-[10px] italic flex items-center gap-2 uppercase tracking-widest"
                        >
                           <Home size={14} /> الـعودة للـقائمة
                        </button>
                     </div>
                  ) : (
                     <div className="flex flex-col items-center gap-4 w-full" dir="rtl">
                        <div className="text-6xl md:text-7xl font-black text-white italic tracking-tighter leading-none font-mono drop-shadow-[0_0_80px_rgba(255,0,0,0.9)] transition-transform duration-500 hover:scale-105 select-none relative z-0">
                           {timeLeft}
                        </div>
                        <div className="relative z-10 -translate-y-4">
                           <div className="bg-white text-black px-8 py-2 rounded-[1.5rem] font-black italic text-lg md:text-xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] border-b-[6px] border-red-600 animate-float transition-all hover:rotate-[-2deg] select-none">
                              انـضـم لـنـا الان!
                           </div>
                        </div>
                        <div className="bg-[#050505]/95 backdrop-blur-3xl border-[2px] border-white/5 py-4 px-6 rounded-[2rem] shadow-[0_40px_80px_rgba(0,0,0,0.8)] flex flex-col items-center gap-2 relative overflow-hidden group mt-2">
                           <div className="absolute inset-0 bg-gradient-to-t from-red-600/10 via-transparent to-transparent"></div>
                           <div className="text-red-600 text-[10px] font-black uppercase tracking-[0.8em] mb-2 animate-pulse z-10 italic">الـكـلمة الـمـفـتاحية</div>
                           <div className="flex items-center gap-4 relative z-10 transition-all duration-700 group-hover:scale-110">
                              <span className="text-2xl md:text-4xl font-black text-white italic tracking-tighter drop-shadow-[0_10px_30px_rgba(255,255,255,0.2)] leading-none">{keyword}</span>
                              {selectedSticker && <img src={selectedSticker} className="w-12 h-12 md:w-16 md:h-16 object-contain animate-bounce drop-shadow-[0_0_30px_rgba(255,255,255,0.4)]" alt="s" />}
                           </div>
                        </div>

                        {/* Live Chat Overlay */}
                        <div className="fixed top-20 right-4 flex flex-col gap-2 w-56 pointer-events-none z-[100]">
                           {recentMessages.map((m, i) => (
                              <div key={i} className="bg-black/40 backdrop-blur-md border border-white/5 rounded-xl p-2 animate-in slide-in-from-right duration-500 flex flex-col items-end shadow-xl">
                                 <span className="text-[10px] font-black italic mb-1" style={{ color: m.color || '#ef4444' }}>{m.user}</span>
                                 <span className="text-xs font-bold text-white text-right leading-relaxed">{m.content}</span>
                              </div>
                           ))}
                        </div>

                        {/* Sleek Bottom HUD Bar */}
                        <div className="fixed bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/80 to-transparent p-4 flex items-end justify-between z-[100] w-full">
                           <div className="flex gap-3">
                              <div className="glass-card bg-white/5 border border-white/10 px-4 py-2 rounded-[1rem] flex flex-col items-center shadow-xl">
                                 <span className="text-[8px] text-gray-500 font-black uppercase mb-1">الـمشاركين</span>
                                 <span className="text-lg font-black text-white font-mono">{participants.length}</span>
                              </div>
                              <div className="glass-card bg-white/5 border border-white/10 px-4 py-2 rounded-[1rem] flex flex-col items-center shadow-xl">
                                 <span className="text-[8px] text-gray-500 font-black uppercase mb-1">مـفـتاح الـدخـول</span>
                                 <span className="text-sm font-black text-red-600 italic">{keyword}</span>
                              </div>
                              <div className="glass-card bg-white/5 border border-white/10 px-4 py-2 rounded-[1rem] flex flex-col items-center shadow-xl">
                                 <span className="text-[8px] text-gray-500 font-black uppercase mb-1">نـوع الـسـحـب</span>
                                 <span className="text-sm font-black text-white italic">
                                    {entryMode === 'ALL' ? 'الـعـاد' : entryMode === 'MODS' ? 'الـمـودات' : 'الـمشتركون'}
                                 </span>
                              </div>
                              {entryMode === 'ALL' && subBoost > 0 && (
                                 <div className="glass-card bg-amber-500/10 border border-amber-500/30 px-4 py-2 rounded-[1rem] flex flex-col items-center shadow-xl">
                                    <span className="text-[8px] text-amber-500/70 font-black uppercase mb-1">مـيـزة الـمشترك</span>
                                    <span className="text-sm font-black text-amber-400 italic">+{subBoost}%</span>
                                 </div>
                              )}
                           </div>

                           <div className="flex gap-2">
                              <button onClick={onHome} className="bg-white/5 hover:bg-red-600 text-gray-400 hover:text-white px-4 py-2 rounded-[1rem] border border-white/10 transition-all font-black text-[10px] italic flex items-center gap-2 shadow-xl">
                                 <Home size={14} /> خـروج
                              </button>
                               <button onClick={fullReset} className="bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-[1rem] border border-white/10 transition-all font-black text-[10px] italic flex items-center gap-2 shadow-xl">
                                  <RotateCcw size={14} /> تصفير شامل
                               </button>
                           </div>
                        </div>
                     </div>
                  )}
               </div>
            )}

            {/* DRAWING MODE */}
            {phase === 'DRAWING' && (
               <div className="w-full h-full flex flex-col items-center justify-center gap-24 md:gap-32 animate-in fade-in duration-2000 z-10">
                  <div className="text-center relative">
                     <div className="absolute -inset-20 bg-red-600 blur-[100px] opacity-30 animate-pulse"></div>
                     <div className="flex items-center justify-center gap-4 mb-4">
                        <Flame size={24} className="text-red-500 animate-bounce" />
                        <div className="text-red-600 font-black uppercase tracking-[0.8em] text-xl italic relative z-10 drop-shadow-[0_0_10px_red]">الـسـحـب الـعـظـيم</div>
                        <Flame size={24} className="text-red-500 animate-bounce" />
                     </div>
                     <h2 className="text-5xl md:text-7xl font-black text-white italic tracking-tighter relative z-10 drop-shadow-[0_15px_50px_black] uppercase leading-none px-4">مـن سـيـحـمـل الـتـاج؟</h2>
                  </div>

                  {/* Live Chat Overlay during Spin */}
                  <div className="fixed top-20 right-4 flex flex-col gap-2 w-56 pointer-events-none z-[100]">
                     {recentMessages.map((m, i) => (
                        <div key={i} className="bg-black/40 backdrop-blur-md border border-white/5 rounded-xl p-2 animate-in slide-in-from-right duration-500 flex flex-col items-end shadow-xl">
                           <span className="text-[10px] font-black italic mb-1" style={{ color: m.color || '#ef4444' }}>{m.user}</span>
                           <span className="text-xs font-bold text-white text-right leading-relaxed">{m.content}</span>
                        </div>
                     ))}
                  </div>

                  <div className="relative w-full max-w-[700px] h-[250px] flex items-center justify-center mt-8">
                     <div className="absolute inset-y-[-60px] w-[180px] left-1/2 -translate-x-1/2 z-[60] pointer-events-none">
                        <div className="absolute inset-x-0 h-full bg-gradient-to-b from-transparent via-red-600/30 to-transparent border-x-[4px] border-red-600 shadow-[0_0_80px_rgba(220,38,38,0.8)] animate-pulse rounded-full"></div>
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex flex-col items-center">
                           <div className="w-8 h-8 rounded-full bg-white shadow-[0_0_40px_white] z-50 flex items-center justify-center">
                              <div className="w-4 h-4 rounded-full bg-red-600 animate-ping"></div>
                           </div>
                           <div className="w-0 h-0 border-l-[20px] border-l-transparent border-r-[20px] border-r-transparent border-t-[30px] border-t-red-600 -translate-y-3 shadow-xl"></div>
                        </div>
                        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center">
                           <div className="w-0 h-0 border-l-[20px] border-l-transparent border-r-[20px] border-r-transparent border-b-[30px] border-b-red-600 translate-y-3 shadow-xl"></div>
                           <div className="w-8 h-8 rounded-full bg-white shadow-[0_0_40px_white] z-50 flex items-center justify-center">
                              <div className="w-4 h-4 rounded-full bg-red-600 animate-ping"></div>
                           </div>
                        </div>
                     </div>

                     <div className="absolute inset-0 border-[12px] border-[#16161a] rounded-[2rem] shadow-[0_0_150px_rgba(0,0,0,1)] bg-[#030303] z-[10] overflow-hidden outline outline-[4px] outline-white/5 relative">
                        <div className="absolute inset-y-0 left-0 w-[120px] bg-gradient-to-r from-black via-black/95 to-transparent z-[25]"></div>
                        <div className="absolute inset-y-0 right-0 w-[120px] bg-gradient-to-l from-black via-black/95 to-transparent z-[25]"></div>
                        <div
                           className="h-full flex items-center"
                           style={{
                              transform: `translateX(${scrollPosition}px)`,
                              transition: isSpinning ? 'transform 7.5s cubic-bezier(0.05, 0, 0, 1)' : 'none'
                           }}
                        >
                           {reelParticipants.map((p, i) => (
                              <div key={i} className="w-[140px] h-[200px] shrink-0 p-3 flex items-center justify-center">
                                 <div className="w-full h-full bg-gradient-to-tr from-white/10 to-transparent border-[2px] border-white/10 rounded-[1.5rem] flex flex-col items-center justify-center gap-3 shadow-[inset_0_2px_15px_rgba(255,255,255,0.05)] relative group transition-all duration-700 hover:border-red-600">
                                    <ProAvatar
                                       url={p.avatar}
                                       username={p.username}
                                       size="w-16 h-16"
                                       className="overflow-visible"
                                    />
                                    <div className="flex flex-col items-center gap-2">
                                     <div className="text-sm font-black text-white truncate max-w-[120px] italic drop-shadow-[0_5px_10px_black] tracking-tighter uppercase text-center leading-tight">{p.username}</div>
                                     {entryMode === 'ALL' && subBoost > 0 && isSubscriberUser(p) && (
                                        <span className="px-2 py-0.5 rounded-md bg-gradient-to-br from-amber-400 to-yellow-600 text-black text-[10px] font-black shadow-[0_0_12px_rgba(245,158,11,0.8)]">
                                           +{subBoost}%
                                        </span>
                                     )}
                                  </div>
                                 </div>
                              </div>
                           ))}
                        </div>
                     </div>
                  </div>
               </div>
            )}

            {/* WINNER SCREEN - REAL PIC FETCHING */}
            {phase === 'WINNER' && winner && (
               <div className="text-center animate-in zoom-in-up duration-1000 z-50 p-4 flex flex-col items-center max-w-full">
                  <div className="relative mb-6 group">
                     <div className="absolute inset-[-40px] bg-red-600 blur-[100px] opacity-40 animate-pulse"></div>
                     <Trophy size={60} className="text-[#FFD700] animate-bounce drop-shadow-[0_0_80px_rgba(255,215,0,1)] relative z-10" fill="currentColor" />
                     <Crown size={30} className="absolute -top-6 left-1/2 -translate-x-1/2 text-white drop-shadow-[0_0_30px_white] animate-pulse z-20" />
                  </div>

                  <div className="bg-[#050505] p-6 rounded-[2.5rem] border-[6px] border-red-600 shadow-[0_0_150px_rgba(255,0,0,0.8)] relative overflow-hidden max-w-full group">
                     <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-white/80 to-transparent animate-shimmer"></div>
                     <div className="absolute inset-0 bg-gradient-to-t from-red-600/10 via-transparent to-transparent"></div>

                     <div className="text-red-600 font-black uppercase tracking-[1em] text-xs mb-4 italic flex items-center justify-center gap-4 drop-shadow-[0_0_5px_red]">
                        <span className="w-12 h-px bg-red-600 shadow-[0_0_10px_red]"></span> الـبـطـل الأسـطـوري <span className="w-12 h-px bg-red-600 shadow-[0_0_10px_red]"></span>
                     </div>

                     <div className="flex flex-col items-center gap-4 relative z-10">
                        <ProAvatar
                           url={winner.avatar}
                           username={winner.username}
                           size="w-24 h-24 md:w-32 md:h-32"
                           className="overflow-visible"
                        />
                        <div className="flex flex-col items-center gap-2">
                        <div className="text-2xl md:text-3xl font-black text-white italic tracking-tighter uppercase drop-shadow-[0_20px_60px_black] leading-none select-all text-center">{winner.username}</div>
                        <div className="flex items-center gap-2 flex-wrap justify-center">
                           {entryMode === 'ALL' && subBoost > 0 && isSubscriberUser(winner) && (
                              <span className="px-3 py-1 rounded-lg bg-gradient-to-br from-amber-400 to-yellow-600 text-black text-[12px] font-black shadow-[0_0_20px_rgba(245,158,11,0.8)]">
                                 +{subBoost}% ترجيح
                              </span>
                           )}
                           {isModeratorUser(winner) && (
                              <span className="px-3 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-[11px] font-black flex items-center gap-1">
                                 <Shield size={12} /> مود
                              </span>
                           )}
{isSubscriberUser(winner) && (
                              <span className="px-3 py-1 rounded-lg bg-fuchsia-500/20 border border-fuchsia-400/50 text-fuchsia-300 text-[11px] font-black flex items-center gap-1">
                                 <Crown size={12} /> مشترك
                              </span>
                            )}
                        </div>
                      </div>
                     </div>

                      <div className="flex gap-4 justify-center mt-4 relative z-20" dir="rtl">
                               <button onClick={resetGame} className="px-6 py-2 bg-white text-black font-black text-xs rounded-[1.5rem] hover:scale-110 active:scale-95 transition-all italic shadow-xl flex items-center gap-2 border-b-[6px] border-gray-300">
                                  <RotateCcw size={16} className="text-red-600" /> جـولة جـديـدة
                               </button>
                               <button onClick={onHome} className="px-6 py-2 bg-black/60 border-[3px] border-red-600 text-red-600 font-black text-xs rounded-[1.5rem] hover:bg-red-600 hover:text-white transition-all italic shadow-xl border-b-[6px] border-red-800">
                                  <Home size={16} /> الرئيسية
                               </button>
                     </div>
                  </div>
               </div>
            )}
         </div>

         <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 10px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(232, 190, 110, 0.35); border-radius: 20px; border: 4px solid transparent; background-clip: content-box; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(232, 190, 110, 0.8); background-clip: content-box; }

        @keyframes shimmer {
          0% { transform: translateX(-150%) skewX(-30deg); }
          100% { transform: translateX(150%) skewX(-30deg); }
        }
        .animate-shimmer { animation: shimmer 3s infinite linear; }
        
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
        .animate-float { animation: float 3s ease-in-out infinite; }
      `}</style>
      </>
   );
};
