import React, { useState, useEffect, useRef } from 'react';
import { chatService } from '../services/chatService';
import { leaderboardService } from '../services/supabase';
import { ChatUser } from '../types';
import { Globe, Play, Trophy, MapPin, Search, Check, X, AlertCircle } from 'lucide-react';
import { ProAvatar } from './ProAvatar';
import { motion, AnimatePresence } from 'framer-motion';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import { COUNTRIES, CountryData } from '../data/countries';

const geoUrl = "https://unpkg.com/world-atlas@2.0.2/countries-110m.json";

const MapValidator = ({ geographies, targetCountry, onNotFound }: { geographies: any[], targetCountry: CountryData | null, onNotFound: () => void }) => {
  useEffect(() => {
    if (!targetCountry || geographies.length === 0) return;
    const found = geographies.some(geo => {
      const isIsrael = targetCountry.nameEn === 'Palestine' && geo.properties?.name === 'Israel';
      const isEswatini = targetCountry.nameEn === 'Eswatini' && geo.properties?.name === 'Swaziland';
      return geo.properties?.name === targetCountry.nameEn || isIsrael || isEswatini;
    });
    if (!found) onNotFound();
  }, [targetCountry?.id, geographies.length]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
};

interface MapGuesserProps {
  onHome: () => void;
  isOBS?: boolean;
}

interface PlayerGuess {
  id: string;
  user: ChatUser;
  guess: string;
  isWinner: boolean;
  timestamp: number;
}

export const MapGuesser: React.FC<MapGuesserProps> = ({ onHome, isOBS }) => {
  const [phase, setPhase] = useState<'SETUP' | 'PLAYING'>('SETUP');
  const [targetCountry, setTargetCountry] = useState<CountryData | null>(null);
  const [winner, setWinner] = useState<PlayerGuess | null>(null);
  
  // Hints
  const [showContinentHint, setShowContinentHint] = useState(false);
  const [showLetterHint, setShowLetterHint] = useState(false);
  const [showCapitalHint, setShowCapitalHint] = useState(false);
  const [showFullMap, setShowFullMap] = useState(false);

  // Settings
  const [roundsToPlay, setRoundsToPlay] = useState(1);
  const [currentRound, setCurrentRound] = useState(1);
  const [difficulty, setDifficulty] = useState<'EASY' | 'MEDIUM' | 'HARD'>('HARD');
  const [skippedMessage, setSkippedMessage] = useState<string | null>(null);

  // Tracks every country already used, per difficulty, so they never repeat
  // while playing. Persists across separate games until that pool is exhausted.
  const playedRef = useRef<Record<'EASY' | 'MEDIUM' | 'HARD', Set<string>>>({
    EASY: new Set(),
    MEDIUM: new Set(),
    HARD: new Set()
  });

  const difficultyCounts = {
    EASY: COUNTRIES.filter(c => c.difficulty === 'EASY').length,
    MEDIUM: COUNTRIES.filter(c => c.difficulty === 'MEDIUM' || c.difficulty === 'HARD').length,
    HARD: COUNTRIES.filter(c => c.difficulty === 'HARD').length
  };

  const getDifficultyPool = (diff: 'EASY' | 'MEDIUM' | 'HARD') => {
    if (diff === 'EASY') return COUNTRIES.filter(c => c.difficulty === 'EASY');
    if (diff === 'HARD') return COUNTRIES.filter(c => c.difficulty === 'HARD');
    return COUNTRIES.filter(c => c.difficulty === 'MEDIUM' || c.difficulty === 'HARD');
  };

  // Daily Hints Tracking
  const [hintUsage, setHintUsage] = useState(() => {
    try {
      const stored = localStorage.getItem('map_hints_usage');
      const today = new Date().toISOString().split('T')[0];
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.date === today) return parsed;
      }
      return { date: today, continent: false, letter: false, capital: false, fullMap: false };
    } catch {
      return { date: new Date().toISOString().split('T')[0], continent: false, letter: false, capital: false, fullMap: false };
    }
  });

  const useHint = (type: 'continent' | 'letter' | 'capital' | 'fullMap') => {
    setHintUsage((prev: any) => {
      const next = { ...prev, [type]: true };
      localStorage.setItem('map_hints_usage', JSON.stringify(next));
      return next;
    });
    if (type === 'continent') setShowContinentHint(true);
    if (type === 'letter') setShowLetterHint(true);
    if (type === 'capital') setShowCapitalHint(true);
    if (type === 'fullMap') setShowFullMap(true);
  };

  const phaseRef = useRef(phase);
  const targetCountryRef = useRef(targetCountry);
  const winnerRef = useRef(winner);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { targetCountryRef.current = targetCountry; }, [targetCountry]);
  useEffect(() => { winnerRef.current = winner; }, [winner]);

  const startGame = () => {
    const pool = getDifficultyPool(difficulty);
    let available = pool.filter(c => !playedRef.current[difficulty].has(c.id));

    if (available.length === 0) {
      // All countries of this difficulty were played → refresh its pool
      playedRef.current[difficulty] = new Set();
      available = pool;
    }

    const randomCountry = available[Math.floor(Math.random() * available.length)];
    playedRef.current[difficulty].add(randomCountry.id);

    setTargetCountry(randomCountry);
    setWinner(null);
    setShowContinentHint(false);
    setShowLetterHint(false);
    setShowCapitalHint(false);
    setShowFullMap(false);
    setPhase('PLAYING');
  };

  const nextRound = () => {
    if (currentRound < roundsToPlay) {
      setCurrentRound(prev => prev + 1);
      startGame();
    } else {
      setPhase('SETUP');
      setCurrentRound(1);
    }
  };

  const getZoomLevel = (baseZoom: number) => {
    if (showFullMap) return 1;
    if (difficulty === 'EASY') return baseZoom * 0.4;
    return baseZoom;
  };

  // Visual effects are in SVG user-space which scales with the map zoom,
  // so they must shrink as zoom grows to stay constant on screen.
  const effectiveZoom = targetCountry ? getZoomLevel(targetCountry.zoom) : 1;
  const glowBlur = 4 / Math.max(effectiveZoom, 0.1);
  const targetStroke = targetCountry ? 0.6 / effectiveZoom : 0.6;
  const winnerStroke = targetCountry ? 0.3 / effectiveZoom : 0.3;
  const winnerGlow = targetCountry ? 5 / effectiveZoom : 15;

  useEffect(() => {
    const unsubscribe = chatService.onMessage((msg) => {
      if (phaseRef.current !== 'PLAYING') return;
      if (winnerRef.current) return; // Ignore chat if round is already won

      const content = msg.content.trim().toLowerCase();
      const target = targetCountryRef.current;
      
      if (!target) return;

      const normalizeArabic = (text: string) => {
        return text.replace(/[أإآا]/g, 'ا').replace(/[ةه]/g, 'ه').replace(/[^ا-يa-z0-9]/g, '');
      };

      const normContent = normalizeArabic(content);
      const normTarget = normalizeArabic(target.nameAr);

      if (normContent.includes(normTarget)) {
        const newGuess: PlayerGuess = {
          id: msg.id + Date.now(),
          user: msg.user,
          guess: msg.content,
          isWinner: true,
          timestamp: Date.now()
        };

        setWinner(newGuess);
        leaderboardService.recordWin(msg.user.username, msg.user.avatar || '', 150);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center font-sans overflow-hidden relative z-10 text-white bg-black">
      {/* Dynamic Background FX */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(30,58,138,0.2)_0%,rgba(0,0,0,1)_80%)]" />
        <div className="absolute top-0 w-full h-[500px] bg-blue-900/10 blur-[150px] rounded-full translate-y-[-50%]" />
      </div>

      {!isOBS && (
        <div className="absolute top-4 left-4 z-50 flex gap-4 items-center">
          <button onClick={onHome} className="bg-blue-900/40 p-3 rounded-full hover:bg-blue-700/50 transition-colors border border-blue-500/30 backdrop-blur-md group" title="الرئيسية">
            <Globe className="w-6 h-6 text-blue-400 group-hover:text-blue-300" />
          </button>
        </div>
      )}

      <AnimatePresence>
        {skippedMessage && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="absolute top-8 left-1/2 -translate-x-1/2 bg-red-900/90 text-white px-8 py-3 rounded-full font-bold shadow-[0_0_20px_rgba(220,38,38,0.6)] z-50 flex items-center gap-3 border border-red-500/50 backdrop-blur-md"
          >
            <AlertCircle className="w-6 h-6 text-red-400" />
            {skippedMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* SETUP PHASE */}
      {phase === 'SETUP' && (
        <motion.div 
          initial={{ scale: 0.8, opacity: 0, y: 50 }} 
          animate={{ scale: 1, opacity: 1, y: 0 }} 
          transition={{ type: "spring", bounce: 0.5 }}
          className="bg-black/40 p-16 rounded-[3rem] border border-blue-500/40 flex flex-col items-center gap-8 backdrop-blur-xl z-10 shadow-[0_0_80px_rgba(59,130,246,0.1)] relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50" />
          
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 40, repeat: Infinity, ease: "linear" }} className="relative">
            <Globe className="w-32 h-32 text-blue-500 drop-shadow-[0_0_15px_rgba(59,130,246,0.8)]" />
          </motion.div>

          <div className="text-center space-y-4">
            <h1 className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-br from-blue-100 via-blue-400 to-indigo-600 tracking-wider">
              خمن الدولة
            </h1>
            <p className="text-blue-300/80 text-2xl max-w-lg mx-auto font-medium">
              سيتم تظليل دولة على الخريطة، أسرع شخص يكتب اسمها في الشات يفوز! أكثر من {COUNTRIES.length} دولة بدون تكرار.
            </p>
          </div>

          <div className="flex flex-col gap-4 w-full max-w-lg mt-4">
            <div className="flex items-center gap-6 bg-blue-950/30 p-6 rounded-2xl border border-blue-900/50 justify-center">
              <span className="text-xl text-blue-200">عدد الجولات:</span>
              <div className="flex items-center gap-4">
                {[1, 3, 5, 10, 20].map(num => (
                  <button
                    key={num}
                    onClick={() => setRoundsToPlay(num)}
                    className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black transition-all ${roundsToPlay === num ? 'bg-blue-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.6)] border-2 border-blue-300' : 'bg-black/50 text-blue-500/50 border border-blue-900 hover:bg-blue-900/40'}`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-4 bg-blue-950/30 p-6 rounded-2xl border border-blue-900/50">
              <span className="text-xl text-blue-200 text-center">مستوى الصعوبة:</span>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'EASY', label: 'سهل', desc: 'زوم خفيف ودول معروفة' },
                  { id: 'MEDIUM', label: 'متوسط', desc: 'تنوع كبير' },
                  { id: 'HARD', label: 'صعب', desc: 'دول صعبة ومجهولة' }
                ].map(diff => (
                  <button
                    key={diff.id}
                    onClick={() => setDifficulty(diff.id as any)}
                    className={`p-3 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${difficulty === diff.id ? (diff.id === 'HARD' ? 'bg-rose-600 text-white shadow-[0_0_20px_rgba(225,29,72,0.6)] border-2 border-rose-300' : diff.id === 'MEDIUM' ? 'bg-amber-500 text-black shadow-[0_0_20px_rgba(245,158,11,0.6)] border-2 border-amber-200' : 'bg-blue-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.6)] border-2 border-blue-300') : 'bg-black/50 text-blue-400 border border-blue-900 hover:bg-blue-900/40'}`}
                  >
                    <span className="font-black text-lg">{diff.label}</span>
                    <span className="text-xs opacity-70">{diff.desc}</span>
                    <span className={`text-xs font-black px-2 py-0.5 rounded-full ${difficulty === diff.id ? 'bg-white/20' : 'bg-blue-950/60'}`}>
                      {difficultyCounts[diff.id as 'EASY' | 'MEDIUM' | 'HARD']} دولة
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <motion.button 
            whileHover={{ scale: 1.05, boxShadow: "0 0 30px rgba(59,130,246,0.5)" }}
            whileTap={{ scale: 0.95 }}
            onClick={startGame} 
            className="mt-6 bg-gradient-to-r from-blue-700 to-indigo-600 hover:from-blue-600 hover:to-indigo-500 text-white font-bold py-5 px-16 rounded-full text-3xl flex items-center gap-4 transition-all border border-blue-400/50"
          >
            <Play className="w-8 h-8 fill-white" />
            بدء اللعبة
          </motion.button>
        </motion.div>
      )}

      {/* PLAYING PHASE */}
      {phase === 'PLAYING' && targetCountry && (
        <div className="w-full h-full flex flex-col p-8 z-10">
          
          <div className="flex-1 flex gap-8">
            {/* Map Container */}
            <div className="flex-[3] bg-black/40 border border-blue-900/50 rounded-[3rem] overflow-hidden relative shadow-[0_0_50px_rgba(0,0,0,0.5)] backdrop-blur-xl">
              
              <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
                <ComposableMap 
                  projection="geoMercator"
                  projectionConfig={{ scale: 130 }}
                  className="w-full h-full"
                >
                  <defs>
                    <filter id="glow-target" x="-100%" y="-100%" width="300%" height="300%" filterUnits="objectBoundingBox">
                      <feGaussianBlur stdDeviation={glowBlur} result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                    
                    {/* Pattern to fill the country with its flag when someone wins */}
                    <pattern id="flagPattern" patternUnits="objectBoundingBox" patternContentUnits="objectBoundingBox" width="1" height="1">
                      <image href={`https://flagcdn.com/w320/${targetCountry.iso2.toLowerCase()}.png`} x="0" y="0" width="1" height="1" preserveAspectRatio="xMidYMid slice" />
                    </pattern>
                    
                    {/* Glass gloss overlay for premium 3D look */}
                    <linearGradient id="glassOverlay" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="white" stopOpacity="0.5" />
                      <stop offset="40%" stopColor="white" stopOpacity="0" />
                      <stop offset="60%" stopColor="black" stopOpacity="0" />
                      <stop offset="100%" stopColor="black" stopOpacity="0.6" />
                    </linearGradient>
                  </defs>

                  <ZoomableGroup 
                    center={showFullMap ? [0, 20] : (winner ? [targetCountry.center[0] + (30 / getZoomLevel(targetCountry.zoom)), targetCountry.center[1]] : targetCountry.center)} 
                    zoom={winner ? getZoomLevel(targetCountry.zoom) * 0.85 : getZoomLevel(targetCountry.zoom)}
                    filter="drop-shadow(0 0 10px rgba(0,0,0,0.5))"
                    className="transition-transform duration-1000 ease-in-out"
                    style={{ transition: "transform 1.5s cubic-bezier(0.4, 0, 0.2, 1)" }}
                  >
                    <Geographies geography={geoUrl}>
                      {({ geographies }) => (
                        <>
                          <MapValidator 
                            geographies={geographies} 
                            targetCountry={targetCountry} 
                            onNotFound={() => {
                              if (!targetCountry) return;
                              setSkippedMessage(`تم تخطي "${targetCountry.nameAr}" تلقائياً (صغيرة جداً على الخريطة)`);
                              setTimeout(() => setSkippedMessage(null), 5000);
                              startGame();
                            }} 
                          />
                          {geographies.map((geo) => {
                            const isIsrael = targetCountry.nameEn === 'Palestine' && geo.properties?.name === 'Israel';
                            const isEswatini = targetCountry.nameEn === 'Eswatini' && geo.properties?.name === 'Swaziland';
                            const isTarget = geo.properties?.name === targetCountry.nameEn || isIsrael || isEswatini;
                            
                            return (
                              <g key={geo.rsmKey}>
                                <Geography
                                  geography={geo}
                                fill={isTarget ? (winner ? "url(#flagPattern)" : "#3b82f6") : "#0f172a"} 
                                stroke={isTarget ? (winner ? "#ffffff" : "#93c5fd") : "#1e293b"}
                                strokeWidth={isTarget ? (winner ? winnerStroke : targetStroke) : (showFullMap ? 0.3 : 0.1)}
                                style={{
                                  default: { 
                                    outline: "none", 
                                    filter: isTarget 
                                      ? (winner ? `drop-shadow(0 0 ${winnerGlow}px rgba(255,255,255,0.4))` : "url(#glow-target)") 
                                      : (showFullMap ? "none" : "brightness(0.3)"),
                                    transition: "all 1s ease-in-out"
                                  },
                                  hover: { outline: "none" },
                                  pressed: { outline: "none" },
                                }}
                              />
                              {isTarget && winner && (
                                <Geography
                                  geography={geo}
                                  fill="url(#glassOverlay)"
                                  stroke="none"
                                  style={{
                                    default: { outline: "none" },
                                    hover: { outline: "none" },
                                    pressed: { outline: "none" },
                                  }}
                                />
                              )}
                            </g>
                          );
                        })}
                        </>
                      )}
                    </Geographies>
                  </ZoomableGroup>
                </ComposableMap>
              </div>

              {/* Winner Overlay on top of Map */}
              <AnimatePresence>
                {winner && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8, y: 50 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="absolute bottom-8 right-8 bg-black/80 p-8 rounded-[3rem] border border-blue-500/50 flex flex-col items-center gap-6 shadow-[0_0_100px_rgba(59,130,246,0.3)] backdrop-blur-md w-[90%] max-w-md"
                  >
                    {/* Confetti / Particle effect behind winner */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-[3rem]">
                      {[...Array(20)].map((_, i) => (
                          <motion.div
                            key={i}
                            initial={{ y: "100%", x: "50%", scale: 0 }}
                            animate={{ 
                              y: "-20%", 
                              x: `${Math.random() * 100}%`,
                              scale: [0, Math.random() * 1.5 + 0.5, 0],
                              rotate: Math.random() * 360
                            }}
                            transition={{ duration: 1.5 + Math.random() * 2, repeat: Infinity, ease: "easeOut" }}
                            className="absolute bottom-0 w-3 h-3 bg-blue-500 rounded-full shadow-[0_0_10px_#3b82f6]"
                          />
                      ))}
                    </div>

                    <div className="text-center z-10">
                        <h2 className="text-5xl font-black text-white drop-shadow-[0_0_20px_rgba(59,130,246,0.8)] mb-1">
                          {targetCountry.nameAr}
                        </h2>
                        <h3 className="text-xl font-bold text-white/50 uppercase tracking-[0.2em]">{targetCountry.nameEn}</h3>
                    </div>

                    <div className="w-full h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />

                    <div className="flex items-center gap-6 z-10">
                      <div className="relative">
                        <Trophy className={`absolute -top-4 -right-4 w-8 h-8 ${winner.id === 'system_skip' ? 'text-red-500' : 'text-yellow-400'} drop-shadow-[0_0_15px_rgba(250,204,21,0.8)] z-10 animate-bounce`} />
                        {winner.id === 'system_skip' ? (
                          <div className="w-20 h-20 rounded-full border-4 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.6)] bg-red-950 flex items-center justify-center">
                            <X className="w-10 h-10 text-red-500" />
                          </div>
                        ) : (
                          <ProAvatar url={winner.user.avatar} username={winner.user.username} size="w-20 h-20" className="border-4 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.6)]" />
                        )}
                      </div>
                      <div className="text-right">
                        <p className={`text-sm ${winner.id === 'system_skip' ? 'text-red-400' : 'text-blue-400'} font-bold mb-1`}>
                          {winner.id === 'system_skip' ? 'انتهت الجولة' : 'أول من عرف الدولة'}
                        </p>
                        <p className="text-3xl text-white font-black drop-shadow-[0_2px_10px_rgba(59,130,246,0.5)]">{winner.user.username}</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Right Side Column */}
            <div className="flex-1 flex flex-col gap-4 shrink-0">
              {/* Side Panel for Hints */}
              <div className="bg-black/40 border border-blue-900/50 rounded-[3rem] p-8 flex flex-col gap-6 relative shadow-[0_0_50px_rgba(0,0,0,0.5)] backdrop-blur-xl mt-64">
              <h3 className="text-2xl font-black text-blue-400 border-b border-blue-900/50 pb-4 flex items-center gap-3">
                <Search className="w-6 h-6" /> {winner ? 'نهاية الجولة' : 'لوحة التلميحات'}
              </h3>

              <div className="flex-1 flex flex-col gap-4">
                {/* Host Controls */}
                {!isOBS && !winner && (
                  <div className="bg-blue-950/20 p-6 rounded-2xl border border-blue-900/50 flex flex-col gap-4">
                    <p className="text-sm text-blue-300/60 font-bold mb-2">أزرار التحكم (لا تظهر بالبث)</p>
                    
                    <div className="bg-amber-900/20 border border-amber-500/30 p-3 rounded-xl mb-2 flex items-center justify-center">
                      <p className="text-amber-400/90 text-xs font-bold text-center">
                        ⚠️ لديك استخدام واحد فقط لكل مساعدة يومياً
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => useHint('continent')}
                        disabled={showContinentHint || hintUsage.continent}
                        className={`p-3 rounded-xl text-sm font-bold border transition-colors flex justify-between items-center ${
                          showContinentHint 
                            ? 'bg-blue-900/50 border-blue-500/30 opacity-50 cursor-not-allowed' 
                            : hintUsage.continent 
                              ? 'bg-black/50 border-gray-800 text-gray-600 cursor-not-allowed' 
                              : 'bg-blue-900/50 hover:bg-blue-800 border-blue-500/30'
                        }`}
                      >
                        القارة {hintUsage.continent && <Check className="w-4 h-4 text-green-400" />}
                      </button>
                      
                      <button 
                        onClick={() => useHint('letter')}
                        disabled={showLetterHint || hintUsage.letter}
                        className={`p-3 rounded-xl text-sm font-bold border transition-colors flex justify-between items-center ${
                          showLetterHint 
                            ? 'bg-indigo-900/50 border-indigo-500/30 opacity-50 cursor-not-allowed' 
                            : hintUsage.letter 
                              ? 'bg-black/50 border-gray-800 text-gray-600 cursor-not-allowed' 
                              : 'bg-indigo-900/50 hover:bg-indigo-800 border-indigo-500/30'
                        }`}
                      >
                        الحرف {hintUsage.letter && <Check className="w-4 h-4 text-green-400" />}
                      </button>

                      <button 
                        onClick={() => useHint('capital')}
                        disabled={showCapitalHint || hintUsage.capital}
                        className={`p-3 rounded-xl text-sm font-bold border transition-colors flex justify-between items-center ${
                          showCapitalHint 
                            ? 'bg-purple-900/50 border-purple-500/30 opacity-50 cursor-not-allowed' 
                            : hintUsage.capital 
                              ? 'bg-black/50 border-gray-800 text-gray-600 cursor-not-allowed' 
                              : 'bg-purple-900/50 hover:bg-purple-800 border-purple-500/30'
                        }`}
                      >
                        العاصمة {hintUsage.capital && <Check className="w-4 h-4 text-green-400" />}
                      </button>

                      <button 
                        onClick={() => useHint('fullMap')}
                        disabled={showFullMap || hintUsage.fullMap}
                        className={`p-3 rounded-xl text-sm font-bold border transition-colors flex justify-between items-center ${
                          showFullMap 
                            ? 'bg-emerald-900/50 border-emerald-500/30 opacity-50 cursor-not-allowed' 
                            : hintUsage.fullMap 
                              ? 'bg-black/50 border-gray-800 text-gray-600 cursor-not-allowed' 
                              : 'bg-emerald-900/50 hover:bg-emerald-800 border-emerald-500/30'
                        }`}
                      >
                        موقعها (خريطة) {hintUsage.fullMap && <Check className="w-4 h-4 text-green-400" />}
                      </button>
                    </div>

                    <div className="mt-2">
                      <button 
                        onClick={() => {
                          setWinner({
                            id: 'system_skip',
                            user: { id: 'system', username: 'لم يعرفها أحد', kick_username: 'system', display_name: 'System' },
                            guess: targetCountry.nameAr,
                            isWinner: true,
                            timestamp: Date.now()
                          });
                        }}
                        className="w-full bg-red-900/50 hover:bg-red-800 py-3 rounded-xl border border-red-500/30 transition-colors text-red-300 font-bold flex items-center justify-center gap-2"
                      >
                        <X className="w-5 h-5" />
                        لم يعرفها أحد
                      </button>
                    </div>
                  </div>
                )}

                {/* Displayed Hints (Visible to everyone if no winner yet) */}
                {!winner && (
                  <div className="flex-1 flex flex-col gap-4 justify-center">
                    <AnimatePresence>
                      <div className="grid grid-cols-2 gap-4">
                        {showContinentHint && (
                          <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-gradient-to-br from-blue-900/80 to-blue-950/80 border border-blue-500/50 p-4 rounded-2xl shadow-lg text-center flex flex-col justify-center items-center backdrop-blur-md"
                          >
                            <p className="text-blue-300 text-xs font-bold mb-1 uppercase tracking-wider">تلميح القارة</p>
                            <p className="text-2xl font-black text-white">{targetCountry.continent}</p>
                          </motion.div>
                        )}
                        
                        {showLetterHint && (
                          <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-gradient-to-br from-indigo-900/80 to-indigo-950/80 border border-indigo-500/50 p-4 rounded-2xl shadow-lg text-center flex flex-col justify-center items-center backdrop-blur-md"
                          >
                            <p className="text-indigo-300 text-xs font-bold mb-1 uppercase tracking-wider">أول حرف</p>
                            <p className="text-4xl font-black text-white">"{targetCountry.nameAr.length > 2 && targetCountry.nameAr.startsWith('ال') ? targetCountry.nameAr[2] : targetCountry.nameAr[0]}"</p>
                          </motion.div>
                        )}

                        {showCapitalHint && (
                          <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-gradient-to-br from-purple-900/80 to-purple-950/80 border border-purple-500/50 p-4 rounded-2xl shadow-lg text-center flex flex-col justify-center items-center backdrop-blur-md col-span-2"
                          >
                            <p className="text-purple-300 text-xs font-bold mb-1 uppercase tracking-wider">تلميح العاصمة</p>
                            <p className="text-2xl font-black text-white">{targetCountry.capital}</p>
                          </motion.div>
                        )}
                      </div>
                    </AnimatePresence>
                  </div>
                )}

              </div>
            </div>

            {/* Round + Next Button below hints panel */}
            <div className="flex flex-col gap-3 shrink-0">
              <div className="bg-indigo-950/40 border border-indigo-500/30 px-6 py-3 rounded-2xl flex items-center justify-center gap-3 backdrop-blur-md text-xl font-black text-indigo-300 mt-10">
                <MapPin className="w-6 h-6 text-blue-500 animate-bounce" />
                جولة {currentRound} / {roundsToPlay}
              </div>
              {winner && !isOBS && (
                <motion.button 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={nextRound} 
                  className="bg-gradient-to-r from-blue-600 to-indigo-500 hover:from-blue-500 hover:to-indigo-400 text-white font-black py-4 px-10 rounded-2xl text-lg transition-all shadow-[0_0_30px_rgba(59,130,246,0.6)] cursor-pointer"
                >
                  {currentRound < roundsToPlay ? 'الجولة التالية' : 'إنهاء اللعبة'}
                </motion.button>
              )}
            </div>
          </div>
          </div>
        </div>
      )}
    </div>
  );
};
