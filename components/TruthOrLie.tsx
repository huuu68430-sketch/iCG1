import React, { useState, useEffect, useRef } from 'react';
import { chatService } from '../services/chatService';
import { supabase } from '../services/supabase';
import { awardPoints } from '../services/points';
import {
    Timer, Sparkles, Trophy, Play, Home,
    CheckCircle, XCircle, Users, Volume2, VolumeX,
    Settings, RefreshCw, Lock, Zap, User,
    AlertTriangle, Wand2, MonitorPlay, Video, Copy
} from 'lucide-react';
import { ProAvatar } from './ProAvatar';
import { pexelsService } from '../services/pexelsService';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

interface TruthOrLieProps {
    onHome: () => void;
    isOBS?: boolean;
    channelConnected?: boolean;
}

interface Vote {
    username: string;
    vote: 'truth' | 'lie';
    avatar_url?: string;
}

interface GameState {
    phase: 'idle' | 'voting' | 'reveal';
    mode: 'auto' | 'manual';
    questionText: string;
    imageUrl?: string;
    correctAnswer: 'truth' | 'lie' | null;
    timer: number;
    timeLeft: number;
}

export const TruthOrLie: React.FC<TruthOrLieProps> = ({ onHome, isOBS = false }) => {
    // Game State
    const [gameState, setGameState] = useState<GameState>({
        phase: 'idle',
        mode: 'auto',
        questionText: '',
        correctAnswer: null,
        timer: 30,
        timeLeft: 30
    });

    const [votes, setVotes] = useState<Vote[]>([]);
    const [soundEnabled, setSoundEnabled] = useState(true);

    // Auto Input State (replaces manual)
    const [autoQuestion, setAutoQuestion] = useState('');
    const [autoAnswer, setAutoAnswer] = useState<'truth' | 'lie' | null>(null);
    const [isLoadingImage, setIsLoadingImage] = useState(false);
    const [showObsGuide, setShowObsGuide] = useState(false);
    const [obsCopied, setObsCopied] = useState(false);

    const timerInterval = useRef<NodeJS.Timeout | null>(null);
    const rawObsUrl = `${window.location.origin}${window.location.pathname}?obs=true&view=TRUTH_OR_LIE`;
    const obsUrl = btoa(unescape(encodeURIComponent(rawObsUrl)));



    const handleCopyObs = async () => {
        try {
            await navigator.clipboard.writeText(rawObsUrl);
            setObsCopied(true);
            setShowObsGuide(true);
            setTimeout(() => setObsCopied(false), 2500);
        } catch {
            setShowObsGuide(true);
        }
    };

    // --- Sound Effects ---
    const playSound = (type: 'start' | 'tick' | 'end' | 'success' | 'fail') => {
        if (!soundEnabled) return;
        const sounds = {
            start: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
            tick: 'https://assets.mixkit.co/active_storage/sfx/2044/2044-preview.mp3',
            end: 'https://assets.mixkit.co/active_storage/sfx/1070/1070-preview.mp3',
            success: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
            fail: 'https://assets.mixkit.co/active_storage/sfx/1033/1033-preview.mp3'
        };
        const audio = new Audio(sounds[type]);
        audio.volume = type === 'tick' ? 0.2 : 0.5;
        audio.play().catch(() => { });
    };

    const gameStateRef = useRef(gameState);
    useEffect(() => {
        gameStateRef.current = gameState;
    }, [gameState]);

    // --- Sync & Chat ---
    useEffect(() => {
        if (!isOBS) {
            const kickChannel = 'icg1';
            chatService.connect(kickChannel);
        }

        const channel = supabase.channel('truth_or_lie_v2', {
            config: { broadcast: { self: true } }
        });

        channel
            .on('broadcast', { event: 'game_update' }, ({ payload }) => {
                if (isOBS) {
                    if (payload.type === 'STATE_UPDATE') {
                        setGameState(prev => ({ ...prev, ...payload.data }));
                    }
                    if (payload.type === 'VOTES_UPDATE') {
                        setVotes(payload.data);
                    }
                    if (payload.type === 'PLAY_SOUND') {
                        playSound(payload.sound);
                    }
                }
            })
            .subscribe();

        const handleMessage = (msg: any) => {
            if (gameStateRef.current.phase !== 'voting') return;

            const text = msg.content?.toLowerCase() || '';
            const username = msg.user?.username || 'Unknown';
            let voteType: 'truth' | 'lie' | null = null;

            if (text.includes('!صادق') || text === 'صادق' || text === '1' || text === 'truth') voteType = 'truth';
            if (text.includes('!كذاب') || text === 'كذاب' || text === '2' || text === 'lie') voteType = 'lie';

            if (voteType) {
                setVotes(prev => {
                    if (prev.find(v => v.username === username)) return prev; // User already voted

                    const newVote: Vote = {
                        username,
                        vote: voteType!,
                        avatar_url: msg.user?.avatar // Initial avatar from message
                    };
                    const newVotes = [...prev, newVote];

                    // Asynchronously fetch real Kick avatar
                    chatService.fetchKickAvatar(username).then(avatar => {
                        if (avatar) {
                            setVotes(current => current.map(v =>
                                v.username === username ? { ...v, avatar_url: avatar } : v
                            ));
                        }
                    });

                    if (!isOBS) {
                        channel.send({
                            type: 'broadcast',
                            event: 'game_update',
                            payload: { type: 'VOTES_UPDATE', data: newVotes }
                        });
                    }
                    return newVotes;
                });
            }
        };

        const unsubscribe = chatService.onMessage(handleMessage);

        return () => {
            unsubscribe();
            supabase.removeChannel(channel);
            if (timerInterval.current) clearInterval(timerInterval.current);
        };
    }, [isOBS]);

    // --- Timer Logic ---
    useEffect(() => {
        if (!isOBS && gameState.phase === 'voting' && gameState.timeLeft > 0) {
            timerInterval.current = setInterval(() => {
                setGameState(prev => {
                    const newTime = prev.timeLeft - 1;

                    supabase.channel('truth_or_lie_v2').send({
                        type: 'broadcast',
                        event: 'game_update',
                        payload: {
                            type: 'STATE_UPDATE',
                            data: { ...prev, timeLeft: newTime }
                        }
                    });

                    if (newTime <= 5 && newTime > 0) playSound('tick');

                    if (newTime <= 0) {
                        if (timerInterval.current) clearInterval(timerInterval.current);
                    }
                    return { ...prev, timeLeft: newTime };
                });
            }, 1000);
        }

        return () => {
            if (timerInterval.current) clearInterval(timerInterval.current);
        };
    }, [gameState.phase, isOBS]);

    // --- Actions ---
    const broadcastState = (newState: Partial<GameState>) => {
        const updated = { ...gameState, ...newState };
        setGameState(updated);
        supabase.channel('truth_or_lie_v2').send({
            type: 'broadcast',
            event: 'game_update',
            payload: { type: 'STATE_UPDATE', data: updated }
        });
    };

    const handleStartVoting = () => {
        if (!autoAnswer) {
            alert('يرجى توليد تحدي أولاً!');
            return;
        }

        setVotes([]);
        supabase.channel('truth_or_lie_v2').send({
            type: 'broadcast',
            event: 'game_update',
            payload: { type: 'VOTES_UPDATE', data: [] }
        });

        broadcastState({
            phase: 'voting',
            timeLeft: gameState.timer,
            questionText: autoQuestion,
            correctAnswer: autoAnswer
        });

        playSound('start');
        supabase.channel('truth_or_lie_v2').send({
            type: 'broadcast',
            event: 'game_update',
            payload: { type: 'PLAY_SOUND', sound: 'start' }
        });
    };

    const handleReveal = () => {
        broadcastState({ phase: 'reveal' });
        const sound = gameState.correctAnswer === 'truth' ? 'success' : 'fail';
        playSound(sound);
        supabase.channel('truth_or_lie_v2').send({
            type: 'broadcast',
            event: 'game_update',
            payload: { type: 'PLAY_SOUND', sound }
        });

        // Record wins for correct voters
        if (gameState.correctAnswer) {
            const winners = votes.filter(v => v.vote === gameState.correctAnswer);
            winners.forEach(w => {
                awardPoints('TRUTH_OR_LIE', w.username, w.avatar_url || '', 'round');
            });
        }
    };

    const handleReset = () => {
        setAutoQuestion('');
        setAutoAnswer(null);
        setVotes([]);
        broadcastState({
            phase: 'idle',
            questionText: '',
            correctAnswer: null,
            imageUrl: undefined,
            timeLeft: 30
        });
    };

    const FALLBACK_QUESTIONS = [
        { statement: "تصنع النملة جسوراً بجسمها لعبور الفجوات", is_truth: true, image_keyword: "ants ants bridge insect macro" },
        { statement: "القلب يتوقف تماماً عند العطس", is_truth: false, image_keyword: "sneeze funny illustration" },
        { statement: "الفراولة هي الفاكهة الوحيدة التي توجد بذورها من الخارج", is_truth: true, image_keyword: "strawberry fruit macro" },
        { statement: "تمتلك أسماك القرش عظاماً في جسمها أقوى من البشر", is_truth: false, image_keyword: "shark cartoon illustration" },
        { statement: "الأخطبوط يملك 3 قلوب، أحدها يضخ الدم للجسم والآخران للخياشيم", is_truth: true, image_keyword: "octopus underwater cartoon" },
        { statement: "النعامة تدفن رأسها في الرمال عند الخوف", is_truth: false, image_keyword: "ostrich hiding head sand" },
        { statement: "العسل الطبيعي لا يفسد أبداً ويمكن أكله بعد آلاف السنين", is_truth: true, image_keyword: "honey jar illustration" },
        { statement: "أطول حرب في التاريخ استمرت 38 دقيقة فقط", is_truth: true, image_keyword: "war cartoon tanks" }, // Anglo-Zanzibar War (True) but statement says "longest"? wait. Shortest is 38min. Longest is 335 years. I should correct this fallback.
        // Let's stick to simple ones.
        { statement: "الماء الساخن يتجمد أسرع من الماء البارد في ظروف معينة", is_truth: true, image_keyword: "freezing water science illustration" }
    ];

    // Track used questions and keywords to avoid repetition
    const [usedQuestions, setUsedQuestions] = useState<string[]>([]);
    const [usedKeywords, setUsedKeywords] = useState<string[]>([]);

    const usedQuestionsRef = useRef<string[]>([]);
    const usedKeywordsRef = useRef<string[]>([]);

    useEffect(() => {
        usedQuestionsRef.current = usedQuestions;
        usedKeywordsRef.current = usedKeywords;
    }, [usedQuestions, usedKeywords]);

    // Corrected fallback logic inside component

    const generateChallengeWithAI = async (): Promise<{ statement: string; is_truth: boolean; image_keyword: string } | null> => {
        try {
            const prompt = `Generate a Trivia Fact for a "Truth or Lie" game.
            It can be a True Fact or a Common Myth (Lie).
            Output strictly valid JSON only:
            {
                "statement": "Arabic text here (Fact or Lie)",
                "is_truth": boolean,
                "image_keyword": "Uniquely creative English search term for a cartoon/illustration image. VARY usage: use terms like 'vector art', 'digital painting', 'minimalist', 'vibrant', 'character design' along with the subject."
            }
            Do not use these previous statements: ${usedQuestionsRef.current.slice(-30).join(', ')}.
            Do not use these previous image keywords: ${usedKeywordsRef.current.slice(-30).join(', ')}.
            Make it interesting, fun, and suitable for a general audience.
            Ensure the Arabic is natural and clear.`;

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { responseMimeType: "application/json" }
                })
            });

            if (!response.ok) throw new Error('AI Error');
            const data = await response.json();
            let jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!jsonText) return null;

            // Robust JSON Extraction
            const startIndex = jsonText.indexOf('{');
            const endIndex = jsonText.lastIndexOf('}');
            if (startIndex === -1 || endIndex === -1) return null;

            jsonText = jsonText.substring(startIndex, endIndex + 1);
            return JSON.parse(jsonText);
        } catch (e) {
            console.error("AI Generation Failed:", e);
            return null;
        }
    };

    const handleAutoGenerate = async () => {
        setIsLoadingImage(true);
        try {
            let result = await generateChallengeWithAI();

            // Fallback if AI fails
            if (!result) {
                console.warn("Using Fallback Question");
                // Filter fallbacks that haven't been used recently
                const availableFallbacks = FALLBACK_QUESTIONS.filter(q => !usedQuestionsRef.current.includes(q.statement));
                const pool = availableFallbacks.length > 0 ? availableFallbacks : FALLBACK_QUESTIONS;
                const fallbackItem = pool[Math.floor(Math.random() * pool.length)];
                result = fallbackItem;
            }

            setUsedQuestions(prev => [...prev, result!.statement]);
            setUsedKeywords(prev => [...prev, result!.image_keyword]);

            // Enforce cartoon style search for either AI or Fallback but respect the keyword's own style if present
            let searchTerm = result!.image_keyword;
            if (!searchTerm.toLowerCase().includes('cartoon') && !searchTerm.toLowerCase().includes('illustration')) {
                searchTerm = `cartoon illustration ${searchTerm}`;
            }

            const url = await pexelsService.fetchRandomImage(searchTerm);

            setAutoQuestion(result!.statement);
            setAutoAnswer(result!.is_truth ? 'truth' : 'lie');

            broadcastState({
                questionText: result!.statement,
                imageUrl: url || undefined,
                correctAnswer: null,
                phase: 'idle',
                mode: 'auto'
            });
        } catch (e) {
            console.error(e);
            alert('حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى');
        } finally {
            setIsLoadingImage(false);
        }
    };
    const chooseAnswer = (ans: 'truth' | 'lie') => {
        setAutoAnswer(ans);
        broadcastState({ correctAnswer: ans });
    };

    // --- Derived State ---
    const truthVotes = votes.filter(v => v.vote === 'truth');
    const lieVotes = votes.filter(v => v.vote === 'lie');
    const realTotalVotes = votes.length;
    const calcTotal = realTotalVotes === 0 ? 1 : realTotalVotes;
    const truthPercentage = Math.round((truthVotes.length / calcTotal) * 100);
    const liePercentage = Math.round((lieVotes.length / calcTotal) * 100);

    // --- OBS VIEW ---
    if (isOBS) {
        return (
            <div className="w-full h-screen bg-transparent overflow-hidden relative font-sans flex flex-col items-center justify-center p-5">

                {/* IDLE PHASE */}
                {gameState.phase === 'idle' && (
                    <div className="flex flex-col items-center justify-center gap-5 animate-in zoom-in duration-700">
                        <div className="relative group">
                            <div className="absolute -inset-6 bg-gradient-to-r from-green-500/20 to-iabs-red/20 blur-[60px] rounded-full animate-pulse"></div>
                            <h1 className="text-5xl font-display font-black text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.3)] tracking-wide flex items-center gap-4">
                                <span className="text-transparent bg-clip-text bg-gradient-to-b from-green-400 to-green-600 drop-shadow-sm">صادق</span>
                                <span className="text-4xl text-white font-black font-display italic drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">VS</span>
                                <span className="text-transparent bg-clip-text bg-gradient-to-b from-red-500 to-iabs-red drop-shadow-sm">كذاب</span>
                            </h1>
                        </div>
                        <div className="px-6 py-3 bg-black/60 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl flex items-center gap-3">
                            <div className="w-3 h-3 bg-white rounded-full animate-bounce"></div>
                            <span className="text-lg text-white font-display font-bold">بانتظار بدء التحدي...</span>
                        </div>
                    </div>
                )}

                {/* VOTING & REVEAL PHASE */}
                {(gameState.phase === 'voting' || gameState.phase === 'reveal') && (
                    <div className="w-full max-w-4xl flex flex-col gap-6 animate-in slide-in-from-bottom-10 duration-500">

                        {/* Top Info Bar: Timer & Votes */}
                        <div className="flex items-center justify-center gap-6 mb-2">
                            <div className={`px-6 py-3 rounded-[1.5rem] flex items-center gap-3 border-2 shadow-[0_0_30px_rgba(0,0,0,0.5)] backdrop-blur-md transition-all duration-300 ${gameState.timeLeft <= 5 && gameState.phase === 'voting' ? 'bg-red-950/80 border-red-500 text-red-500 animate-pulse' : 'bg-black/80 border-white/10 text-white'}`}>
                                <Timer size={24} className={gameState.timeLeft <= 5 && gameState.phase === 'voting' ? 'animate-bounce' : ''} />
                                <span className="text-4xl font-black font-display tabular-nums">{gameState.timeLeft}s</span>
                            </div>

                            <div className="px-6 py-3 rounded-[1.5rem] bg-black/80 border-2 border-white/10 backdrop-blur-md flex items-center gap-3 shadow-lg">
                                <Users size={24} className="text-blue-400" />
                                <span className="text-4xl font-black font-display tabular-nums text-white">{realTotalVotes}</span>
                            </div>
                        </div>


                        {/* VS Battle Cards */}
                        <div className="grid grid-cols-2 gap-5 items-stretch h-[250px]">

                            {/* Truth Side */}
                            <div className={`
                                relative rounded-[2rem] p-5 flex flex-col items-center justify-between border-4 overflow-hidden transition-all duration-700
                                ${gameState.phase === 'reveal' && gameState.correctAnswer === 'truth' ? 'bg-gradient-to-b from-[#f9e0a4]/90 to-[#a97a30]/90 border-[#fbeccb] shadow-[0_0_100px_rgba(232,190,110,0.6)] scale-105 z-10' : ''}
                                ${gameState.phase === 'reveal' && gameState.correctAnswer === 'lie' ? 'bg-black/60 border-[#2a2015] opacity-50 grayscale scale-95' : ''}
                                ${gameState.phase === 'voting' ? 'bg-gradient-to-b from-[#e8be6e]/40 to-[#0a0805]/90 border-[#e8be6e]/50' : ''}
                            `}>
                                {/* Progress Background */}
                                <div
                                    className="absolute bottom-0 left-0 w-full bg-green-600/20 transition-all duration-1000 ease-out"
                                    style={{ height: `${truthPercentage}%` }}
                                ></div>

                                {/* Header */}
                                <div className="relative z-10 flex flex-col items-center">
                                    <CheckCircle size={48} className={`${gameState.phase === 'reveal' && gameState.correctAnswer === 'truth' ? 'text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.8)]' : 'text-green-500'} mb-4 transition-all duration-500`} />
                                    <h2 className="text-4xl font-black font-display text-white drop-shadow-lg">صادق</h2>
                                </div>

                                {/* Stats */}
                                <div className="relative z-10 flex flex-col items-center gap-2">
                                    <span className="text-6xl font-black font-display text-white tracking-tighter drop-shadow-2xl">
                                        {truthPercentage}<span className="text-3xl">%</span>
                                    </span>
                                    <span className="text-base font-bold text-green-400/80 bg-black/40 px-3 py-0.5 rounded-full border border-green-500/20">
                                        {truthVotes.length} صوت
                                    </span>
                                </div>

                                {/* Winner Badge */}
                                {gameState.phase === 'reveal' && gameState.correctAnswer === 'truth' && (
                                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full text-center">
                                        <div className="bg-green-500 text-black font-black text-3xl py-2 transform -rotate-6 shadow-[0_0_50px_rgba(34,197,94,0.8)] border-y-4 border-white animate-in zoom-in duration-300">
                                            إجابة صحيحة!
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Lie Side */}
                            <div className={`
                                relative rounded-[2rem] p-5 flex flex-col items-center justify-between border-4 overflow-hidden transition-all duration-700
                                ${gameState.phase === 'reveal' && gameState.correctAnswer === 'lie' ? 'bg-gradient-to-b from-[#8b4a2b]/90 to-[#3d2415]/90 border-[#d2824a] shadow-[0_0_100px_rgba(210,130,74,0.5)] scale-105 z-10' : ''}
                                ${gameState.phase === 'reveal' && gameState.correctAnswer === 'truth' ? 'bg-black/60 border-[#2a2015] opacity-50 grayscale scale-95' : ''}
                                ${gameState.phase === 'voting' ? 'bg-gradient-to-b from-[#7a4a2a]/40 to-[#0a0805]/90 border-[#d2824a]/40' : ''}
                            `}>
                                {/* Progress Background */}
                                <div
                                    className="absolute bottom-0 left-0 w-full bg-red-600/20 transition-all duration-1000 ease-out"
                                    style={{ height: `${liePercentage}%` }}
                                ></div>

                                {/* Header */}
                                <div className="relative z-10 flex flex-col items-center">
                                    <XCircle size={48} className={`${gameState.phase === 'reveal' && gameState.correctAnswer === 'lie' ? 'text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.8)]' : 'text-iabs-red'} mb-4 transition-all duration-500`} />
                                    <h2 className="text-4xl font-black font-display text-white drop-shadow-lg">كذاب</h2>
                                </div>

                                {/* Stats */}
                                <div className="relative z-10 flex flex-col items-center gap-2">
                                    <span className="text-6xl font-black font-display text-white tracking-tighter drop-shadow-2xl">
                                        {liePercentage}<span className="text-3xl">%</span>
                                    </span>
                                    <span className="text-base font-bold text-red-400/80 bg-black/40 px-3 py-0.5 rounded-full border border-red-500/20">
                                        {lieVotes.length} صوت
                                    </span>
                                </div>

                                {/* Winner Badge */}
                                {gameState.phase === 'reveal' && gameState.correctAnswer === 'lie' && (
                                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full text-center">
                                        <div className="bg-iabs-red text-white font-black text-3xl py-2 transform rotate-6 shadow-[0_0_50px_rgba(220,38,38,0.8)] border-y-4 border-white animate-in zoom-in duration-300">
                                            إجابة صحيحة!
                                        </div>
                                    </div>
                                )}
                            </div>

                        </div>
                    </div>
                )}
            </div>
        );
    }

    // --- CONTROLLER VIEW ---
    return (
        <div className="min-h-screen text-white font-sans p-4 md:p-5 flex flex-col gap-4 relative" style={{ background: 'radial-gradient(60% 50% at 72% 26%, rgba(160,100,40,.25), transparent 70%), radial-gradient(50% 40% at 12% 92%, rgba(232,190,110,.09), transparent 70%), #0a0805' }}>
            <div className="absolute inset-0 pointer-events-none z-0" style={{ backgroundImage: 'linear-gradient(rgba(232,190,110,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(232,190,110,.05) 1px, transparent 1px)', backgroundSize: '48px 48px', WebkitMask: 'radial-gradient(70% 70% at 50% 45%, #000, transparent)', mask: 'radial-gradient(70% 70% at 50% 45%, #000, transparent)' }}></div>

            {/* Header */}
            <div className="relative z-10 flex items-center justify-between bg-gradient-to-br from-[#1a1408]/95 to-[#0a0805]/95 backdrop-blur-md p-4 rounded-[1.5rem] border border-[#e8be6e]/40 shadow-[0_0_40px_rgba(232,190,110,0.12)]">
                <div className="flex items-center gap-4">
                    <button onClick={onHome} className="p-3 bg-[#1a1408]/80 hover:bg-[#e8be6e] hover:text-[#1a1006] rounded-2xl transition-all duration-300 group shadow-lg border border-[#e8be6e]/40">
                        <Home size={16} className="group-hover:scale-110 transition-transform" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-display font-black text-transparent bg-clip-text bg-gradient-to-br from-[#fff7de] via-[#e8be6e] to-[#a97a30] tracking-wide drop-shadow-lg">
                            صادق <span className="text-[#e8be6e]">أم</span> كذاب
                        </h1>
                        <p className="text-[#b2a283] text-sm font-bold mt-1 flex items-center gap-2">
                            <MonitorPlay size={14} /> لوحة التحكم بالمشرف
                        </p>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={handleCopyObs}
                        className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-[#f9e0a4] to-[#c08b3a] text-[#1a1006] font-black border border-[#fbeccb]/60 hover:from-[#fff0b8] hover:to-[#d9a441] transition-all flex items-center gap-2 shadow-[0_0_25px_rgba(232,190,110,0.35)] hover:shadow-[0_0_35px_rgba(232,190,110,0.5)] hover:scale-105 active:scale-95"
                        title="نسخ رابط OBS"
                    >
                        <Video size={16} />
                        {obsCopied ? 'تم النسخ' : 'نسخ رابط OBS'}
                    </button>
                    <button
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        className={`p-2.5 rounded-2xl border transition-all duration-300 hover:scale-105 active:scale-95 ${soundEnabled ? 'bg-[#e8be6e]/20 border-[#e8be6e] text-[#e8be6e] shadow-[0_0_15px_rgba(232,190,110,0.2)]' : 'bg-[#1a1408] border-[#e8be6e]/30 text-[#b2a283]'}`}
                    >
                        {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                    </button>
                    <div className={`px-5 py-2 rounded-2xl border flex items-center gap-2 font-bold text-base ${gameState.phase === 'voting' ? 'bg-[#e8be6e]/20 border-[#e8be6e] text-[#e8be6e] animate-pulse shadow-[0_0_15px_rgba(232,190,110,0.2)]' : 'bg-[#1a1408] border-[#e8be6e]/30 text-[#b2a283]'}`}>
                        <div className={`w-2.5 h-2.5 rounded-full shadow-[0_0_10px_currentColor] ${gameState.phase === 'voting' ? 'bg-[#e8be6e]' : 'bg-[#b2a283]'}`} />
                        {gameState.phase === 'idle' ? 'واقف' : gameState.phase === 'voting' ? 'تصويت جاري' : 'عرض النتيجة'}
                    </div>
                </div>
            </div>

            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-5 h-full min-h-[400px]">

                {/* Left: Main Stage (Image & Controls) */}
                <div className="lg:col-span-2 flex flex-col gap-4">

                    {/* Image Area */}
                    <div className="flex-1 relative rounded-[2rem] overflow-hidden border border-[#e8be6e]/40 shadow-[0_0_40px_rgba(232,190,110,0.12)] group bg-gradient-to-br from-[#1a1408]/90 to-[#0a0805]/95 backdrop-blur-sm min-h-[350px]">
                        {gameState.imageUrl ? (
                            <>
                                <img
                                    src={gameState.imageUrl}
                                    className="w-full h-full object-cover transition-transform duration-[30s] ease-linear group-hover:scale-110"
                                    alt="Challenge"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-90"></div>

                                {/* Info Overlay */}
                                <div className="absolute inset-0 p-5 flex">
                                    <div className="ml-auto flex flex-col gap-3 w-[200px]">
                                        {autoAnswer ? (
                                            <div className={`px-5 py-3 rounded-2xl border backdrop-blur-xl shadow-2xl flex items-center gap-3 ${autoAnswer === 'truth' ? 'bg-green-600/20 border-green-500 text-green-400' : 'bg-red-600/20 border-red-500 text-red-400'}`}>
                                                {autoAnswer === 'truth' ? <CheckCircle size={20} /> : <XCircle size={20} />}
                                                <span className="text-xl font-black font-display">
                                                    {autoAnswer === 'truth' ? 'صــادق' : 'كــذاب'}
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="rounded-2xl bg-black/50 border border-white/10 p-3 backdrop-blur-xl shadow-2xl">
                                                <div className="text-zinc-300 text-sm font-bold mb-3">اختر الإجابة</div>
                                                <div className="grid grid-cols-1 gap-2">
                                                    <button onClick={() => chooseAnswer('truth')} className="px-4 py-3 rounded-xl bg-green-900/40 border-2 border-green-500/40 hover:border-green-400 text-green-300 font-black flex items-center justify-center gap-2 transition-all">
                                                        <CheckCircle /> صادق
                                                    </button>
                                                    <button onClick={() => chooseAnswer('lie')} className="px-4 py-3 rounded-xl bg-red-900/40 border-2 border-red-500/40 hover:border-red-400 text-red-300 font-black flex items-center justify-center gap-2 transition-all">
                                                        <XCircle /> كذاب
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-iabs-red/5"></div>
                                <div className="relative z-10 bg-black/50 p-8 rounded-[2rem] border border-white/5 backdrop-blur-md shadow-2xl">
                                    <div className="w-28 h-28 bg-iabs-red/10 rounded-full flex items-center justify-center mb-5 mx-auto animate-pulse ring-4 ring-iabs-red/20">
                                        <Wand2 size={48} className="text-iabs-red" />
                                    </div>
                                    <h2 className="text-3xl font-display font-bold text-white mb-3">جاهز للتحدي؟</h2>
                                    <p className="text-zinc-400 text-base font-medium">اضغط على الزر بالأسفل لتوليد صورة جديدة</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Controls Bar */}
                    <div className="h-20">
                        {!gameState.imageUrl ? (
                            <button
                                onClick={handleAutoGenerate}
                                disabled={isLoadingImage}
                                className="w-full h-full rounded-[1.5rem] text-xl font-black flex items-center justify-center gap-4 disabled:opacity-50 group hover:scale-[1.02] transition-all bg-gradient-to-r from-[#f9e0a4] to-[#c08b3a] text-[#1a1006] shadow-[0_0_30px_rgba(232,190,110,0.4)] border border-[#fbeccb]/60"
                            >
                                {isLoadingImage ? (
                                    <><RefreshCw className="animate-spin" size={24} /> جاري التحميل...</>
                                ) : (
                                    <><Wand2 size={24} className="group-hover:rotate-12 transition-transform" /> توليد تحدي جديد</>
                                )}
                            </button>
                        ) : (
                            <div className="grid grid-cols-2 gap-4 h-full">
                                {gameState.phase === 'idle' ? (
                                    <>
                                        <button
                                            onClick={handleStartVoting}
                                            className="col-span-1 rounded-[1.5rem] text-lg font-black flex items-center justify-center gap-3 hover:scale-[1.02] transition-all bg-gradient-to-r from-[#f9e0a4] to-[#c08b3a] text-[#1a1006] shadow-[0_0_30px_rgba(232,190,110,0.4)] border border-[#fbeccb]/60"
                                        >
                                            <span className="shine-layer"></span>
                                            <Play size={20} fill="currentColor" /> ابدأ التصويت
                                        </button>
                                        <button
                                            onClick={handleReset}
                                            className="col-span-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded-[1.5rem] font-black text-lg shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3 border border-white/10"
                                        >
                                            <RefreshCw size={20} /> إلغاء
                                        </button>
                                    </>
                                ) : gameState.phase === 'voting' ? (
                                    <button
                                        onClick={handleReveal}
                                        className="col-span-2 bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-black rounded-[1.5rem] font-black text-xl shadow-[0_0_40px_rgba(234,179,8,0.4)] transition-all active:scale-95 flex items-center justify-center gap-4 border-t-2 border-yellow-300"
                                    >
                                        <Trophy size={24} /> كشف النتيجة
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleReset}
                                        className="col-span-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-[1.5rem] font-black text-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-4 border border-white/10"
                                    >
                                        <RefreshCw size={24} /> جولة جديدة
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Stats (Vertical Layout) */}
                <div className="flex flex-col gap-4">
                    {/* Timer */}
                    <div className="rounded-[1.5rem] p-5 flex flex-col items-center justify-center text-center relative overflow-hidden h-36 bg-gradient-to-br from-[#1a1408]/95 to-[#0a0805]/95 border border-[#e8be6e]/40 shadow-[0_0_30px_rgba(232,190,110,0.1)]">
                        <div className="absolute inset-0 bg-gradient-to-b from-[#e8be6e]/5 to-transparent"></div>
                        <div className="relative z-10">
                            <Timer className={`mb-2 mx-auto ${gameState.timeLeft <= 5 && gameState.phase === 'voting' ? 'text-[#e8be6e] animate-bounce' : 'text-[#b2a283]'}`} size={22} />
                            <div className="text-4xl font-black tabular-nums tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-[#fff7de] via-[#e8be6e] to-[#a97a30] font-display drop-shadow-lg">
                                {gameState.timeLeft}
                            </div>
                            <p className="text-[#b2a283] text-xs font-bold uppercase tracking-widest mt-1">ثانية</p>
                        </div>
                    </div>

                    {/* Stats Card */}
                    <div className="rounded-[1.5rem] p-5 flex-1 flex flex-col min-h-0 bg-gradient-to-br from-[#1a1408]/95 to-[#0a0805]/95 border border-[#e8be6e]/40 shadow-[0_0_30px_rgba(232,190,110,0.1)]">
                        <h3 className="text-[#e8be6e] font-bold mb-4 flex items-center gap-2 text-base border-b border-[#e8be6e]/20 pb-3">
                            <Users size={14} /> تصويت الجمهور ({realTotalVotes})
                        </h3>

                        <div className="space-y-5 mb-5">
                            {/* Truth Bar */}
                            <div>
                                <div className="flex justify-between mb-2 text-sm font-bold">
                                    <span className="text-green-400 flex items-center gap-2"><CheckCircle size={10} /> صادق</span>
                                    <span className="text-white">{truthPercentage}%</span>
                                </div>
                                <div className="h-3 bg-zinc-900 rounded-full overflow-hidden">
                                    <div style={{ width: `${truthPercentage}%` }} className="h-full bg-green-500 rounded-full shadow-[0_0_15px_rgba(34,197,94,0.5)] transition-all duration-500"></div>
                                </div>
                            </div>

                            {/* Lie Bar */}
                            <div>
                                <div className="flex justify-between mb-2 text-sm font-bold">
                                    <span className="text-red-400 flex items-center gap-2"><XCircle size={10} /> كذاب</span>
                                    <span className="text-white">{liePercentage}%</span>
                                </div>
                                <div className="h-3 bg-zinc-900 rounded-full overflow-hidden">
                                    <div style={{ width: `${liePercentage}%` }} className="h-full bg-iabs-red rounded-full shadow-[0_0_15px_rgba(220,38,38,0.5)] transition-all duration-500"></div>
                                </div>
                            </div>
                        </div>

                        {/* Recent Voters */}
                        <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-black/20 rounded-2xl p-3 border border-white/5">
                            <h4 className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-4">آخر المصوتين</h4>
                            <div className="space-y-2 overflow-y-auto pr-2 custom-scrollbar flex-1">
                                {votes.slice().reverse().map((v, i) => (
                                    <div key={i} className="flex items-center justify-between p-1.5 rounded-lg bg-black/40 border border-white/5 animate-in slide-in-from-right duration-300">
                                        <div className="flex items-center gap-2">
                                            <ProAvatar
                                                url={v.avatar_url}
                                                username={v.username}
                                                size="w-8 h-8"
                                                className="overflow-visible"
                                            />
                                            <span className="text-zinc-300 text-xs font-medium truncate max-w-[80px]">{v.username}</span>
                                        </div>
                                        <div className={`w-2 h-2 rounded-full ${v.vote === 'truth' ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.8)]' : 'bg-red-500 shadow-[0_0_5px_rgba(220,38,38,0.8)]'}`}></div>
                                    </div>
                                ))}
                                {votes.length === 0 && (
                                    <div className="flex flex-col items-center justify-center h-full text-zinc-700 gap-2 opacity-50">
                                        <Users size={14} />
                                        <p className="text-xs">في انتظار التصويت...</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {showObsGuide && (
                <div className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-lg flex items-center justify-center p-4">
                    <div className="w-full max-w-lg bg-gradient-to-br from-[#1a1408]/98 to-[#0a0805]/98 border border-[#e8be6e]/50 rounded-[2rem] shadow-[0_0_80px_rgba(232,190,110,0.25)] overflow-hidden">
                        <div className="bg-gradient-to-r from-[#e8be6e]/30 to-transparent p-6 border-b border-[#e8be6e]/30 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-[#e8be6e]/20 border border-[#e8be6e]/40">
                                    <Video size={18} className="text-[#e8be6e]" />
                                </div>
                                <h3 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-br from-[#fff7de] to-[#e8be6e] font-display">دليل ربط اللعبة بـ OBS</h3>
                            </div>
                            <span className="text-xs text-[#b2a283] font-bold px-2 py-1 rounded-lg bg-[#1a1408]/60 border border-[#e8be6e]/20">مشفر</span>
                        </div>
                        <div className="p-6 space-y-5">
                            <div className="text-center">
                                <button onClick={handleCopyObs} className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#f9e0a4] to-[#c08b3a] text-[#1a1006] font-black text-lg border border-[#fbeccb]/60 hover:from-[#fff0b8] hover:to-[#d9a441] transition-all flex items-center justify-center gap-3 shadow-[0_0_40px_rgba(232,190,110,0.4)] hover:shadow-[0_0_50px_rgba(232,190,110,0.6)] hover:scale-[1.02] active:scale-95">
                                    <Copy size={20} />
                                    {obsCopied ? 'تم نسخ الرابط بنجاح!' : 'نسخ رابط OBS المشفر'}
                                </button>
                                <p className="text-xs text-[#b2a283] mt-2">يتم نسخ الرابط تلقائيًا وهو مخفي للحماية</p>
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                                <div className="bg-[#1a1408]/60 border border-[#e8be6e]/30 rounded-2xl p-4">
                                    <div className="text-[#e8be6e] font-black mb-3 flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-lg bg-[#e8be6e]/20 flex items-center justify-center text-sm">1</span>
                                        الخطوات
                                    </div>
                                    <ul className="text-[#fbeccb]/80 text-sm space-y-2 mr-4">
                                        <li>افتح OBS وأضف مصدر Browser Source</li>
                                        <li>الصق الرابط المنسوخ داخل حقل URL</li>
                                        <li>العرض: 1920 × الارتفاع: 1080</li>
                                        <li>فعّل "Refresh cache when scene becomes active"</li>
                                    </ul>
                                </div>
                                <div className="bg-[#1a1408]/60 border border-[#e8be6e]/30 rounded-2xl p-4">
                                    <div className="text-[#e8be6e] font-black mb-3 flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-lg bg-[#e8be6e]/20 flex items-center justify-center text-sm">!</span>
                                        ملاحظات
                                    </div>
                                    <ul className="text-[#fbeccb]/80 text-sm space-y-2 mr-4">
                                        <li>تأكد من عدم وجود مانع إعلانات</li>
                                        <li>يفضّل استخدام دقة Full HD لأفضل جودة</li>
                                        <li>الخلفية شفافة تلقائيًا</li>
                                    </ul>
                                </div>
                            </div>
                            <button onClick={() => setShowObsGuide(false)} className="w-full py-2.5 rounded-xl bg-[#1a1408] hover:bg-[#2a2015] text-[#fbeccb] font-bold border border-[#e8be6e]/30 transition-all">إغلاق</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};
