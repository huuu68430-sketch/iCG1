import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { chatService } from '../services/chatService';
import { leaderboardService } from '../services/supabase';
import {
   Grid, RotateCcw, Gem, Skull, Target, LogOut, Radar,
   Settings, Users, Play, Zap, Trophy, Bomb, ChevronLeft,
   Activity, BarChart3, Eye, EyeOff
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { getAssetUrl } from '../utils/assets';
import { ProAvatar } from './ProAvatar';

const tecshLogo = getAssetUrl('photo/image.png') || '';

interface GridHuntProps {
   channelConnected: boolean;
   onHome: () => void;
   isOBS?: boolean;
}

type CellType = 'EMPTY' | 'TREASURE' | 'BOMB';
type GamePhase = 'SETTINGS' | 'WAITING' | 'RULES' | 'PLAYING' | 'GAME_OVER';

interface GridCell {
   type: CellType;
   revealed: boolean;
   finder?: string;
   avatar?: string;
}

interface GameSettings {
   rows: number;
   cols: number;
   maxAttempts: number;
   entryMode: 'WAITING' | 'OPEN';
   requiredPlayers: number;
   showCellCoordinates: boolean;
}

const SidebarPortal = ({ children }: { children?: React.ReactNode }) => {
   const [mounted, setMounted] = useState(false);
   useEffect(() => { setMounted(true); return () => setMounted(false); }, []);
   const el = document.getElementById('game-sidebar-portal');
   if (!mounted || !el) return null;
   return createPortal(children, el);
};

export const GridHunt: React.FC<GridHuntProps> = ({ channelConnected, onHome, isOBS }) => {
   const [phase, setPhase] = useState<GamePhase>('SETTINGS');
   const [settings, setSettings] = useState<GameSettings>({
      rows: 10,
      cols: 10,
      maxAttempts: 2,
      entryMode: 'OPEN',
      requiredPlayers: 5,
      showCellCoordinates: true
   });

   const [grid, setGrid] = useState<GridCell[]>([]);
   const [joinedPlayers, setJoinedPlayers] = useState<{ name: string, avatar?: string }[]>([]);
   const [winner, setWinner] = useState<{ name: string, avatar?: string } | null>(null);
   const [scoreBoard, setScoreBoard] = useState<{ name: string, score: number, avatar?: string, attempts: number }[]>([]);
   const [lastAction, setLastAction] = useState<{ text: string, type: 'good' | 'bad' | 'neutral' } | null>(null);
   const [hoveredCell, setHoveredCell] = useState<{ r: number, c: number } | null>(null);
   const [bookingNumber, setBookingNumber] = useState<string>('');
   const [showBookingNumber, setShowBookingNumber] = useState(false);

   const phaseRef = useRef(phase);
   const gridRef = useRef(grid);
   const settingsRef = useRef(settings);
   const scoreBoardRef = useRef(scoreBoard);

   useEffect(() => { phaseRef.current = phase; }, [phase]);
   useEffect(() => { gridRef.current = grid; }, [grid]);
   useEffect(() => { settingsRef.current = settings; }, [settings]);
   useEffect(() => { scoreBoardRef.current = scoreBoard; }, [scoreBoard]);

   const initializeGame = () => {
      const totalCells = settings.rows * settings.cols;
      let newGrid: GridCell[] = Array(totalCells).fill(null).map(() => ({ type: 'BOMB', revealed: false }));
      const winnerIdx = Math.floor(Math.random() * totalCells);
      newGrid[winnerIdx] = { type: 'TREASURE', revealed: false };

      const COL_LABELS = Array.from({ length: settings.cols }, (_, i) => String.fromCharCode(65 + i));
      const ROW_LABELS = Array.from({ length: settings.rows }, (_, i) => i + 1);

      const col = COL_LABELS[winnerIdx % settings.cols];
      const row = ROW_LABELS[Math.floor(winnerIdx / settings.cols)];

      setGrid(newGrid);
      setWinner(null);
      setScoreBoard([]);
      setJoinedPlayers([]);
      setLastAction(null);
      setBookingNumber(`${col}${row}`);
      setShowBookingNumber(false);
      setPhase('RULES');
   };

   const startActualGame = () => {
      setPhase(settings.entryMode === 'WAITING' ? 'WAITING' : 'PLAYING');
   };

   useEffect(() => {
      if (!channelConnected) return;

      const cleanup = chatService.onMessage(async (msg) => {
         const content = msg.content.trim().toUpperCase();
         const currentPhase = phaseRef.current;
         const currentSettings = settingsRef.current;
         const currentScores = scoreBoardRef.current;

         if (currentPhase === 'WAITING' && content === 'انضمام') {
            setJoinedPlayers(prev => {
               if (prev.find(p => p.name === msg.user.username)) return prev;
               const newList = [...prev, { name: msg.user.username, avatar: msg.user.avatar }];
               if (newList.length >= currentSettings.requiredPlayers) {
                  setTimeout(() => setPhase('PLAYING'), 2000);
               }
               return newList;
            });
            return;
         }

         if (currentPhase !== 'PLAYING') return;

         const match = content.match(/^([A-Z])\s*(\d+)$/);
         if (match) {
            const colChar = match[1];
            const rowNum = parseInt(match[2]);
            const colIndex = colChar.charCodeAt(0) - 65;
            const rowIndex = rowNum - 1;

            if (colIndex < 0 || colIndex >= currentSettings.cols || rowIndex < 0 || rowIndex >= currentSettings.rows) return;

            const userStats = currentScores.find(p => p.name === msg.user.username);
            if (currentSettings.maxAttempts > 0 && userStats && userStats.attempts >= currentSettings.maxAttempts) return;

            const flatIndex = rowIndex * currentSettings.cols + colIndex;
            const currentGrid = [...gridRef.current];

            if (!currentGrid[flatIndex].revealed) {
               currentGrid[flatIndex] = {
                  ...currentGrid[flatIndex],
                  revealed: true,
                  finder: msg.user.username,
                  avatar: msg.user.avatar
               };

               setGrid(currentGrid);
               updateUserStats(msg.user.username, msg.user.avatar, 1);

               if (currentGrid[flatIndex].type === 'TREASURE') {
                  setLastAction({ text: `🏆 تم العثور على الماوس باد بواسطة ${msg.user.username}!`, type: 'good' });
                  setWinner({ name: msg.user.username, avatar: msg.user.avatar });
                  triggerConfetti(window.innerWidth / 2, window.innerHeight / 2, ['#ff0000', '#ffd700'], 150);
                  setPhase('GAME_OVER');
                  await leaderboardService.recordWin(msg.user.username, msg.user.avatar || '', 500);
               } else {
                  setLastAction({ text: `💥 انفجار! ${msg.user.username} اختار لغماً!`, type: 'bad' });
                  const rect = document.getElementById(`cell-${flatIndex}`)?.getBoundingClientRect();
                  if (rect) triggerConfetti(rect.x + rect.width / 2, rect.y + rect.height / 2, ['#ef4444', '#000000'], 15);
               }
            }
         }
      });
      return cleanup;
   }, [channelConnected]);

   const triggerConfetti = (x: number, y: number, colors: string[], count: number = 40) => {
      confetti({
         particleCount: count,
         spread: 60,
         origin: { x: x / window.innerWidth, y: y / window.innerHeight },
         colors
      });
   };

   const updateUserStats = (name: string, avatar: string | undefined, attempts: number) => {
      setScoreBoard(prev => {
         const exists = prev.find(p => p.name === name);
         if (exists) {
            return prev.map(p => p.name === name ? { ...p, attempts: p.attempts + attempts } : p);
         }
         return [...prev, { name, score: 0, avatar, attempts }];
      });
   };

   const COL_LABELS = Array.from({ length: settings.cols }, (_, i) => String.fromCharCode(65 + i));
   const ROW_LABELS = Array.from({ length: settings.rows }, (_, i) => i + 1);

   if (phase === 'SETTINGS') {
      return (
         <div className="w-full h-full flex items-center justify-center p-6 bg-transparent overflow-y-auto custom-scrollbar">
             <div className="max-w-md w-full flex flex-col gap-4 animate-in zoom-in duration-700">
                {/* Compact Header */}
                <div className="bg-zinc-900/60 p-5 rounded-[1.5rem] border border-white/5 text-center space-y-3">
                   <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center shadow-lg mx-auto mb-2 border border-white/10 group overflow-hidden">
                      <img src={tecshLogo} className="w-14 h-14 object-contain group-hover:scale-110 transition-transform duration-500" alt="TECSH Logo" />
                   </div>
                   <h2 className="text-2xl font-black italic text-white red-neon-text tracking-tighter">صائد الماوس باد</h2>
                  <p className="text-[10px] text-white/30 font-bold uppercase tracking-[0.2em] italic">TECSH • ONE WINNER • ONE TARGET</p>
               </div>

                {/* Central Settings Panel */}
                <div className="bg-zinc-900/90 backdrop-blur-3xl p-5 rounded-[1.5rem] border-2 border-white/10 shadow-2xl space-y-4">
                  <div className="space-y-4">
                     <div className="space-y-3">
                        <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest pl-2 italic">حجم الخريطة (GRID SIZE)</label>
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                           {[10, 15, 20, 25].map(size => (
                              <button
                                 key={size}
                                 onClick={() => setSettings({ ...settings, rows: size, cols: size })}
                                 className={`py-3 rounded-xl border-2 transition-all font-black text-[12px] ${settings.rows === size ? 'bg-red-600 border-red-400 text-white shadow-xl scale-105' : 'bg-black/40 border-white/5 text-gray-500 hover:border-red-500/30'}`}
                              >
                                 {size}x{size}
                              </button>
                           ))}
                           <button
                              onClick={() => setSettings({ ...settings, rows: 5, cols: 5 })}
                              className={`py-3 rounded-xl border-2 transition-all font-black text-[12px] ${settings.rows === 5 ? 'bg-red-600 border-red-400 text-white shadow-xl scale-105' : 'bg-black/40 border-white/5 text-gray-500 hover:border-red-500/30'}`}
                           >
                              5x5 (Mini)
                           </button>
                        </div>
                     </div>

                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest pl-2 italic">أقصى محاولات</label>
                            <input type="number" value={settings.maxAttempts} onChange={e => setSettings({ ...settings, maxAttempts: Number(e.target.value) })} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white font-black text-center text-base outline-none focus:border-red-500" />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest pl-2 italic">إظهار الإحداثيات</label>
                           <button
                              onClick={() => setSettings({ ...settings, showCellCoordinates: !settings.showCellCoordinates })}
                              className={`w-full py-3 rounded-xl border-2 transition-all font-black text-[10px] flex items-center justify-center gap-2 ${settings.showCellCoordinates ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400' : 'bg-black/40 border-white/5 text-gray-500'}`}
                           >
                              {settings.showCellCoordinates ? <Eye size={14} /> : <EyeOff size={14} />}
                              {settings.showCellCoordinates ? 'مفعل' : 'معطل'}
                           </button>
                        </div>
                     </div>
                  </div>

                   <div className="flex gap-3 pt-3 border-t border-white/5">
                      <button onClick={onHome} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-white transition-all"><ChevronLeft size={20} /></button>
                      <button onClick={initializeGame} className="flex-1 bg-red-600 hover:bg-red-500 py-3 rounded-xl font-black text-white italic text-base shadow-xl uppercase transition-all flex items-center justify-center gap-2">
                         <Play size={16} fill="currentColor" /> ابدأ العملية
                     </button>
                  </div>
               </div>
            </div>
         </div>
      );
   }

   if (phase === 'RULES') {
      return (
         <div className="w-full h-full flex items-center justify-center p-6 bg-transparent overflow-y-auto custom-scrollbar">
             <div className="glass-card p-4 md:p-5 rounded-[2rem] border-2 border-red-600/30 w-full max-w-2xl text-center shadow-[0_0_100px_rgba(255,0,0,0.3)] backdrop-blur-3xl bg-black/95 relative overflow-hidden animate-in zoom-in duration-700">
               <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/10 blur-[100px] rounded-full pointer-events-none"></div>
               <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-600/10 blur-[100px] rounded-full pointer-events-none"></div>

               <div className="mb-8 relative z-10">
                   <div className="w-12 h-12 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-red-500/50 animate-pulse">
                      <Target size={24} className="text-red-500" />
                   </div>
                   <h2 className="text-xl md:text-3xl font-black text-white italic mb-3 tracking-tighter uppercase red-neon-text">تعليمات الميدان 🗺️</h2>
                  <div className="h-1 w-24 bg-gradient-to-r from-transparent via-red-600 to-transparent mx-auto rounded-full"></div>
               </div>

               <div className="space-y-3 text-right mb-6 relative z-10">
                  <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/10 flex flex-col md:flex-row items-center md:items-start gap-4 hover:bg-white/10 transition-all duration-300 group shadow-lg">
                     <div className="p-3 bg-red-600/20 rounded-2xl group-hover:bg-red-600 transition-colors shadow-xl shrink-0">
                        <Zap size={20} className="text-red-500 group-hover:text-white" />
                     </div>
                     <div className="text-center md:text-right">
                        <h3 className="text-base md:text-lg font-black text-white mb-2 italic">حروف عادية ومرونة! 🔠</h3>
                        <p className="text-gray-400 font-bold leading-relaxed text-xs md:text-sm">مو شرط تكتب الحرف كابيتال (Capital)، تقدر تكتب الإحداثيات بحروف صغيرة أو مع مسافة عادي جداً! مثلاً (a1 أو A 1 أو a 1) كلها مقبولة وتحسب لك وتسهل سرعتك.</p>
                     </div>
                  </div>

                   <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/10 flex flex-col md:flex-row items-center md:items-start gap-4 hover:bg-white/10 transition-all duration-300 group shadow-lg">
                     <div className="p-3 bg-yellow-500/20 rounded-2xl group-hover:bg-yellow-500 transition-colors shadow-xl shrink-0">
                        <Target size={20} className="text-yellow-500 group-hover:text-white" />
                     </div>
                     <div className="text-center md:text-right">
                        <h3 className="text-base md:text-lg font-black text-white mb-2 italic">ركز في محاولاتك 🎯</h3>
                        <p className="text-gray-400 font-bold leading-relaxed text-xs md:text-sm">تذكر أن عدد محاولاتك {settings.maxAttempts ? 'محدود بـ ' + settings.maxAttempts + ' محاولات' : 'محدود'}، ركز زين واختر الإحداثيات بعناية عشان ما تضيع بطاقاتك بالفوز!</p>
                     </div>
                  </div>

                   <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/10 flex flex-col md:flex-row items-center md:items-start gap-4 hover:bg-white/10 transition-all duration-300 group shadow-lg">
                     <div className="p-3 bg-blue-500/20 rounded-2xl group-hover:bg-blue-500 transition-colors shadow-xl shrink-0">
                        <Bomb size={20} className="text-blue-500 group-hover:text-white" />
                     </div>
                     <div className="text-center md:text-right">
                        <h3 className="text-base md:text-lg font-black text-white mb-2 italic">احذر الألغام 💣</h3>
                        <p className="text-gray-400 font-bold leading-relaxed text-xs md:text-sm">هدفك الوحيد في هذا الميدان هو إيجاد الماوس باد، وإذا اخترت خيار خطأ بيطلع لك لغم! السرعة والدقة هم سلاحك.</p>
                     </div>
                  </div>
               </div>

               <div className="relative z-10 w-full flex justify-center">
                   <button onClick={startActualGame} className="w-full max-w-sm bg-red-600 text-white hover:bg-red-500 font-black py-3 px-5 rounded-full text-base shadow-[0_10px_30px_rgba(220,38,38,0.4)] hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3 group italic border-2 border-transparent hover:border-white/20">
                      موافق، انطلق! <Play size={20} className="group-hover:translate-x-2 transition-transform duration-300" fill="currentColor" />
                  </button>
               </div>
            </div>
         </div>
      );
   }

   if (phase === 'WAITING') {
      return (
         <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-transparent animate-in zoom-in duration-1000">
            <div className="text-center space-y-8 max-w-2xl w-full bg-zinc-900/60 p-12 rounded-[3.5rem] border border-white/5 backdrop-blur-3xl shadow-2xl">
               <Users size={60} className="text-white mx-auto animate-bounce" />
               <div className="space-y-2">
                  <h2 className="text-5xl font-black italic text-white red-neon-text tracking-tighter">بانتظار الأبطال</h2>
                  <p className="text-lg text-white/40 font-bold">اكتب <span className="text-white px-4 py-1 bg-red-600 rounded-lg shadow-lg">انضمام</span> في الدردشة</p>
               </div>
               <div className="grid grid-cols-4 md:grid-cols-6 gap-3 justify-center max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
                  {joinedPlayers.map((p, i) => (
                     <div key={i} className="animate-in zoom-in p-1" style={{ animationDelay: `${i * 30}ms` }}>
                         <ProAvatar url={p.avatar} username={p.name} size="w-24 h-24" className="mx-auto overflow-visible" />
                     </div>
                  ))}
               </div>
               <button onClick={() => setPhase('SETTINGS')} className="text-white/20 hover:text-white/50 transition-all font-black uppercase text-[10px] flex items-center gap-2 mx-auto pt-4 italic"><ChevronLeft size={16} /> العودة</button>
            </div>
         </div>
      );
   }

   return (
      <>
         <SidebarPortal>
            <div className="h-full flex flex-col p-4 space-y-4">
               {lastAction && (
                  <div className={`p-4 rounded-xl text-[10px] font-black text-center border shadow-xl animate-in slide-in-from-top duration-300 ${lastAction.type === 'good' ? 'bg-blue-600/10 border-blue-500/30 text-blue-400' : 'bg-red-600/10 border-red-500/30 text-red-400'}`}>{lastAction.text}</div>
               )}
               <div className="bg-black/30 rounded-[2rem] border border-white/5 flex flex-col flex-1 shadow-2xl">
                  <div className="p-4 border-b border-white/5 bg-white/5 flex justify-between items-center text-[9px] font-black italic uppercase tracking-widest text-white/40">
                     <span className="flex items-center gap-2"><BarChart3 size={12} className="text-red-500" /> نشاط الفريق</span>
                     <span>LIVE RADAR</span>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1.5">
                     {scoreBoard.sort((a, b) => b.attempts - a.attempts).map((p, i) => (
                        <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/5">
                           <div className="flex items-center gap-3">
                              <ProAvatar url={p.avatar} username={p.name} size="w-14 h-14" className="overflow-visible" />
                              <span className="text-[9px] font-bold text-gray-400 truncate max-w-[100px]">{p.name}</span>
                           </div>
                           <div className={`text-[9px] font-mono font-black border px-2 py-0.5 rounded-lg ${p.attempts >= settings.maxAttempts ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-white/5 text-gray-600'}`}>{p.attempts}/{settings.maxAttempts || '∞'}</div>
                        </div>
                     ))}
                  </div>
               </div>
               <button onClick={() => setPhase('SETTINGS')} className="w-full bg-white/5 hover:bg-white/10 py-3 rounded-xl font-black text-white text-[9px] transition-all border border-white/5 italic flex items-center justify-center gap-2 uppercase tracking-widest"><RotateCcw size={14} /> إعادة التوجيه</button>
            </div>
         </SidebarPortal>

         <div className="w-full h-full flex flex-col items-center justify-center p-2 relative select-none animate-in fade-in duration-500 overflow-hidden">
            {/* Booking Number Display */}
            {phase !== 'SETTINGS' && (
               <div className="absolute top-6 left-6 z-50 flex flex-col items-start gap-2 animate-in slide-in-from-left duration-700">
                  <div className="bg-zinc-900/80 backdrop-blur-3xl border-2 border-white/10 p-5 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col items-center gap-2 min-w-[140px] group hover:border-white/20 transition-all duration-500">
                     <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
                        <span className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em] italic">رقم الحجز</span>
                     </div>
                     <div className={`text-3xl font-black italic tracking-tighter text-white transition-all duration-700 ease-out ${!showBookingNumber ? 'blur-[18px] scale-95 opacity-50 select-none pointer-events-none' : 'blur-0 scale-100 opacity-100'}`}>
                        {bookingNumber || '------'}
                     </div>
                     <button 
                        onClick={() => setShowBookingNumber(!showBookingNumber)}
                        className="mt-2 w-full px-4 py-2 bg-white/5 hover:bg-red-600 rounded-xl text-[10px] font-black text-white transition-all duration-300 border border-white/5 flex items-center justify-center gap-2 shadow-lg"
                     >
                        {showBookingNumber ? <EyeOff size={14} /> : <Eye size={14} />}
                        {showBookingNumber ? 'إخفاء' : 'رؤية الرقم'}
                     </button>
                  </div>
               </div>
            )}

            {/* Radar Effect */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>

            <div className="relative z-10 flex flex-col items-center scale-75 md:scale-90 lg:scale-100 transition-transform">

               {/* Dashboard Header */}
               <div className="flex items-center gap-6 mb-6 bg-zinc-900/40 backdrop-blur-xl px-8 py-4 rounded-[2rem] border border-white/10 shadow-xl">
                  <div className="flex items-center gap-3">
                     <Skull size={18} className="text-red-500" />
                     <div className="text-[8px] text-gray-500 font-black uppercase tracking-widest leading-none">ميدان الألغام</div>
                     <div className="text-xl font-black text-white italic">{settings.rows * settings.cols - 1}</div>
                  </div>
                  <div className="w-px h-6 bg-white/10"></div>
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-6 bg-zinc-900 border border-white/20 rounded-sm shadow-[0_4px_10px_rgba(0,0,0,0.5)] relative overflow-hidden flex items-center justify-center">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/30 to-blue-900/40"></div>
                        <div className="absolute bottom-0.5 right-0.5 w-2 h-2">
                           <img src={tecshLogo} className="w-full h-full object-contain opacity-80" alt="logo" />
                        </div>
                     </div>
                     <div className="text-[8px] text-gray-500 font-black uppercase tracking-widest leading-none">الهدف</div>
                     <div className="text-xl font-black text-white italic">{winner ? '0' : '1'}</div>
                  </div>
               </div>

               <div className="relative bg-zinc-950/80 p-6 md:p-8 rounded-[3rem] border-4 border-white/5 shadow-[0_40px_100px_rgba(0,0,0,0.8)]">

                  {/* Unified Grid with Labels */}
                  <div className={`grid gap-1 md:gap-1.5 relative`} style={{
                     gridTemplateColumns: `35px repeat(${settings.cols}, ${settings.cols > 15 || isOBS ? '25px' : '40px'})`,
                     gridTemplateRows: `35px repeat(${settings.rows}, ${settings.cols > 15 || isOBS ? '25px' : '40px'})`
                  }}>
                     {/* Scanner Highlights */}
                     {hoveredCell && (
                        <>
                           <div
                              className="absolute bg-white/5 pointer-events-none z-0 transition-all duration-150"
                              style={{
                                 top: 35 + hoveredCell.r * (settings.cols > 15 || isOBS ? 25 + 4 : 40 + 4), // Approximate gap
                                 left: 35,
                                 right: 0,
                                 height: (settings.cols > 15 || isOBS ? 25 : 40),
                                 borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                                 borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                              }}
                           />
                           <div
                              className="absolute bg-white/5 pointer-events-none z-0 transition-all duration-150"
                              style={{
                                 left: 35 + hoveredCell.c * (settings.cols > 15 || isOBS ? 25 + 4 : 40 + 4),
                                 top: 35,
                                 bottom: 0,
                                 width: (settings.cols > 15 || isOBS ? 25 : 40),
                                 borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
                                 borderRight: '1px solid rgba(255, 255, 255, 0.1)',
                              }}
                           />
                        </>
                     )}

                     {/* Corner */}
                     <div className="flex items-center justify-center opacity-10"><Target size={14} className="text-white" /></div>

                     {/* Column Labels (A-Z) */}
                     {COL_LABELS.map((c, i) => (
                        <div
                           key={c}
                           className={`flex items-center justify-center font-black text-sm md:text-xl italic transition-all duration-300 rounded-lg ${hoveredCell?.c === i ? 'bg-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.8)] scale-110' : 'text-red-500/90 drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]'}`}
                        >
                           {c}
                        </div>
                     ))}

                     {/* Rows (Label + Cells) */}
                     {ROW_LABELS.map((r, rIdx) => (
                        <React.Fragment key={r}>
                           {/* Row Label */}
                           <div
                              className={`flex items-center justify-center font-black text-sm md:text-xl italic transition-all duration-300 rounded-lg ${hoveredCell?.r === rIdx ? 'bg-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.8)] scale-110' : 'text-red-500/90 drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]'}`}
                           >
                              {r}
                           </div>

                           {/* Grid Cells for this row */}
                           {COL_LABELS.map((c, cIdx) => {
                              const idx = rIdx * settings.cols + cIdx;
                              const cell = grid[idx];
                              const isRevealed = cell?.revealed;
                              const coord = `${c}${r}`;

                              return (
                                 <div
                                    id={`cell-${idx}`}
                                    key={idx}
                                    onMouseEnter={() => setHoveredCell({ r: rIdx, c: cIdx })}
                                    onMouseLeave={() => setHoveredCell(null)}
                                    className={`
                           rounded-lg border-[1px] md:border-2 flex items-center justify-center transition-all duration-500 relative overflow-visible group z-10
                           ${!isRevealed ? 'bg-[#05070a] border-white/5 hover:border-red-500 hover:bg-zinc-900 cursor-crosshair' : 'border-transparent'}
                           ${isRevealed && cell.type === 'TREASURE' ? 'bg-gradient-to-br from-blue-700/80 to-blue-950 shadow-lg' : ''}
                           ${isRevealed && cell.type === 'BOMB' ? 'bg-gradient-to-br from-red-600 to-red-950 opacity-80' : ''}
                         `}
                                 >
                                    {!isRevealed && (
                                       settings.showCellCoordinates ? (
                                          <span className={`text-[12px] md:text-[18px] font-black transition-all uppercase italic pointer-events-none drop-shadow-[0_2px_10px_rgba(0,0,0,1)] ${hoveredCell?.r === rIdx && hoveredCell?.c === cIdx ? 'text-white scale-[1.7] z-20 brightness-150' : 'text-white/60 group-hover:text-red-500'}`}>{coord}</span>
                                       ) : (
                                          <div className="w-1 h-1 rounded-full bg-white/5 group-hover:bg-red-500/20 transition-all"></div>
                                       )
                                    )}
                                    {isRevealed && (
                                        <div className="animate-in zoom-in spin-in-180 duration-500 p-1 md:p-2 w-full h-full flex items-center justify-center">
                                           {cell.type === 'TREASURE' && (
                                              <div className="relative w-full h-full flex items-center justify-center">
                                                 <div className="absolute inset-0 z-0">
                                                    <ProAvatar username={cell.finder || ''} size="w-full h-full" className="overflow-visible" />
                                                 </div>
                                                 <div className="w-10/12 h-6/12 bg-zinc-900/80 border border-white/20 rounded-sm shadow-inner relative z-10 overflow-hidden group/m">
                                                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-blue-900/40"></div>
                                                    <div className="absolute bottom-0.5 right-0.5 w-3 h-3 md:w-4 md:h-4 group-hover/m:scale-110 transition-transform">
                                                       <img src={tecshLogo} className="w-full h-full object-contain opacity-70" alt="logo" />
                                                    </div>
                                                 </div>
                                              </div>
                                           )}
                                           {cell.type === 'BOMB' && (
                                              <div className="relative w-full h-full flex items-center justify-center">
                                                 <div className="absolute inset-0 z-0 opacity-60">
                                                    <ProAvatar username={cell.finder || ''} size="w-full h-full" className="overflow-visible" />
                                                 </div>
                                                 <Skull size={14} className="text-white relative z-10 drop-shadow-md" />
                                              </div>
                                           )}
                                        </div>
                                     )}
                                    {isRevealed && cell.finder && cell.type === 'TREASURE' && (
                                       <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-end justify-center pb-0.5">
                                          <span className="text-[6px] font-black text-white truncate px-1 uppercase italic tracking-tighter">{cell.finder}</span>
                                       </div>
                                    )}
                                 </div>
                              );
                           })}
                        </React.Fragment>
                     ))}
                  </div>
               </div>
            </div>

            {/* Legend */}
            <div className="mt-8 flex gap-6 opacity-30 group hover:opacity-100 transition-opacity">
               <div className="flex items-center gap-2 text-[9px] font-black text-white italic uppercase tracking-[0.2em]">
                  <div className="w-5 h-3 bg-zinc-900 border border-white/20 rounded-sm relative overflow-hidden">
                     <div className="absolute inset-0 bg-blue-500/40"></div>
                     <div className="absolute bottom-[1px] right-[1px] w-1.5 h-1.5">
                        <img src={tecshLogo} className="w-full h-full object-contain" alt="logo" />
                     </div>
                  </div>
                  الماوس باد
               </div>
               <div className="flex items-center gap-2 text-[9px] font-black text-white italic uppercase tracking-[0.2em]"><div className="w-2.5 h-2.5 rounded-full bg-red-600" /> لـغـم</div>
            </div>

            {/* Winner Overlay */}
            {phase === 'GAME_OVER' && winner && (
               <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/95 backdrop-blur-3xl animate-in fade-in duration-1000 p-8">
                  {/* Big decorative glow */}
                  <div className="absolute inset-0 pointer-events-none">
                     <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gradient-to-br from-blue-600/10 via-red-600/10 to-purple-600/10 blur-[150px] rounded-full" />
                  </div>

                  <div className="text-center space-y-2 mb-6 relative z-10">
                     <h3 className="text-5xl md:text-8xl font-black italic text-white red-neon-text uppercase leading-tight">مبروكككككك</h3>
                     <p className="text-xl md:text-3xl font-black italic text-red-500 tracking-tighter animate-bounce">فزت معنا بماوس باد من تيكش</p>
                  </div>

                  {/* Shield/Emblem */}
                  <div className="relative mb-6 z-10">
                     <div className="absolute -inset-16 bg-gradient-to-br from-blue-600/20 via-yellow-500/10 to-red-600/20 blur-[80px] animate-pulse rounded-full" />
                     <div className="relative w-72 h-80 md:w-80 md:h-96">
                        <svg viewBox="0 0 200 240" className="absolute inset-0 w-full h-full drop-shadow-[0_0_60px_rgba(59,130,246,0.3)]">
                           <defs>
                              <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                                 <stop offset="0%" stopColor="#1e3a5f" />
                                 <stop offset="50%" stopColor="#0f172a" />
                                 <stop offset="100%" stopColor="#1e293b" />
                              </linearGradient>
                              <linearGradient id="shieldBorder" x1="0%" y1="0%" x2="100%" y2="100%">
                                 <stop offset="0%" stopColor="#60a5fa" />
                                 <stop offset="50%" stopColor="#f59e0b" />
                                 <stop offset="100%" stopColor="#ef4444" />
                              </linearGradient>
                              <filter id="shieldGlow">
                                 <feGaussianBlur stdDeviation="3" result="blur" />
                                 <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                              </filter>
                           </defs>
                           {/* Outer shield border */}
                           <path d="M100 5 L195 40 L195 130 Q195 190 100 235 Q5 190 5 130 L5 40 Z" fill="url(#shieldBorder)" opacity="0.9" filter="url(#shieldGlow)" />
                           {/* Inner shield */}
                           <path d="M100 15 L180 48 L180 128 Q180 180 100 220 Q20 180 20 128 L20 48 Z" fill="url(#shieldGrad)" />
                           {/* Highlight lines */}
                           <path d="M100 20 L175 50 L175 125 Q175 175 100 212 Q25 175 25 125 L25 50 Z" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                           {/* Crown on top */}
                           <text x="100" y="32" textAnchor="middle" fontSize="22" fill="#fbbf24" filter="url(#shieldGlow)">👑</text>
                           {/* Avatar bg */}
                           <rect x="55" y="50" width="90" height="90" rx="14" fill="rgba(0,0,0,0.6)" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />
                           {/* Winner name under avatar */}
                           <text x="100" y="160" textAnchor="middle" fontSize="11" fontWeight="900" fill="white" fontFamily="sans-serif" fontStyle="italic" letterSpacing="0.5">{winner.name}</text>
                           {/* TECSH badge at bottom */}
                           <circle cx="100" cy="212" r="14" fill="#18181b" stroke="#f59e0b" strokeWidth="2" opacity="0.9" />
                           <image href={tecshLogo} x="88" y="200" width="24" height="24" />
                        </svg>
                        {/* ProAvatar overlay exact on the dark rect */}
                        <div className="absolute flex items-center justify-center" style={{ left: '27.5%', top: '20.83%', width: '45%', height: '37.5%' }}>
                           <ProAvatar url={winner.avatar} username={winner.name} size="w-32 h-32 md:w-[140px] md:h-[140px]" className="overflow-visible" />
                        </div>
                     </div>
                  </div>

                  {/* Treasure Location Box */}
                  <div className="flex flex-col items-center gap-2 mb-6 animate-in zoom-in duration-1000 delay-500 z-10">
                     <div className="text-[10px] text-white/30 font-black uppercase tracking-[0.3em] italic">موقع الجائزة (PRIZE LOCATION)</div>
                     <div className="flex items-center gap-4 bg-zinc-900/80 px-6 py-3 rounded-[1.5rem] border border-blue-500/40 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
                        <Target size={20} className="text-blue-500 animate-spin-slow" />
                        <span className="text-3xl font-black text-white italic tracking-tighter drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
                           {(() => {
                              const treasureIdx = grid.findIndex(c => c.type === 'TREASURE');
                              if (treasureIdx === -1) return '??';
                              const col = COL_LABELS[treasureIdx % settings.cols];
                              const row = ROW_LABELS[Math.floor(treasureIdx / settings.cols)];
                              return `${col}${row}`;
                           })()}
                        </span>
                     </div>
                  </div>

                  <button onClick={() => setPhase('SETTINGS')} className="mt-4 text-white/20 hover:text-white font-black text-lg italic tracking-[0.4em] transition-all flex items-center gap-4 group hover:scale-110 active:scale-95 z-10"><RotateCcw className="group-hover:rotate-180 transition-transform duration-1000" size={24} /> إعادة التعيين</button>
               </div>
            )}
         </div>


         <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(232, 190, 110, 0.28); border-radius: 99px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(232, 190, 110, 0.5); }
        .red-neon-text { text-shadow: 0 0 20px rgba(239,68,68,0.5), 0 0 40px rgba(239,68,68,0.2); }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
      `}</style>
      </>
   );
};
