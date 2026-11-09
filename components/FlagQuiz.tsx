
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { chatService } from '../services/chatService';
import { awardPoints } from '../services/points';
import { FLAGS_DATA } from '../constants';
import { Flag, Play, RotateCcw, Award, CheckCircle2, LogOut, Home, Star, Globe, Zap, Settings2, User } from 'lucide-react';
import { ProAvatar } from './ProAvatar';

interface FlagQuizProps {
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

// ==========================================
// 🏴 FLAG DATASETS & LEVELS
// ==========================================

// Level 1: Easy (Arab Countries & Very Famous Global)
const LEVEL_EASY = FLAGS_DATA.filter(f =>
   ['sa', 'eg', 'ae', 'kw', 'qa', 'om', 'bh', 'jo', 'lb', 'ps', 'iq', 'ye', 'sy', 'sd', 'ly', 'tn', 'dz', 'ma', 'us', 'gb', 'fr', 'de', 'jp', 'cn', 'kr', 'tr'].includes(f.code)
);

// Level 2: Medium (Mix of Arab, European, Asian, Americas - Default)
const LEVEL_MEDIUM = FLAGS_DATA.filter(f =>
   !['nu', 'tv', 'nr', 'ki', 'fm', 'pw', 'mh', 'sb', 'vu', 'ws', 'to', 'fj', 'st', 'cv', 'km', 'sc', 'mu', 'dm', 'lc', 'vc', 'gd', 'bb', 'ag', 'kn'].includes(f.code)
);

// Level 3: Hard (Everything including obscure islands)
const LEVEL_HARD = FLAGS_DATA;

const LEVELS = [
   { id: 'easy', label: 'سـهـل', data: LEVEL_EASY, icon: Star, color: 'text-icg-live', desc: 'دول عربية ومشهورة' },
   { id: 'medium', label: 'مـتوسـط', data: LEVEL_MEDIUM, icon: Zap, color: 'text-icg-gold', desc: 'تحدي متوازن (الافتراضي)' },
   { id: 'hard', label: 'صـعـب', data: LEVEL_HARD, icon: Globe, color: 'text-icg-ember', desc: 'كل دول العالم!' },
] as const;


export const FlagQuiz: React.FC<FlagQuizProps> = ({ channelConnected, onHome }) => {
   const [isActive, setIsActive] = useState(false);
   const [currentFlag, setCurrentFlag] = useState<typeof FLAGS_DATA[0] | null>(null);
   const [scores, setScores] = useState<Record<string, number>>({});
   const [lastWinner, setLastWinner] = useState<{ name: string, answer: string, avatar?: string } | null>(null);

   // ⚙️ Unified Game Settings
   const [selectedLevel, setSelectedLevel] = useState<'easy' | 'medium' | 'hard'>('medium');
   const [showOptions, setShowOptions] = useState(false); // Can be used for extra features later
   const [autoNext, setAutoNext] = useState(true);
   const [blurEffect, setBlurEffect] = useState(false); // Feature: Blur flag initially
   const [timerEnabled, setTimerEnabled] = useState(false);
   const [timer, setTimer] = useState(30);

   const currentFlagRef = useRef(currentFlag);
   const isActiveRef = useRef(isActive);
   const selectedLevelRef = useRef(selectedLevel);
   const timerRef = useRef<number | null>(null);

   useEffect(() => { currentFlagRef.current = currentFlag; }, [currentFlag]);
   useEffect(() => { isActiveRef.current = isActive; }, [isActive]);
   useEffect(() => { selectedLevelRef.current = selectedLevel; }, [selectedLevel]);

   // Timer Logic
   useEffect(() => {
      if (isActive && timerEnabled && timer > 0) {
         const t = setTimeout(() => setTimer(prev => prev - 1), 1000);
         return () => clearTimeout(t);
      } else if (timer === 0 && isActive && timerEnabled) {
         // Time's up! Reveal answer
         handleRoundWin('Time Up!', currentFlag?.names[0] || 'Unknown', '');
      }
   }, [isActive, timer, timerEnabled]);

   useEffect(() => {
      if (!channelConnected) return;
      const cleanup = chatService.onMessage(async (msg) => {
         if (!isActiveRef.current || !currentFlagRef.current) return;
         const content = msg.content.toLowerCase().trim();

         // Smart fuzzy matching could be added here, but exact substring match is good for now
         // Using .some to check all valid names for the flag
         const isCorrect = currentFlagRef.current.names.some(name => content.includes(name.toLowerCase()));

         if (isCorrect) {
            const username = msg.user.username;
            const currentAvatar = msg.user.avatar;
            const correctName = currentFlagRef.current.names[0];

            await handleRoundWin(username, correctName, currentAvatar);

            // Fetch high-res avatar in background
            chatService.fetchKickAvatar(username).then(realPic => {
               if (realPic) {
                  setLastWinner(prev => (prev && prev.name === username) ? { ...prev, avatar: realPic } : prev);
               }
            });
         }
      });
      return cleanup;
   }, [channelConnected]);

   const nextRound = () => {
      setLastWinner(null);
      setTimer(30); // Reset timer

      // Choose dataset based on level
      const dataset = LEVELS.find(l => l.id === selectedLevelRef.current)?.data || LEVEL_MEDIUM;
      const randomFlag = dataset[Math.floor(Math.random() * dataset.length)];

      setCurrentFlag(randomFlag);
      setIsActive(true);
   };

   const handleRoundWin = async (username: string, answer: string, avatar?: string) => {
      setIsActive(false);
      setLastWinner({ name: username, answer, avatar });
      if (username !== 'Time Up!') {
         setScores(prev => ({ ...prev, [username]: (prev[username] || 0) + 1 }));
         // Points Calculation: Harder level = more points? Kept standard 25 for now.
         awardPoints('FLAG_QUIZ', username, avatar || '', 'round');
      }

      if (autoNext) {
         setTimeout(() => { nextRound(); }, 4000);
      }
   };

   const startGame = () => { setScores({}); nextRound(); };
   const stopGame = () => { setIsActive(false); setCurrentFlag(null); setLastWinner(null); };

   const sortedScores = Object.entries(scores).sort((a, b) => (b[1] as number) - (a[1] as number));
   const currentLevelObj = LEVELS.find(l => l.id === selectedLevel);

   return (
      <>
         <SidebarPortal>
             <div className="bg-icg-ink/85 backdrop-blur-2xl p-4 rounded-[1.5rem] border-2 border-icg-gold/15 space-y-4 animate-in slide-in-from-right duration-500 shadow-2xl relative overflow-hidden">
               {/* Decorative Shimmer */}
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-icg-gold to-transparent opacity-50"></div>

               <div className="flex items-center justify-between">
                   <h4 className="text-[14px] font-black text-icg-cream uppercase tracking-widest flex items-center gap-2">
                     <Flag size={18} className="text-icg-gold" /> إعدادات التحدي
                  </h4>
                  <button onClick={onHome} className="p-2.5 bg-icg-gold/10 hover:bg-icg-gold/20 text-icg-muted hover:text-icg-cream rounded-2xl transition-all border border-icg-gold/10"><LogOut size={16} /></button>
               </div>

               {/* 6 DISTINCTIVE SETTINGS / CONTROLS */}
                <div className="space-y-3">

                  {/* 1. Game State Control */}
                  <div className="flex gap-2">
                     {!currentFlag ? (
                         <button onClick={startGame} className="flex-1 bg-gradient-to-r from-icg-light to-icg-deep text-icg-espresso font-black py-3 rounded-[1.5rem] text-[12px] shadow-[0_10px_30px_rgba(232,190,110,0.3)] hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3 border-t border-icg-cream/25 uppercase tracking-widest group">
                           <Play size={16} fill="currentColor" className="group-hover:animate-pulse" /> ابـدأ الـلـعـب
                        </button>
                     ) : (
                         <button onClick={stopGame} className="flex-1 bg-icg-brown text-icg-ember font-bold py-3 rounded-[1.5rem] text-[12px] hover:bg-icg-bronze transition-all border border-icg-gold/10 uppercase tracking-widest shadow-lg">
                           إنـهـاء الـجـولـة
                        </button>
                     )}
                  </div>

                  {/* 2. Skip & Reset Controls */}
                   <div className="grid grid-cols-2 gap-2">
                     <button onClick={() => nextRound()} disabled={!isActive} className="bg-icg-gold/8 text-icg-cream/70 py-2 rounded-2xl text-[10px] font-black hover:bg-icg-gold/12 hover:text-icg-cream border border-icg-gold/10 transition-all flex items-center justify-center gap-2 uppercase tracking-tight"><RotateCcw size={14} /> تـخـطـي الـعـلـم</button>
                     <button onClick={() => setScores({})} className="bg-icg-gold/8 text-icg-ember py-2 rounded-2xl text-[10px] font-black hover:bg-icg-ember/15 border border-icg-gold/10 transition-all flex items-center justify-center gap-2 uppercase tracking-tight"><Settings2 size={14} /> تـصـفـيـر</button>
                  </div>

                  {/* 3. Level Selection (The Core Request) */}
                  <div className="space-y-2 pt-2">
                     <label className="text-[10px] font-black text-icg-muted uppercase tracking-widest px-1">مستوى الصعوبة</label>
                     <div className="grid grid-cols-3 gap-2 bg-icg-brown/40 p-1.5 rounded-[1.5rem] border border-icg-gold/10">
                        {LEVELS.map((lvl) => {
                           const Icon = lvl.icon;
                           const isSel = selectedLevel === lvl.id;
                           return (
                              <button
                                 key={lvl.id}
                                  onClick={() => setSelectedLevel(lvl.id)}
                                  className={`relative flex flex-col items-center justify-center gap-1 py-2 rounded-[1.2rem] transition-all duration-300 ${isSel ? 'bg-icg-gold/12 shadow-lg scale-100' : 'hover:bg-icg-gold/8 scale-90 opacity-60'}`}
                              >
                                 <Icon size={16} className={`${lvl.color} ${isSel ? 'animate-bounce' : ''}`} />
                                 <span className={`text-[9px] font-black ${isSel ? 'text-icg-cream' : 'text-icg-muted'}`}>{lvl.label}</span>
                                 {isSel && <div className={`absolute -bottom-1 w-8 h-1 rounded-full ${lvl.color.replace('text', 'bg')}`}></div>}
                              </button>
                           )
                        })}
                     </div>
                     <p className="text-[9px] text-icg-muted text-center font-bold px-2">{currentLevelObj?.desc}</p>
                  </div>

                  {/* 4. Auto Next Toggle */}
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-icg-gold/8 border border-icg-gold/10">
                     <span className="text-[10px] font-black text-icg-cream/75">التالي تلقائياً</span>
                     <button onClick={() => setAutoNext(!autoNext)} className={`w-10 h-5 rounded-full transition-colors relative ${autoNext ? 'bg-icg-live' : 'bg-icg-brown'}`}>
                        <div className={`absolute top-1 left-1 w-3 h-3 bg-icg-cream rounded-full transition-transform ${autoNext ? 'translate-x-5' : ''}`}></div>
                     </button>
                  </div>

                  {/* 5. Blur Effect Toggle (Hard Mode Feature) */}
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-icg-gold/8 border border-icg-gold/10">
                     <span className="text-[10px] font-black text-icg-cream/75">تشويش الصورة</span>
                     <button onClick={() => setBlurEffect(!blurEffect)} className={`w-10 h-5 rounded-full transition-colors relative ${blurEffect ? 'bg-icg-ember' : 'bg-icg-brown'}`}>
                        <div className={`absolute top-1 left-1 w-3 h-3 bg-icg-cream rounded-full transition-transform ${blurEffect ? 'translate-x-5' : ''}`}></div>
                     </button>
                  </div>

                  {/* 6. Timer Toggle */}
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-icg-gold/8 border border-icg-gold/10">
                     <span className="text-[10px] font-black text-icg-cream/75">مؤقت (30ث)</span>
                     <button onClick={() => setTimerEnabled(!timerEnabled)} className={`w-10 h-5 rounded-full transition-colors relative ${timerEnabled ? 'bg-icg-gold' : 'bg-icg-brown'}`}>
                        <div className={`absolute top-1 left-1 w-3 h-3 bg-icg-cream rounded-full transition-transform ${timerEnabled ? 'translate-x-5' : ''}`}></div>
                     </button>
                  </div>

               </div>
            </div>

            {/* Leaderboard */}
            <div className="bg-icg-ink/85 backdrop-blur-2xl rounded-[1.5rem] border-2 border-icg-gold/15 flex flex-col overflow-hidden h-[280px] mt-4 shadow-2xl">
                <div className="p-3 border-b border-icg-gold/10 bg-icg-gold/8 flex justify-between items-center">
                  <span className="text-[11px] font-black text-icg-cream uppercase tracking-widest flex items-center gap-2"><Award size={16} className="text-icg-gold" /> لوحة الأبطال</span>
                  <span className="bg-icg-gold text-icg-espresso px-3 py-1 rounded-[0.8rem] text-[11px] font-black shadow-lg">{sortedScores.length}</span>
               </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                  {sortedScores.map(([name, score], i) => (
                      <div key={name} className="flex items-center justify-between p-2 rounded-[1.5rem] bg-icg-gold/8 border border-icg-gold/10 hover:bg-icg-gold/12 transition-colors group">
                         <div className="flex items-center gap-2">
                            <span className={`min-w-5 h-5 flex items-center justify-center text-[10px] font-black rounded-full ${i === 0 ? 'bg-icg-gold text-icg-espresso shadow-[0_0_12px_rgba(232,190,110,0.7)]' : 'bg-icg-gold/12 text-icg-muted'}`}>#{i + 1}</span>
                           <ProAvatar username={name} size="w-8 h-8" />
                           <span className="text-[11px] font-bold text-icg-cream truncate max-w-[80px] group-hover:text-icg-cream transition-colors">{name}</span>
                        </div>
                         <span className="text-icg-gold font-black italic text-sm px-2">{score}</span>
                     </div>
                  ))}
                  {sortedScores.length === 0 && (
                     <div className="h-full flex flex-col items-center justify-center opacity-20">
                         <Award size={24} className="mb-2" />
                        <span className="text-[10px] font-black">لا يوجد فائزين</span>
                     </div>
                  )}
               </div>
            </div>
         </SidebarPortal>

          <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-transparent relative overflow-hidden select-none" dir="ltr">

            {/* Background Ambient */}
            <div className="absolute inset-0 z-0 pointer-events-none">
               <div className="fq-wash absolute inset-0"></div>
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-[radial-gradient(circle,rgba(232,190,110,0.07)_0%,transparent_60%)]"></div>
               <div className="absolute inset-0 fq-grid opacity-60"></div>
            </div>

            {!currentFlag ? (
               <div className="text-center animate-in zoom-in duration-1000 z-10 relative">
                  <div className="absolute inset-[-50px] bg-icg-gold/20 blur-[100px] rounded-full animate-pulse"></div>
                  <div className="relative transform hover:scale-105 transition-transform duration-500">
                      <Flag size={80} className="mx-auto mb-4 text-icg-gold drop-shadow-[0_0_30px_rgba(232,190,110,0.35)]" />
                     <h2 className="fq-title text-5xl font-black italic tracking-tighter uppercase leading-none">تحدي الأعلام</h2>
                  </div>
                  <div className="flex items-center justify-center gap-3 mt-6">
                     <div className="h-1 w-20 bg-gradient-to-l from-transparent to-icg-gold"></div>
                     <p className="text-xl text-icg-muted font-black uppercase tracking-[0.5em] italic">iABS World Quiz</p>
                     <div className="h-1 w-20 bg-gradient-to-r from-transparent to-icg-gold"></div>
                  </div>
               </div>
            ) : (
                <div className="flex flex-col items-center animate-in zoom-in duration-500 w-full max-w-2xl z-10">

                  {/* HUD Header */}
                   <div className="flex items-center gap-4 mb-6">
                      <div className="bg-icg-espresso/70 backdrop-blur-xl border border-icg-gold/15 px-6 py-2 rounded-full flex items-center gap-3 shadow-2xl">
                        <Globe size={20} className={currentLevelObj?.color} />
                        <span className="text-icg-cream font-black uppercase tracking-widest text-sm">{currentLevelObj?.label}</span>
                     </div>
                     {timerEnabled && (
                         <div className={`bg-icg-espresso/70 backdrop-blur-xl border border-icg-gold/15 px-4 py-2 rounded-full font-mono text-lg font-black shadow-2xl ${timer < 10 ? 'text-icg-ember animate-pulse' : 'text-icg-cream'}`}>
                           {timer}s
                        </div>
                     )}
                  </div>

                  {/* THE FLAG CARD */}
                  <div className="relative group perspective-1000">
                     <div className="absolute inset-[-20px] bg-gradient-to-br from-icg-gold/30 to-icg-deep/30 blur-[60px] rounded-[2rem] animate-pulse"></div>

                     <div className={`relative p-5 bg-icg-espresso border-[4px] border-icg-gold/25 rounded-[2rem] shadow-[0_30px_100px_rgba(0,0,0,0.8)] transform-gpu transition-all duration-700 group-hover:scale-[1.02] group-hover:rotate-1`}>
                        <div className="rounded-[1.5rem] overflow-hidden relative w-[420px] h-[260px] flex items-center justify-center bg-icg-brown border border-icg-gold/10">
                           <img
                              src={`https://flagcdn.com/w640/${currentFlag.code}.png`}
                              alt="Flag"
                              className={`w-full h-full object-cover shadow-inner transition-all duration-1000 ${isActive && blurEffect ? 'blur-md scale-110' : 'blur-0 scale-100'}`}
                           />
                           {/* Shine Effect */}
                           <div className="absolute inset-0 bg-gradient-to-tr from-icg-cream/10 via-transparent to-transparent opacity-50 pointer-events-none"></div>
                        </div>
                     </div>
                  </div>

                  {/* Game Status / Winner Reveal */}
                   {lastWinner ? (
                     <div className="mt-8 text-center animate-in slide-in-from-bottom-10 fade-in duration-500 z-20">
                        <div className="relative bg-icg-ink/85 backdrop-blur-3xl px-10 py-6 rounded-[2.5rem] border-[3px] border-icg-live shadow-[0_0_100px_rgba(75,224,122,0.25)] min-w-[350px]">
                           <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-icg-live text-icg-espresso px-6 py-1 rounded-full font-black uppercase tracking-widest text-sm shadow-xl flex items-center gap-2">
                              <CheckCircle2 size={18} /> Round Winner
                           </div>

                           <div className="w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                              <ProAvatar
                                 url={lastWinner.avatar || ''}
                                 username={lastWinner.name}
                                 size="w-20 h-20"
                              />
                           </div>

                           <div className="text-4xl font-black text-icg-cream italic tracking-tighter uppercase drop-shadow-lg mb-1">{lastWinner.name}</div>
                           <div className="flex items-center justify-center gap-2 text-sm font-bold text-icg-muted uppercase tracking-widest bg-icg-gold/8 px-4 py-1 rounded-full mx-auto w-fit">
                              Answer: <span className="text-icg-live font-black text-lg">{lastWinner.answer}</span>
                           </div>
                        </div>
                     </div>
                  ) : (
                      <div className="mt-10 text-center animate-pulse z-20">
                         <div className="bg-icg-espresso/70 backdrop-blur-md px-6 py-3 rounded-full border border-icg-gold/15 shadow-xl">
                            <p className="text-lg font-black text-icg-cream italic tracking-[0.2em] uppercase flex items-center gap-2">
                               <span className="w-2 h-2 bg-icg-gold rounded-full animate-ping"></span>
                               اكتب اسم الدولة في الشات
                               <span className="w-2 h-2 bg-icg-gold rounded-full animate-ping"></span>
                           </p>
                        </div>
                     </div>
                  )}
               </div>
            )}
         </div>

         <style>{`
        .fq-wash { background: radial-gradient(60% 50% at 72% 26%, rgba(160,100,40,.28), transparent 70%), radial-gradient(50% 40% at 12% 92%, rgba(232,190,110,.10), transparent 70%), rgba(10,8,5,.92); }
        .fq-grid { background: linear-gradient(rgba(232,190,110,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(232,190,110,.05) 1px, transparent 1px); background-size: 48px 48px; -webkit-mask: radial-gradient(70% 70% at 50% 45%, #000, transparent); mask: radial-gradient(70% 70% at 50% 45%, #000, transparent); }
        .fq-title { background: linear-gradient(180deg, #fff7de 0%, #e8be6e 52%, #a97a30 100%); -webkit-background-clip: text; background-clip: text; color: transparent; -webkit-text-fill-color: transparent; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(232, 190, 110, 0.22); border-radius: 10px; }
        .perspective-1000 { perspective: 1000px; }
      `}</style>
      </>
   );
};
