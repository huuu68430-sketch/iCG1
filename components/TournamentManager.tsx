
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { chatService } from '../services/chatService';
import { ChatUser, GameType } from '../types';
import { TOURNAMENT_GAMES_LIST } from '../constants';
import { Trophy, Users, Play, CheckCircle2, Crown, Plus, ArrowRight, Medal, Star } from 'lucide-react';
import { FlagQuiz } from './FlagQuiz';
import { TriviaQuiz } from './TriviaQuiz';
import { BlurGuess } from './BlurGuess';
import { TypingRace } from './TypingRace';
import { CupShuffle } from './CupShuffle';
import { GridHunt } from './GridHunt';
import { Roulette } from './Roulette';
import { TerritoryWar } from './TerritoryWar';
import { TeamBattle } from './TeamBattle';
import { WordBomb } from './WordBomb';
import { MasaqilWar } from './MasaqilWar';
import { ProAvatar } from './ProAvatar';

interface TournamentManagerProps {
  channelConnected: boolean;
}

const SidebarPortal = ({ children }: { children?: React.ReactNode }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); return () => setMounted(false); }, []);
  const el = document.getElementById('game-sidebar-portal');
  if (!mounted || !el) return null;
  return createPortal(children, el);
};

export const TournamentManager: React.FC<TournamentManagerProps> = ({ channelConnected }) => {
  // Phases: LOBBY -> DRAFT -> ACTIVE -> FINALE
  const [phase, setPhase] = useState<'LOBBY' | 'DRAFT' | 'ACTIVE' | 'FINALE'>('LOBBY');
  
  // Players & Scoring
  const [participants, setParticipants] = useState<ChatUser[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  
  // Game Queue
  const [selectedGames, setSelectedGames] = useState<string[]>([]);
  const [currentGameIndex, setCurrentGameIndex] = useState(0);
  
  // Admin UI State
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [pointsToAdd, setPointsToAdd] = useState(1);

  // Refs
  const phaseRef = useRef(phase);
  const participantsRef = useRef(participants);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { participantsRef.current = participants; }, [participants]);

  // Chat Listener for LOBBY
  useEffect(() => {
    if (!channelConnected) return;
    const cleanup = chatService.onMessage((msg) => {
      if (phaseRef.current === 'LOBBY') {
         const content = msg.content.trim().toLowerCase();
         if (content === '!join' || content === '!دخول') {
             if (!participantsRef.current.find(p => p.username === msg.user.username)) {
                 setParticipants(prev => [...prev, msg.user]);
                 setScores(prev => ({ ...prev, [msg.user.username]: 0 }));
             }
         }
      }
    });
    return cleanup;
  }, [channelConnected]);

  const toggleGameSelection = (gameId: string) => {
      setSelectedGames(prev => 
         prev.includes(gameId) ? prev.filter(g => g !== gameId) : [...prev, gameId]
      );
  };

  const startTournament = () => {
      if (selectedGames.length === 0) {
          alert("الرجاء اختيار لعبة واحدة على الأقل");
          return;
      }
      setCurrentGameIndex(0);
      setPhase('ACTIVE');
  };

  const nextGame = () => {
      if (currentGameIndex + 1 >= selectedGames.length) {
          setPhase('FINALE');
      } else {
          setCurrentGameIndex(prev => prev + 1);
      }
  };

  const addPoints = () => {
      if (!selectedPlayer) return;
      setScores(prev => ({
          ...prev,
          [selectedPlayer]: (prev[selectedPlayer] || 0) + pointsToAdd
      }));
      // Visual feedback handled by state update
  };

  const resetTournament = () => {
      setParticipants([]);
      setScores({});
      setSelectedGames([]);
      setPhase('LOBBY');
  };

  const sortedScores = Object.entries(scores).sort((a, b) => (b[1] as number) - (a[1] as number));
  const activeGameId = selectedGames[currentGameIndex];
  const activeGameLabel = TOURNAMENT_GAMES_LIST.find(g => g.id === activeGameId)?.label;

  // Render the current sub-game
  const renderActiveGame = () => {
      // Add comment above fix: define shared onHome action for tournament games
      const onGameExit = () => setPhase('DRAFT');
      
      switch (activeGameId) {
          case 'GAME_TRIVIA': return <TriviaQuiz channelConnected={channelConnected} />;
          // Add comment above fix: provide missing required onHome prop
          case 'GAME_BLUR': return <BlurGuess channelConnected={channelConnected} onHome={onGameExit} />;
          // Add comment above fix: provide missing required onHome prop
          case 'GAME_FLAGS': return <FlagQuiz channelConnected={channelConnected} onHome={onGameExit} />;
          // Add comment above fix: provide missing required onHome prop
          case 'GAME_TYPING': return <TypingRace channelConnected={channelConnected} onHome={onGameExit} />;
          // Add comment above fix: provide missing required onHome prop
          case 'GAME_CUPS': return <CupShuffle channelConnected={channelConnected} onHome={onGameExit} />;
          // Add comment above fix: provide missing required onHome prop
          case 'GAME_GRID': return <GridHunt channelConnected={channelConnected} onHome={onGameExit} />;
          // Add comment above fix: provide missing required onHome prop
          case 'GAME_WHEEL': return <Roulette channelConnected={channelConnected} onHome={onGameExit} />;
          // Add comment above fix: provide missing required onHome prop
          case 'GAME_PAINT': return <TerritoryWar channelConnected={channelConnected} onHome={onGameExit} />;
          // Add comment above fix: provide missing required onHome prop
          case 'GAME_BATTLE': return <TeamBattle channelConnected={channelConnected} onHome={onGameExit} />;
          case 'GAME_BOMB': return <WordBomb channelConnected={channelConnected} />;
          case 'GAME_MASAQIL': return <MasaqilWar channelConnected={channelConnected} onHome={onGameExit} />;
          default: return <div className="text-white">Game Load Error</div>;
      }
  };

  return (
    <>
      <SidebarPortal>
         <div className="animate-in slide-in-from-right-4 space-y-4">
             {/* HEADER */}
             <div className="bg-gradient-to-r from-yellow-600 to-yellow-800 p-4 rounded-xl border border-yellow-400/30 text-white shadow-lg">
                 <div className="flex items-center gap-2 mb-1">
                     <Trophy size={16} className="text-yellow-200" />
                     <h3 className="font-black text-sm uppercase">وضع المسابقة</h3>
                 </div>
                 <div className="text-xs text-yellow-100 opacity-80 font-mono">
                     {phase === 'LOBBY' && 'مرحلة التسجيل'}
                     {phase === 'DRAFT' && 'اختيار الألعاب'}
                     {phase === 'ACTIVE' && `الجولة ${currentGameIndex + 1} / ${selectedGames.length}`}
                     {phase === 'FINALE' && 'النتائج النهائية'}
                 </div>
             </div>

             {/* ADMIN CONTROLS (Always visible in Active Phase) */}
             {phase === 'ACTIVE' && (
                 <div className="bg-[#141619] p-4 rounded-xl border border-white/5 space-y-3">
                     <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                        <Crown size={12} /> تحكم النقاط
                     </h4>
                     
                     <div className="space-y-2">
                         <select 
                            value={selectedPlayer}
                            onChange={(e) => setSelectedPlayer(e.target.value)}
                            className="w-full bg-[#0b0e0f] border border-white/10 rounded px-2 py-1.5 text-sm text-white"
                         >
                             <option value="">اختر الفائز...</option>
                             {participants.map(p => (
                                 <option key={p.username} value={p.username}>{p.username}</option>
                             ))}
                         </select>
                         
                         <div className="flex gap-2">
                             {[1, 5, 10, 20].map(amt => (
                                 <button 
                                    key={amt}
                                    onClick={() => setPointsToAdd(amt)}
                                    className={`flex-1 py-1 rounded text-xs font-bold border ${pointsToAdd === amt ? 'bg-yellow-500 text-black border-yellow-500' : 'bg-white/5 border-white/10'}`}
                                 >
                                    +{amt}
                                 </button>
                             ))}
                         </div>

                         <button 
                            onClick={addPoints}
                            disabled={!selectedPlayer}
                            className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-2 rounded-lg text-xs flex items-center justify-center gap-1 disabled:opacity-50"
                         >
                            <Plus size={14} /> إضافة نقاط
                         </button>
                     </div>

                     <div className="h-px bg-white/10 my-2"></div>

                     <button 
                        onClick={nextGame}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg text-xs flex items-center justify-center gap-2 shadow-lg"
                     >
                        {currentGameIndex + 1 === selectedGames.length ? 'إنهاء المسابقة' : 'اللعبة التالية'} 
                        <ArrowRight size={14} />
                     </button>
                 </div>
             )}

             {/* LEADERBOARD (Mini) */}
             <div className="bg-[#141619] rounded-xl border border-white/5 flex flex-col overflow-hidden h-[300px]">
                 <div className="p-3 border-b border-white/5 bg-[#0b0e0f] flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-400">الترتيب العام</span>
                    <span className="text-[10px] bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded">{participants.length} لاعب</span>
                 </div>
                 <div className="overflow-y-auto flex-1 p-2 space-y-1 custom-scrollbar">
                     {sortedScores.map(([user, score], i) => (
                         <div key={user} className={`flex justify-between px-2 py-1 rounded text-xs items-center ${i === 0 ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-white/5'}`}>
                             <div className="flex items-center gap-2">
                                 <span className={`font-mono font-bold ${i < 3 ? 'text-yellow-400' : 'text-gray-500'}`}>#{i+1}</span>
                                 <span className="text-gray-200">{user}</span>
                             </div>
                             <span className="font-mono font-black text-kick-green">{score}</span>
                         </div>
                     ))}
                 </div>
             </div>
             
             {phase !== 'ACTIVE' && (
                 <button onClick={resetTournament} className="w-full text-xs text-red-400 hover:bg-red-500/10 py-2 rounded">
                    إلغاء المسابقة
                 </button>
             )}
         </div>
      </SidebarPortal>

      <div className="w-full h-full flex flex-col relative overflow-hidden bg-[#0b0e0f]">
         
         {/* PHASE: LOBBY */}
         {phase === 'LOBBY' && (
             <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-in zoom-in">
                 <Trophy size={100} className="text-yellow-500 mb-6 drop-shadow-[0_0_30px_rgba(234,179,8,0.5)]" />
                 <h1 className="text-6xl font-black text-white mb-4">مسابقة هبلو الكبرى</h1>
                 <p className="text-2xl text-gray-400 mb-8">سجل الآن! اكتب <span className="text-yellow-400 font-bold bg-yellow-400/10 px-3 py-1 rounded mx-1">!دخول</span></p>

                 <div className="flex flex-wrap justify-center gap-3 max-w-3xl mb-12">
                     {participants.map((p, i) => (
                         <div key={i} className="animate-in scale-0 duration-300 fill-mode-forwards" style={{ animationDelay: `${i*50}ms` }}>
                             <ProAvatar username={p.username} size="w-12 h-12" className="overflow-visible" />
                             {/* The original div below is kept as it seems to be a name tag, not the avatar itself */}
                             <div className="bg-white/10 px-4 py-2 rounded-full text-sm font-bold border border-white/5 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                {p.username}
                             </div>
                         </div>
                     ))}
                 </div>

                 <button
                    onClick={() => setPhase('DRAFT')}
                    disabled={participants.length < 1}
                    className="px-10 py-4 bg-yellow-500 text-black font-black text-xl rounded-2xl hover:bg-yellow-400 hover:scale-105 transition-all shadow-[0_0_40px_rgba(234,179,8,0.4)] disabled:opacity-50 disabled:scale-100"
                 >
                    إعداد الألعاب ({participants.length})
                 </button>
             </div>
         )}

         {/* PHASE: DRAFT */}
         {phase === 'DRAFT' && (
             <div className="flex-1 flex flex-col items-center p-8 animate-in slide-in-from-right">
                 <h2 className="text-3xl font-black text-white mb-8">اختر ألعاب المسابقة</h2>

                 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 w-full max-w-5xl mb-10">
                     {TOURNAMENT_GAMES_LIST.map((game) => {
                         const isSelected = selectedGames.includes(game.id);
                         return (
                             <button
                                key={game.id}
                                onClick={() => toggleGameSelection(game.id)}
                                className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${isSelected ? 'bg-yellow-500 text-black border-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.3)] transform scale-105' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}
                             >
                                 {isSelected && <CheckCircle2 size={24} />}
                                 <span className="font-bold text-lg">{game.label}</span>
                             </button>
                         )
                     })}
                 </div>

                 <button
                    onClick={startTournament}
                    className="px-12 py-4 bg-green-600 text-white font-black text-xl rounded-2xl hover:bg-green-500 transition-all shadow-lg"
                 >
                    بدء المسابقة ({selectedGames.length} ألعاب)
                 </button>
             </div>
         )}

         {/* PHASE: ACTIVE */}
         {phase === 'ACTIVE' && (
             <div className="flex-1 relative flex flex-col">
                 {/* Top Bar for Game Context */}
                 <div className="absolute top-0 left-0 w-full h-16 bg-gradient-to-b from-black/80 to-transparent z-40 pointer-events-none flex items-center justify-center">
                     <div className="bg-yellow-500/20 backdrop-blur-md px-6 py-2 rounded-full border border-yellow-500/30 text-yellow-200 font-bold shadow-lg flex items-center gap-3">
                         <span className="bg-yellow-500 text-black text-xs font-black px-2 py-0.5 rounded">JEU {currentGameIndex + 1}</span>
                         <span>{activeGameLabel}</span>
                     </div>
                 </div>

                 {/* Render Sub-Game */}
                 <div className="flex-1 relative">
                     {renderActiveGame()}
                 </div>
             </div>
         )}

         {/* PHASE: FINALE */}
         {phase === 'FINALE' && (
             <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-in zoom-in duration-700 relative overflow-hidden">
                 {/* Background Particles */}
                 <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-yellow-900/40 via-[#0b0e0f] to-[#0b0e0f]"></div>

                 <h1 className="text-6xl font-black text-white mb-16 relative z-10 neon-text-gold">أبطال المسابقة</h1>

                 <div className="flex items-end justify-center gap-4 md:gap-12 relative z-10">
                     {/* 2nd Place */}
                     {sortedScores[1] && (
                         <div className="flex flex-col items-center animate-in slide-in-from-bottom-20 duration-1000 delay-300">
                             <div className="text-2xl font-black text-gray-400 mb-2">المركز الثاني</div>
                              <ProAvatar username={sortedScores[1][0]} size="w-32 h-32" className="mb-4 overflow-visible" />
                             <div className="text-3xl font-bold text-white">{sortedScores[1][0]}</div>
                             <div className="text-xl text-gray-400 font-mono">{sortedScores[1][1]} pts</div>
                             <div className="h-32 w-24 bg-gray-700/50 mt-4 rounded-t-lg border-t-4 border-gray-400"></div>
                         </div>
                     )}

                     {/* 1st Place */}
                     {sortedScores[0] && (
                         <div className="flex flex-col items-center animate-in slide-in-from-bottom-32 duration-1000">
                             <Crown size={64} className="text-yellow-400 mb-2 animate-bounce" />
                             <div className="text-3xl font-black text-yellow-500 mb-2">البطل</div>
                              <ProAvatar username={sortedScores[0][0]} size="w-48 h-48" className="mb-4 overflow-visible" />
                             <div className="text-5xl font-black text-white mb-1">{sortedScores[0][0]}</div>
                             <div className="text-2xl text-yellow-400 font-mono font-bold">{sortedScores[0][1]} pts</div>
                             <div className="h-48 w-32 bg-yellow-600/30 mt-4 rounded-t-lg border-t-4 border-yellow-500 relative overflow-hidden">
                                 <div className="absolute inset-0 bg-yellow-400/10 animate-pulse"></div>
                             </div>
                         </div>
                     )}

                     {/* 3rd Place (Optional if we have one) */}
                     {sortedScores[2] && (
                         <div className="flex flex-col items-center animate-in slide-in-from-bottom-16 duration-1000 delay-500 opacity-80">
                             <div className="text-xl font-black text-orange-700 mb-2">المركز الثالث</div>
                              <ProAvatar username={sortedScores[2][0]} size="w-24 h-24" className="mb-4 overflow-visible" />
                             <div className="text-2xl font-bold text-white">{sortedScores[2][0]}</div>
                             <div className="text-lg text-gray-500 font-mono">{sortedScores[2][1]} pts</div>
                             <div className="h-20 w-20 bg-orange-900/30 mt-4 rounded-t-lg border-t-4 border-orange-700"></div>
                         </div>
                     )}
                 </div>

                 <button onClick={resetTournament} className="mt-16 px-8 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-white font-bold relative z-10">
                     إنهاء والعودة
                 </button>
             </div>
         )}
      </div>
    </>
  );
};
