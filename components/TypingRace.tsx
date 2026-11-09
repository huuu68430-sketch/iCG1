import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { chatService } from '../services/chatService';
import { awardPoints } from '../services/points';
import { TYPING_WORDS } from '../constants';
import { Keyboard as KeyboardIcon, Play, RotateCcw, Trophy, Zap, Timer, LogOut, Home, History, User } from 'lucide-react';
import confetti from 'canvas-confetti';
import { ProAvatar } from './ProAvatar';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

interface TypingRaceProps {
   channelConnected: boolean;
   onHome: () => void;
}

const SidebarPortal = ({ children }: { children?: React.ReactNode }) => {
   const [mounted, setMounted] = useState(false);
   useEffect(() => { setMounted(true); return () => setMounted(false); }, []);
   const el = document.getElementById('game-sidebar-portal');
   if (!mounted || !el) return null;
   return createPortal(children, el);
};

export const TypingRace: React.FC<TypingRaceProps> = ({ channelConnected, onHome }) => {
   const [currentWord, setCurrentWord] = useState<string | null>(null);
   const [winner, setWinner] = useState<{ name: string, time: number, avatar?: string, color?: string } | null>(null);
   const [startTime, setStartTime] = useState(0);
   const [elapsed, setElapsed] = useState(0);
   const [wordHistory, setWordHistory] = useState<string[]>([]);
   const [isGenerating, setIsGenerating] = useState(false);

   const availableIndices = useRef<number[]>([]);
   const wordRef = useRef(currentWord);

   useEffect(() => { wordRef.current = currentWord; }, [currentWord]);

   useEffect(() => {
      let interval: number;
      if (currentWord && !winner) interval = window.setInterval(() => setElapsed(Date.now() - startTime), 50);
      return () => clearInterval(interval);
   }, [currentWord, winner, startTime]);

   const resetPool = () => {
      availableIndices.current = Array.from({ length: TYPING_WORDS.length }, (_, i) => i);
      for (let i = availableIndices.current.length - 1; i > 0; i--) {
         const j = Math.floor(Math.random() * (i + 1));
         [availableIndices.current[i], availableIndices.current[j]] = [availableIndices.current[j], availableIndices.current[i]];
      }
   };

   // --- REAL KICK AVATAR FETCHING ---
   const fetchRealAvatar = async (username: string) => {
      try {
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

   const triggerWinEffect = () => {
      const duration = 3000;
      const end = Date.now() + duration;

      const frame = () => {
         confetti({
            particleCount: 5,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: ['#ff0000', '#ffffff', '#00ff00']
         });
         confetti({
            particleCount: 5,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: ['#ff0000', '#ffffff', '#00ff00']
         });

         if (Date.now() < end) {
            requestAnimationFrame(frame);
         }
      };
      frame();
   };

   useEffect(() => {
      if (!channelConnected) return;
      const cleanup = chatService.onMessage(async (msg) => {
         if (!wordRef.current || !!winner) return;

         if (msg.content.trim() === wordRef.current) {
            const userWinner = {
               name: msg.user.username,
               time: (Date.now() - startTime) / 1000,
               avatar: msg.user.avatar, // Initial avatar from chat msg
               color: msg.user.color
            };

            // 1. FAST UPDATE: Set winner immediately to keep it snappy
            setWinner(userWinner);
            setWordHistory(prev => [wordRef.current!, ...prev].slice(0, 5));
            setCurrentWord(null);
            triggerWinEffect();

            // 2. SLOW UPDATE: Fetch high-res avatar in background
            chatService.fetchKickAvatar(userWinner.name).then((realPic) => {
               if (realPic) {
                  setWinner(prev => prev ? { ...prev, avatar: realPic } : prev);
               }
            });

            awardPoints('TYPING_RACE', userWinner.name, userWinner.avatar || '', 'round');
         }
      });
      return cleanup;
   }, [channelConnected, startTime, winner]);

   const startRound = () => {
      if (availableIndices.current.length === 0) resetPool();
      setWinner(null);
      setElapsed(0);
      setIsGenerating(true);

      let nextIndex = availableIndices.current.pop();
      if (nextIndex === undefined) {
         resetPool();
         nextIndex = availableIndices.current.pop() || 0;
      }
      const word = TYPING_WORDS[nextIndex];

      setTimeout(() => {
         setIsGenerating(false);
         setCurrentWord(word);
         setStartTime(Date.now());
      }, 300); // Small artificial delay for visual feedback
   };

   return (
      <>
         <SidebarPortal>
             <div className="bg-gradient-to-br from-[#1a1408]/90 to-[#0a0805]/95 p-4 rounded-[1.5rem] border border-[#e8be6e]/40 space-y-4 animate-in slide-in-from-right duration-500 shadow-[0_0_40px_rgba(232,190,110,0.12)] backdrop-blur-md">
               <div className="flex items-center justify-between border-b border-[#e8be6e]/20 pb-4">
                  <h4 className="text-[12px] font-black text-[#e8be6e] uppercase tracking-widest flex items-center gap-3">
                     <KeyboardIcon size={16} /> لوحة التحكم
                  </h4>
                  <button onClick={onHome} className="p-2 bg-[#e8be6e]/10 hover:bg-[#e8be6e]/20 text-[#e8be6e] rounded-xl transition-all border border-[#e8be6e]/30"><LogOut size={14} /></button>
               </div>

               <button onClick={startRound} disabled={isGenerating} className="w-full bg-gradient-to-r from-[#f9e0a4] to-[#c08b3a] text-[#1a1006] font-black py-3 rounded-[1rem] text-xs shadow-[0_10px_30px_rgba(232,190,110,0.4)] hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 border-t border-[#fbeccb]/60 uppercase tracking-widest group disabled:opacity-50 disabled:cursor-not-allowed">
                  {isGenerating ? (
                     <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        جاري التوليد...
                     </>
                  ) : (
                     <>
                        <Play fill="currentColor" size={16} className={currentWord ? '' : 'animate-pulse'} />
                        {currentWord ? 'تجاوز الكلمة' : 'ابـدأ الـسـبـاق'}
                     </>
                  )}
               </button>

               <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => { resetPool(); alert("تم إعادة تعبئة الكلمات!"); }} className="bg-white/5 text-gray-400 py-3 rounded-[0.8rem] text-[10px] font-black hover:text-white hover:bg-white/10 border border-white/5 uppercase tracking-wide transition-all flex flex-col items-center justify-center gap-2">
                     <RotateCcw size={16} /> إعادة خلط
                  </button>
                  <button onClick={onHome} className="bg-white/5 text-red-500 py-3 rounded-[0.8rem] text-[10px] font-black hover:bg-red-600/10 border border-white/5 uppercase tracking-wide transition-all flex flex-col items-center justify-center gap-2">
                     <Home size={16} /> خروج
                  </button>
               </div>

               {wordHistory.length > 0 && (
                   <div className="bg-black/20 rounded-[1rem] p-3 border border-white/5">
                     <div className="flex items-center gap-2 text-[10px] text-gray-500 font-bold mb-3 uppercase tracking-widest px-1">
                        <History size={12} /> آخر الكلمات
                     </div>
                     <div className="space-y-2">
                        {wordHistory.map((w, i) => (
                           <div key={i} className="text-gray-400 text-xs font-mono bg-white/5 px-3 py-2 rounded-lg border-r-2 border-red-500/50 flex justify-between">
                              <span>{w}</span>
                              <span className="text-gray-600 text-[9px]">#{i + 1}</span>
                           </div>
                        ))}
                     </div>
                  </div>
               )}
            </div>
         </SidebarPortal>

         <div className="w-full h-full flex flex-col items-center justify-center p-8 relative overflow-hidden select-none" style={{ background: 'radial-gradient(60% 50% at 72% 26%, rgba(160,100,40,.25), transparent 70%), radial-gradient(50% 40% at 12% 92%, rgba(232,190,110,.09), transparent 70%), #0a0805' }}>

            <div className="absolute inset-0 pointer-events-none">
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] bg-[radial-gradient(circle,rgba(232,190,110,0.06)_0%,transparent_70%)]"></div>
               <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(232,190,110,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(232,190,110,.05) 1px, transparent 1px)', backgroundSize: '48px 48px', WebkitMask: 'radial-gradient(70% 70% at 50% 45%, #000, transparent)', mask: 'radial-gradient(70% 70% at 50% 45%, #000, transparent)', opacity: 0.5 }}></div>
            </div>

            {!currentWord && !winner && (
               <div className="text-center opacity-60 animate-in zoom-in duration-1000">
                  <div className="relative inline-block mb-8">
                     <div className="absolute inset-0 bg-[#e8be6e]/30 blur-[60px] animate-pulse rounded-full"></div>
                      <KeyboardIcon size={80} className="relative z-10 text-[#b2a283]" />
                  </div>
                   <h2 className="text-[3.5rem] font-black text-white italic tracking-tighter uppercase leading-none drop-shadow-2xl">
                     سباق <span className="text-transparent bg-clip-text bg-gradient-to-b from-[#fff7de] to-[#e8be6e]">الكتابة</span>
                  </h2>
                   <p className="text-xl text-[#e8be6e]/80 font-bold uppercase tracking-[0.8em] mt-4 animate-pulse">
                     iCG1 Speed Engine
                  </p>
               </div>
            )}

            {currentWord && (
               <div className="flex flex-col items-center justify-center w-full max-w-4xl animate-in fade-in zoom-in duration-300 z-10">

                   <div className="flex items-center justify-center gap-3 mb-10 bg-[#1a1408]/60 backdrop-blur-md px-6 py-3 rounded-full border border-[#e8be6e]/40 shadow-2xl">
                      <Timer size={24} className={`text-[#e8be6e] ${elapsed > 10000 ? 'animate-spin-fast' : 'animate-spin-slow'}`} />
                      <span className="font-mono text-3xl font-black text-white tabular-nums tracking-widest">
                         {(elapsed / 1000).toFixed(2)}<span className="text-xl text-[#b2a283] ml-1">s</span>
                     </span>
                  </div>

                  <div className="relative group w-full text-center">
                     <div className="absolute inset-[-50px] bg-gradient-to-r from-[#e8be6e]/15 via-[#c08b3a]/10 to-[#e8be6e]/15 blur-[100px] rounded-full opacity-60 group-hover:opacity-100 transition-all duration-1000 animate-pulse"></div>

                     <div className="relative transform transition-transform duration-200 hover:scale-105">
                         <div className="text-[80px] font-black text-white leading-none italic tracking-tighter drop-shadow-[0_6px_0px_rgba(0,0,0,0.5)]">
                            {currentWord}
                         </div>
                         <div className="text-[80px] font-black text-white/5 leading-none italic tracking-tighter absolute top-full left-0 w-full transform -scale-y-100 opacity-20 mask-gradient" style={{ maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1), rgba(0,0,0,0))', WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1), rgba(0,0,0,0))' }}>
                           {currentWord}
                        </div>
                     </div>
                  </div>

                   <div className="mt-12 text-gray-500 font-mono text-sm uppercase tracking-[0.5em] animate-pulse">
                     اكتب الكلمة بأسرع ما يمكن!
                  </div>
               </div>
            )}

            {winner && (
               <div className="text-center animate-in slide-in-from-bottom-12 duration-700 z-20">
                   <Trophy size={90} className="text-[#FFD700] mx-auto mb-6 animate-bounce drop-shadow-[0_0_80px_rgba(255,215,0,0.6)]" fill="currentColor" />

                   <div className="bg-gradient-to-br from-[#1a1408]/95 to-[#0a0805]/95 border border-[#e8be6e]/50 p-10 rounded-[2.5rem] shadow-[0_50px_100px_rgba(232,190,110,0.2)] relative overflow-hidden backdrop-blur-3xl min-w-[420px]">
                     <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#e8be6e] via-[#fbeccb] to-[#e8be6e] animate-gradient-x"></div>

                      <div className="text-[#e8be6e] font-black uppercase tracking-[0.4em] text-[10px] mb-6 italic flex items-center justify-center gap-2">
                        <Zap size={16} /> Fastest Fingers <Zap size={16} />
                     </div>

                      <div className="flex flex-col items-center justify-center gap-4 mb-8">

                        <ProAvatar
                           url={winner.avatar}
                           username={winner.name}
                           size="w-24 h-24"
                           className="transition-transform hover:scale-110 overflow-visible"
                        />
                        <div>
                            <div className="text-5xl font-black text-white italic tracking-tighter uppercase drop-shadow-xl">{winner.name}</div>
                            <div className="text-2xl font-mono font-black text-[#e8be6e] mt-2">{winner.time.toFixed(3)}s</div>
                        </div>
                     </div>

                      <div className="flex gap-3 px-6">
                         <button onClick={startRound} className="flex-1 py-4 bg-white hover:bg-gray-100 text-black font-black text-lg rounded-[1.25rem] hover:scale-105 active:scale-95 transition-all italic shadow-2xl flex items-center justify-center gap-2">
                            <Play size={20} fill="black" /> الجولة التالية
                         </button>
                         <button onClick={onHome} className="flex-1 py-4 bg-zinc-800 hover:bg-zinc-700 text-white font-black text-lg rounded-[1.25rem] hover:scale-105 active:scale-95 transition-all italic shadow-2xl border border-white/5">
                           خروج
                        </button>
                     </div>
                  </div>
               </div>
            )}
         </div>

         <style>{`
        .animate-spin-slow { animation: spin 3s linear infinite; }
        .animate-spin-fast { animation: spin 0.5s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .mask-gradient { mask-image: linear-gradient(to top, transparent, black); -webkit-mask-image: linear-gradient(to top, transparent, black); }
        @keyframes gradient-x {
             0% { background-position: 0% 50%; }
             50% { background-position: 100% 50%; }
             100% { background-position: 0% 50%; }
        }
        .animate-gradient-x {
            background-size: 200% 200%;
            animation: gradient-x 3s ease infinite;
        }
      `}</style>
      </>
   );
};
