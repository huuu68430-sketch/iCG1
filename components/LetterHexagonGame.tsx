import React, { useState, useEffect, useRef } from 'react';
import { chatService } from '../services/chatService';
import { supabase } from '../services/supabase';
import { awardPoints, awardPointsToMany } from '../services/points';
import { LETTER_GAME_QUESTIONS, getQuestionsForLevel, getWorldForLevel } from '../data/letter_game_data';
import { HexCellData, LetterQuestion } from '../types';
import { Home, LogOut, Check, X, Shield, Trophy, Users, Play, Settings, Clock, BrainCircuit, RefreshCw, ArrowLeft, ArrowRight, Stars, Sparkles, Crown, BellRing, Volume2, VolumeX, ChevronDown, Link, Vote, Swords, Eye, EyeOff } from 'lucide-react';
import { ProAvatar } from './ProAvatar';

interface LetterHexagonGameProps {
    onHome: () => void;
    isOBS?: boolean;
    onToggleOBSPreview?: () => void;
    obsPreviewActive?: boolean;
}

// 28 Arabic letters exactly matching our 28-cell grid (6,5,6,5,6)
const ARABIC_LETTERS = ['أ', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ذ', 'ر', 'ز', 'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'هـ', 'و', 'ي'];
const GRID_LAYOUT = [6, 5, 6, 5, 6];

const FONT_DISPLAY = "'Baloo Bhaijaan 2','Tajawal',sans-serif";

const normalize = (val: string) => {
    if (!val) return '';
    return val.trim().toLowerCase()
        .replace(/[ً-ْ]/g, '') // Remove Harakat (Fatha, Damma, Kasra, etc.)
        .replace(/[أإآ]/g, 'ا')        // Normalize Alif forms
        .replace(/ة/g, 'ه')           // Normalize Ta Marbuta to Ha
        .replace(/ى/g, 'ي')           // Normalize Alef Maksura to Ya
        .replace(/[ؤئ]/g, 'ء')        // Normalize Hamza forms
        .replace(/\s+/g, ' ')         // Normalize extra spaces
        .trim();
};

// «ال» and «و» are prefixes players drop or add freely, so compare both shapes
function answerVariants(word: string): string[] {
    const base = normalize(word).replace(/ـ/g, '').replace(/[^ء-ي]/g, '').trim();
    if (!base) return [];
    const out = new Set<string>([base]);
    let frontier = [base];
    for (let depth = 0; depth < 2; depth++) {
        const next: string[] = [];
        for (const s of frontier) {
            if (s.startsWith('ال') && s.length > 3) next.push(s.slice(2));
            if (s.startsWith('و') && s.length > 2) next.push(s.slice(1));
        }
        frontier = next.filter(s => !out.has(s));
        frontier.forEach(s => out.add(s));
    }
    return [...out];
}

function isCorrectAnswer(typed: string, question: LetterQuestion | null, cellLetter: string): boolean {
    const typedForms = answerVariants(typed);
    if (typedForms.length === 0) return false;
    if (!question) return normalize(typed)[0] === normalize(cellLetter)[0];

    return answerVariants(question.answer).some(form => typedForms.includes(form));
}

function getTeamByColor(hexColor: string): 'team1' | 'team2' {
    if (!hexColor) return 'team2';
    let hex = hexColor.replace(/^#/, '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');

    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;

    // Direct check for "Girls/Females" colors (Pinks/Reds/Purples) vs "Boys/Males" (Blues/Teals/Greens)
    // Team 1 (الذهبي): Red is dominant or Red+Blue are high (Purple/Pink)
    if (r > g + 20) return 'team1';

    // Team 2 (النحاسي): Green or Blue is dominant
    if (g > r + 10 || b > r + 10) return 'team2';

    // Default fallback based on Red vs Blue
    return r > b ? 'team1' : 'team2';
}

const getArabicStageWord = (num: number): string => {
    if (num <= 0 || num > 100) return num.toString();

    const fem = [
        '', 'الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة',
        'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'العاشرة',
        'الحادية عشرة', 'الثانية عشرة', 'الثالثة عشرة', 'الرابعة عشرة', 'الخامسة عشرة',
        'السادسة عشرة', 'السابعة عشرة', 'الثامنة عشرة', 'التاسعة عشرة'
    ];

    if (num <= 19) return fem[num] || num.toString();

    const tens = [
        '', '', 'العشرون', 'الثلاثون', 'الأربعون', 'الخمسون',
        'الستون', 'السبعون', 'الثمانون', 'التسعون'
    ];

    if (num === 100) return 'المائة';
    if (num % 10 === 0) return tens[num / 10] || num.toString();

    const onesPart = fem[num % 10];
    const tensPart = tens[Math.floor(num / 10)];
    return `${onesPart} و ${tensPart}`;
};

interface Player {
    username: string;
    avatar: string;
    color: string;
    team: 'team1' | 'team2';
}

type Stage = 'settings' | 'levelSelect' | 'lobby' | 'playing' | 'ended';

interface LogEntry {
    id: number;
    text: string;
    team: 'team1' | 'team2' | 'sys';
}

export const LetterHexagonGame: React.FC<LetterHexagonGameProps> = ({ onHome, isOBS, onToggleOBSPreview, obsPreviewActive }) => {
    // Stage Management
    const [stage, setStage] = useState<Stage>(isOBS ? 'lobby' : 'settings');

    // Game Data States
    const [lobbyPlayers, setLobbyPlayers] = useState<Player[]>([]);
    const [cells, setCells] = useState<HexCellData[]>([]);
    const [activeCell, setActiveCell] = useState<HexCellData | null>(null);
    const [currentQuestion, setCurrentQuestion] = useState<LetterQuestion | null>(null);
    const [winner, setWinner] = useState<'team1' | 'team2' | null>(null);
    const [winningPath, setWinningPath] = useState<number[]>([]);

    // Settings
    const [entryKeyword, setEntryKeyword] = useState('دخول');
    const [difficulty, setDifficulty] = useState<'normal' | 'hard'>('normal');
    const [answerDuration, setAnswerDuration] = useState(10);
    const [team1Name, setTeam1Name] = useState('الفريق الذهبي 🟡');
    const [team2Name, setTeam2Name] = useState('الفريق النحاسي 🟠');

    // Sound + game log (manager-side chrome)
    const [sfxMuted, setSfxMuted] = useState(false);
    const sfxMutedRef = useRef(false);
    useEffect(() => { sfxMutedRef.current = sfxMuted; }, [sfxMuted]);
    const [gameLog, setGameLog] = useState<LogEntry[]>([]);
    const logSeqRef = useRef(0);
    const [answerRevealed, setAnswerRevealed] = useState(false);

    const pushLog = (text: string, team: 'team1' | 'team2' | 'sys') => {
        logSeqRef.current += 1;
        const entry = { id: logSeqRef.current, text, team };
        setGameLog(prev => [entry, ...prev].slice(0, 6));
    };

    // Progressive Levels
    const [currentLevel, setCurrentLevel] = useState<number>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('iabs_letter_game_level');
            return saved ? parseInt(saved) : 1;
        }
        return 1;
    });

    useEffect(() => {
        localStorage.setItem('iabs_letter_game_level', currentLevel.toString());
    }, [currentLevel]);

    // Highest unlocked level (saves progress lock)
    const [highestUnlocked, setHighestUnlocked] = useState<number>(() => {
        if (typeof window !== 'undefined') {
            return parseInt(localStorage.getItem('iabs_letter_game_highest') || '1');
        }
        return 1;
    });
    useEffect(() => { localStorage.setItem('iabs_letter_game_highest', highestUnlocked.toString()); }, [highestUnlocked]);

    // Chat Bell Game Logic
    const [buzzedTeam, setBuzzedTeam] = useState<'team1' | 'team2' | null>(null);
    const [buzzedPlayer, setBuzzedPlayer] = useState<Player | null>(null);
    const [answerTimer, setAnswerTimer] = useState<number>(0);
    // The chat listener reads the clock from refs: answerTimer in its closure is frozen
    // at registration time, so late answers would still score after time-out.
    const clockOpenRef = useRef(false);
    const turnDecidedRef = useRef(false);
    const lateAnswerLoggedRef = useRef(false);
    const [triedTeams, setTriedTeams] = useState<('team1' | 'team2')[]>([]);
    // After both teams fail the cell opens to everyone — no bell needed, first correct answer takes it
    const [openTurn, setOpenTurn] = useState(false);
    const [lastAnswer, setLastAnswer] = useState<{ text: string, correct: boolean | null }>({ text: '', correct: null });
    const [linkCopied, setLinkCopied] = useState(false);
    const [currentBuzzedAttempts, setCurrentBuzzedAttempts] = useState(0);
    const [transitioningToTeam, setTransitioningToTeam] = useState<'team1' | 'team2' | 'open' | null>(null);
    const [transitionTimer, setTransitionTimer] = useState(0);
    const [showInstructions, setShowInstructions] = useState(false);

    // Track winners per level
    const [levelWinners, setLevelWinners] = useState<Record<number, 'team1' | 'team2'>>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('iabs_letter_level_winners');
            return saved ? JSON.parse(saved) : {};
        }
        return {};
    });

    // Voting Feature States
    const [showVotingPanel, setShowVotingPanel] = useState(false);
    const [votingActive, setVotingActive] = useState(false);
    const [votingEligibleTeam, setVotingEligibleTeam] = useState<'team1' | 'team2' | 'all'>('all');
    const [letterVotes, setLetterVotes] = useState<Record<string, number>>({});
    const [votedUsers, setVotedUsers] = useState<Record<string, boolean>>({}); // voter -> true
    const [votingDuration, setVotingDuration] = useState(30);
    const [votingTimer, setVotingTimer] = useState(0);

    const channelRef = useRef<any>(null);
    const broadcastRef = useRef<any>(null);

    // Board Geometry (Matching image-match quality)
    const HEX_SIZE = isOBS ? 75 : 55; // Increased for OBS to fit large letters
    const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE;
    const HEX_HEIGHT = 2 * HEX_SIZE;
    const X_OFFSET = HEX_WIDTH;
    const Y_OFFSET = HEX_HEIGHT * 0.75;
    const STROKE_WIDTH = 8;
    const SVG_WIDTH = HEX_WIDTH + STROKE_WIDTH;
    const SVG_HEIGHT = HEX_HEIGHT + STROKE_WIDTH;

    const hexPoints = [
        [0 + STROKE_WIDTH / 2, HEX_SIZE / 2 + STROKE_WIDTH / 2],
        [HEX_WIDTH / 2 + STROKE_WIDTH / 2, 0 + STROKE_WIDTH / 2],
        [HEX_WIDTH + STROKE_WIDTH / 2, HEX_SIZE / 2 + STROKE_WIDTH / 2],
        [HEX_WIDTH + STROKE_WIDTH / 2, HEX_SIZE * 1.5 + STROKE_WIDTH / 2],
        [HEX_WIDTH / 2 + STROKE_WIDTH / 2, HEX_HEIGHT + STROKE_WIDTH / 2],
        [0 + STROKE_WIDTH / 2, HEX_SIZE * 1.5 + STROKE_WIDTH / 2]
    ].map(p => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');

    const boardWidth = 6 * X_OFFSET + X_OFFSET / 2;
    const boardHeight = 4 * Y_OFFSET + HEX_HEIGHT + STROKE_WIDTH;

    // Use a ref to store the latest broadcast function to avoid stale closures in listeners
    const broadcastFullStateRef = useRef<any>(null);

    // OBS SYNC - Broadcast state if manager
    useEffect(() => {
        if (isOBS) {
            const channel = supabase.channel('letter_game_sync')
                .on('broadcast', { event: 'STATE_UPDATE' }, (payload) => {
                    const data = payload.payload;
                    if (!data) return;
                    if (data.cells) setCells(data.cells);
                    if (data.stage) setStage(data.stage);
                    if (data.activeCell !== undefined) setActiveCell(data.activeCell);
                    if (data.currentQuestion !== undefined) setCurrentQuestion(data.currentQuestion);
                    if (data.buzzedTeam !== undefined) setBuzzedTeam(data.buzzedTeam);
                    if (data.buzzedPlayer !== undefined) setBuzzedPlayer(data.buzzedPlayer);
                    if (data.answerTimer !== undefined) setAnswerTimer(data.answerTimer);
                    if (data.lastAnswer !== undefined) setLastAnswer(data.lastAnswer);
                    if (data.triedTeams !== undefined) setTriedTeams(data.triedTeams);
                    if (data.openTurn !== undefined) setOpenTurn(data.openTurn);
                    if (data.winner !== undefined) setWinner(data.winner);
                    if (data.winningPath !== undefined) setWinningPath(data.winningPath);
                    if (data.lobbyPlayers !== undefined) setLobbyPlayers(data.lobbyPlayers);
                    if (data.team1Name !== undefined) setTeam1Name(data.team1Name);
                    if (data.team2Name !== undefined) setTeam2Name(data.team2Name);
                    if (data.entryKeyword !== undefined) setEntryKeyword(data.entryKeyword);
                    if (data.answerDuration !== undefined) setAnswerDuration(data.answerDuration);
                    if (data.difficulty !== undefined) setDifficulty(data.difficulty);
                    if (data.currentLevel !== undefined) setCurrentLevel(data.currentLevel);
                    if (data.currentBuzzedAttempts !== undefined) setCurrentBuzzedAttempts(data.currentBuzzedAttempts);
                    if (data.transitioningToTeam !== undefined) setTransitioningToTeam(data.transitioningToTeam);
                    if (data.transitionTimer !== undefined) setTransitionTimer(data.transitionTimer);
                    if (data.votingActive !== undefined) setVotingActive(data.votingActive);
                    if (data.letterVotes !== undefined) setLetterVotes(data.letterVotes);
                    if (data.votingEligibleTeam !== undefined) setVotingEligibleTeam(data.votingEligibleTeam);
                    if (data.showVotingPanel !== undefined) setShowVotingPanel(data.showVotingPanel);
                    if (data.votedUsers !== undefined) setVotedUsers(data.votedUsers);
                    if (data.votingTimer !== undefined) setVotingTimer(data.votingTimer);
                    if (data.votingDuration !== undefined) setVotingDuration(data.votingDuration);
                })
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        // Small delay before requesting initial sync to ensure manager is ready
                        setTimeout(() => {
                            channel.send({ type: 'broadcast', event: 'SYNC_REQUEST', payload: {} });
                        }, 1000);
                    }
                });
            return () => { supabase.removeChannel(channel); };
        } else {
            // Manager: setup channel and handle sync requests
            const channel = supabase.channel('letter_game_sync')
                .on('broadcast', { event: 'SYNC_REQUEST' }, () => {
                    // Send full state to joining OBS using the LATEST broadcast function
                    if (broadcastFullStateRef.current) {
                        broadcastFullStateRef.current(channel);
                    }
                })
                .subscribe();
            broadcastRef.current = channel;
            return () => { supabase.removeChannel(channel); };
        }
    }, [isOBS]);

    const broadcastFullState = (channelOverride?: any) => {
        const chan = channelOverride || broadcastRef.current;
        if (!isOBS && chan) {
            chan.send({
                type: 'broadcast',
                event: 'STATE_UPDATE',
                payload: {
                    cells, stage, activeCell, currentQuestion,
                    buzzedTeam, buzzedPlayer, answerTimer,
                    lastAnswer, triedTeams, openTurn, winner, winningPath,
                    lobbyPlayers, team1Name, team2Name, entryKeyword,
                    answerDuration, difficulty, currentLevel,
                    currentBuzzedAttempts, transitioningToTeam, transitionTimer,
                    votingActive, letterVotes, votingEligibleTeam, showVotingPanel, votedUsers,
                    votingTimer, votingDuration
                }
            });
        }
    };

    // Update the ref to the latest broadcast function every render
    useEffect(() => {
        broadcastFullStateRef.current = broadcastFullState;
    });

    useEffect(() => {
        if (stage === 'playing' || stage === 'ended') {
            broadcastFullState();
        }
    }, [cells, stage, activeCell, currentQuestion, buzzedTeam, buzzedPlayer, answerTimer, lastAnswer, triedTeams, openTurn, winner, winningPath, lobbyPlayers, team1Name, team2Name, entryKeyword, isOBS, currentLevel, currentBuzzedAttempts, transitioningToTeam, transitionTimer, answerDuration, votingActive, letterVotes, votingEligibleTeam, showVotingPanel, votedUsers, votingTimer, votingDuration]);

    // Chat listener (Main Bell Game logic)
    const normalizeArabicText = (s: string) => s.replace(/[^\u0621-\u064A\s]/g, ' ').replace(/\s+/g, ' ').trim();

    // Team name without emoji/symbols for typing in chat
    const cleanTeamName = (n: string) => normalizeArabicText(n).split(' ').filter(w => w && w !== 'فريق' && w !== 'الفريق').join(' ');

    // Join command = entry keyword + team name, e.g. "دخول الذهبي"
    const getTeamByJoinText = (content: string): 'team1' | 'team2' | null => {
        const cleaned = normalizeArabicText(content);
        const kw = normalizeArabicText(entryKeyword);
        if (!kw || !cleaned.startsWith(kw)) return null;
        const rest = cleaned.slice(kw.length).trim();
        if (!rest) return null;
        const n1 = cleanTeamName(team1Name);
        const n2 = cleanTeamName(team2Name);
        if (n1 && (rest.includes(n1) || n1.includes(rest))) return 'team1';
        if (n2 && (rest.includes(n2) || n2.includes(rest))) return 'team2';
        return null;
    };

    useEffect(() => {
        const cleanup = chatService.onMessage(async (msg) => {
            try {
                if (stage === 'lobby') {
                    const joinTeam = getTeamByJoinText(msg.content);
                    if (joinTeam) {
                        const u = msg.user.username;
                        const c = msg.user.color || '#ffffff';
                        setLobbyPlayers(prev => {
                            if (prev.find(p => p.username === u)) return prev;
                            return [...prev, { username: u, color: c, team: joinTeam, avatar: '' }];
                        });
                        chatService.fetchKickAvatar(u).then(avatar => {
                            setLobbyPlayers(prev => prev.map(p => p.username === u ? { ...p, avatar } : p));
                        });
                    }
                }

                if (stage === 'playing') {
                    const content = msg.content.trim();
                    const u = msg.user.username;

                    // Identify the player
                    const player = lobbyPlayers.find(p => p.username.toLowerCase() === u.toLowerCase()) || {
                        username: u,
                        team: getTeamByColor(msg.user.color || '#ffffff'),
                        avatar: msg.user.avatar || '',
                        color: msg.user.color || '#ffffff'
                    };

                    // Voting logic - works regardless of activeCell
                    if (votingActive) {
                        // Check eligibility
                        let isEligible = true;
                        if (votingEligibleTeam !== 'all' && player.team !== votingEligibleTeam) {
                            isEligible = false;
                        }

                        if (isEligible && !votedUsers[u.toLowerCase()]) {
                            const availableCells = cells.filter(c => c.owner === 'none');
                            let foundLetter: string | null = null;

                            // Strategy 1: Exact match with optional trailing punctuation/space
                            const exactMatch = content.match(/^([\u0621-\u064A](?:ـ)?)[.،!؟\s]*$/);
                            if (exactMatch) {
                                const raw = exactMatch[1];
                                const cell = availableCells.find(c => c.letter === raw || normalize(c.letter) === normalize(raw));
                                if (cell) foundLetter = cell.letter;
                            }

                            // Strategy 2: "حرف <letter>" pattern
                            if (!foundLetter) {
                                const wordMatch = content.match(/(?:حرف|صوت|بدي|نختار|ابي|ابغى)\s+([\u0621-\u064A](?:ـ)?)/);
                                if (wordMatch) {
                                    const raw = wordMatch[1];
                                    const cell = availableCells.find(c => c.letter === raw || normalize(c.letter) === normalize(raw));
                                    if (cell) foundLetter = cell.letter;
                                }
                            }

                            // Strategy 3: Relaxed scan
                            if (!foundLetter) {
                                let earliestIndex = Infinity;
                                for (const cell of availableCells) {
                                    const idx = content.indexOf(cell.letter);
                                    if (idx !== -1 && idx < earliestIndex) {
                                        earliestIndex = idx;
                                        foundLetter = cell.letter;
                                    } else {
                                        const normL = normalize(cell.letter);
                                        const normC = normalize(content);
                                        const nIdx = normC.indexOf(normL);
                                        if (normL.length > 0 && nIdx !== -1 && nIdx < earliestIndex) {
                                            earliestIndex = nIdx;
                                            foundLetter = cell.letter;
                                        }
                                    }
                                }
                            }

                            if (foundLetter) {
                                setLetterVotes(prev => ({
                                    ...prev,
                                    [foundLetter!]: (prev[foundLetter!] || 0) + 1
                                }));
                                setVotedUsers(prev => ({ ...prev, [u.toLowerCase()]: true }));
                            }
                        }
                    }

                    // Bell and Answer logic (only if cell is active)
                    if (activeCell) {
                        // «جرس» only claims the cell for the first team;
                        // a handed-over turn and the open phase answer directly.
                        const needsBell = !buzzedTeam && !openTurn && !transitioningToTeam;
                        if (needsBell && (content === 'جرس' || content.toLowerCase() === 'jaras')) {
                            if (triedTeams.includes(player.team)) return;
                            setBuzzedTeam(player.team);
                            setBuzzedPlayer(player);
                            setAnswerTimer(answerDuration);
                            setLastAnswer({ text: '', correct: null });
                            setCurrentBuzzedAttempts(0);
                            playSfx('buzz');
                            return;
                        }

                        let turnTeam: 'team1' | 'team2' | null = null;
                        let mayAnswer = false;
                        if (openTurn && !transitioningToTeam) {
                            turnTeam = player.team;
                            mayAnswer = true;
                        } else if (buzzedTeam && !transitioningToTeam) {
                            turnTeam = buzzedTeam;
                            // no buzzer = the whole team is on the clock
                            mayAnswer = player.team === buzzedTeam && (!buzzedPlayer || player.username === buzzedPlayer.username);
                        }

                        if (mayAnswer && turnTeam && content !== 'جرس') {
                            if (!clockOpenRef.current) {
                                if (!lateAnswerLoggedRef.current) {
                                    lateAnswerLoggedRef.current = true;
                                    pushLog(`إجابة «${player.username}» وصلت بعد انتهاء الوقت — لم تحتسب`, 'sys');
                                }
                                return;
                            }
                            if (turnDecidedRef.current) return;

                            const claimedBy = turnTeam;

                            if (isCorrectAnswer(content, currentQuestion, activeCell.letter)) {
                                turnDecidedRef.current = true;
                                setLastAnswer({ text: content, correct: true });
                                playSfx('correct');
                                // The answering player claimed the cell this round — credit one 'round'.
                                awardPoints('LETTER_GAME', player.username, player.avatar || '', 'round');
                                setTimeout(() => finalizeRound(true, claimedBy), 1500);
                            } else {
                                const nextAttempts = currentBuzzedAttempts + 1;
                                setLastAnswer({ text: content, correct: false });
                                playSfx('wrong');
                                if (nextAttempts >= 2) {
                                    turnDecidedRef.current = true;
                                    setTimeout(() => handleWrongAnswer(true, claimedBy), 1500);
                                } else {
                                    setCurrentBuzzedAttempts(nextAttempts);
                                }
                            }
                        }
                    }
                }
            } catch (err) {
                console.error("Chat process error:", err);
            }
        });
        return cleanup;
    }, [stage, entryKeyword, team1Name, team2Name, activeCell, currentQuestion, buzzedTeam, buzzedPlayer, openTurn, lobbyPlayers, triedTeams, answerDuration, transitioningToTeam, currentBuzzedAttempts, votingActive, letterVotes, votingEligibleTeam, votedUsers, cells]);

    // Voting Countdown Logic (Manager Only)
    useEffect(() => {
        if (!isOBS && votingActive && votingTimer > 0) {
            const t = setInterval(() => {
                setVotingTimer(prev => {
                    if (prev <= 1) {
                        setVotingActive(false);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(t);
        }
    }, [isOBS, votingActive, votingTimer]);

    // No longer using Supabase buzzer channel as the game is now "Direct Chat Only"

    const playSfx = (type: 'buzz' | 'correct' | 'wrong' | 'win' | 'timer' | 'click') => {
        if (sfxMutedRef.current) return;
        const urls = {
            buzz: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
            correct: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
            wrong: 'https://assets.mixkit.co/active_storage/sfx/2959/2959-preview.mp3',
            win: 'https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3',
            timer: 'https://assets.mixkit.co/active_storage/sfx/2803/2803-preview.mp3',
            click: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3'
        };
        try { const audio = new Audio(urls[type]); audio.volume = 0.6; audio.play(); } catch (e) { }
    };

    const startGame = () => {
        // Deterministic shuffle based on currentLevel
        const seededRandom = (seed: number) => {
            let currentSeed = seed;
            return () => {
                currentSeed = (currentSeed * 9301 + 49297) % 233280;
                return currentSeed / 233280;
            };
        };

        const rnd = seededRandom(currentLevel * 1000);
        const shuffled = [...ARABIC_LETTERS].sort(() => rnd() - 0.5);

        let lIdx = 0;
        const initialCells: HexCellData[] = [];
        GRID_LAYOUT.forEach((cols, rowIdx) => {
            for (let colIdx = 0; colIdx < cols; colIdx++) {
                initialCells.push({ id: initialCells.length, row: rowIdx, col: colIdx, letter: shuffled[lIdx++], owner: 'none' });
            }
        });
        setCells(initialCells);
        setStage('playing');
        setWinner(null);
        setWinningPath([]);
        setGameLog([]);

        // Immediate and direct broadcast
        if (!isOBS && broadcastRef.current) {
            broadcastRef.current.send({
                type: 'broadcast',
                event: 'STATE_UPDATE',
                payload: {
                    cells: initialCells,
                    stage: 'playing',
                    winner: null,
                    winningPath: [],
                    lobbyPlayers, team1Name, team2Name, entryKeyword, answerDuration, difficulty, currentLevel
                }
            });
        }
    };

    const getNeighbors = (id: number) => {
        const cell = cells.find(c => c.id === id);
        if (!cell) return [];
        const neighbors: number[] = [];
        const evenRowNeighbors = [[-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]];
        const oddRowNeighbors = [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]];
        const deltas = (cell.row % 2 === 0) ? evenRowNeighbors : oddRowNeighbors;

        deltas.forEach(([dr, dc]) => {
            const nr = cell.row + dr, nc = cell.col + dc;
            const found = cells.find(c => c.row === nr && c.col === nc);
            if (found) neighbors.push(found.id);
        });
        return neighbors;
    };

    const checkWin = (updatedCells: HexCellData[]) => {
        const team1Ids = updatedCells.filter(c => c.owner === 'team1').map(c => c.id);
        const team2Ids = updatedCells.filter(c => c.owner === 'team2').map(c => c.id);

        const topEdge = updatedCells.filter(c => c.row === 0).map(c => c.id);
        const bottomEdge = updatedCells.filter(c => c.row === 4).map(c => c.id);
        const leftEdge = updatedCells.filter(c => c.col === 0).map(c => c.id);
        const rightEdge = updatedCells.filter(c => {
            if (c.row % 2 === 0) return c.col === 5;
            return c.col === 4;
        }).map(c => c.id);

        // Check Team 1 (الذهبي) - Top to Bottom
        const win1TB = findPath(topEdge.filter(id => team1Ids.includes(id)), bottomEdge, team1Ids);
        if (win1TB) { declareWinner('team1', win1TB); return; }

        // Check Team 2 (النحاسي) - Left to Right
        const win2LR = findPath(leftEdge.filter(id => team2Ids.includes(id)), rightEdge, team2Ids);
        if (win2LR) { declareWinner('team2', win2LR); return; }
    };

    const declareWinner = (team: 'team1' | 'team2', path: number[]) => {
        setWinner(team);
        setWinningPath(path);
        setStage('ended');
        playSfx('win');

        pushLog(`🏆 فاز ${team === 'team1' ? team1Name : team2Name} في المرحلة ${getArabicStageWord(currentLevel)}!`, team);

        // The winning team owns the whole board now — credit every one of its
        // players a 'match'. Guarded by the 'ended' stage transition.
        const winners = lobbyPlayers.filter(p => p.team === team).map(p => ({ username: p.username, avatar: p.avatar }));
        awardPointsToMany('LETTER_GAME', winners, 'match');

        // Save winner for current level
        setLevelWinners(prev => {
            const next = { ...prev, [currentLevel]: team };
            localStorage.setItem('iabs_letter_level_winners', JSON.stringify(next));
            return next;
        });

        if (currentLevel < 100) {
            const next = currentLevel + 1;
            setCurrentLevel(next);
            if (next > highestUnlocked) setHighestUnlocked(next);
        }
    };

    const findPath = (start: number[], end: number[], validSet: number[]) => {
        if (start.length === 0 || end.length === 0) return null;
        let queue: { id: number, path: number[] }[] = start.map(id => ({ id, path: [id] }));
        let visited = new Set(start);

        while (queue.length > 0) {
            let { id, path } = queue.shift()!;
            if (end.includes(id)) return path;
            for (let n of getNeighbors(id)) {
                if (validSet.includes(n) && !visited.has(n)) {
                    visited.add(n);
                    queue.push({ id: n, path: [...path, n] });
                }
            }
        }
        return null;
    };

    const handleWrongAnswer = (forceSkip = false, team?: 'team1' | 'team2') => {
        const currentTeam = team || buzzedTeam;
        if (!currentTeam) return;

        const otherTeam = currentTeam === 'team1' ? 'team2' : 'team1';

        setBuzzedTeam(null);
        setBuzzedPlayer(null);
        setAnswerTimer(0);
        setOpenTurn(false);
        setLastAnswer({ text: '', correct: null });
        setCurrentBuzzedAttempts(0);

        const newTried = [...triedTeams, currentTeam];
        setTriedTeams(newTried);

        if (newTried.length === 1) {
            // Start transition to other team
            setTransitioningToTeam(otherTeam);
            setTransitionTimer(4);
            playSfx('timer');
        } else {
            // Both teams failed, start transition to "Open for All"
            setTransitioningToTeam('open');
            setTransitionTimer(5);
            playSfx('timer');
            pushLog('استُنزفت محاولات الفريقين — السؤال مفتوح للأسرع', 'sys');
        }
    };

    // Transition Timer Effect — the turn starts on its own, no bell required
    useEffect(() => {
        if (transitionTimer > 0 && transitioningToTeam) {
            const t = setInterval(() => {
                setTransitionTimer(prev => {
                    if (prev <= 1) {
                        clearInterval(t);
                        setCurrentBuzzedAttempts(0);
                        setLastAnswer({ text: '', correct: null });
                        setAnswerTimer(answerDuration);
                        if (transitioningToTeam === 'open') {
                            setTriedTeams([]);
                            setOpenTurn(true);
                        } else {
                            setBuzzedTeam(transitioningToTeam);
                            setBuzzedPlayer(null);
                        }
                        setTransitioningToTeam(null);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(t);
        }
    }, [transitionTimer, transitioningToTeam, answerDuration]);

    const finalizeRound = (isCorrect: boolean, team: 'team1' | 'team2') => {
        if (!activeCell) return;
        const owner = isCorrect ? team : (team === 'team1' ? 'team2' : 'team1');
        const nextCells = cells.map(c => c.id === activeCell.id ? { ...c, owner } : c);
        setCells(nextCells);
        setActiveCell(null);
        setCurrentQuestion(null);
        setBuzzedTeam(null);
        setBuzzedPlayer(null);
        setAnswerTimer(0);
        setTriedTeams([]);
        setOpenTurn(false);
        setLastAnswer({ text: '', correct: null });
        setCurrentBuzzedAttempts(0);
        setTransitioningToTeam(null);
        setTransitionTimer(0);
        pushLog(`حرف «${activeCell.letter}» → ${owner === 'team1' ? team1Name : team2Name}`, owner);
        checkWin(nextCells);
    };

    const selectCell = (cell: HexCellData) => {
        if (cell.owner !== 'none' || winner) return;
        setActiveCell(cell);
        setBuzzedTeam(null);
        setBuzzedPlayer(null);
        setAnswerTimer(0);
        setTriedTeams([]);
        setOpenTurn(false);
        setLastAnswer({ text: '', correct: null });
        setAnswerRevealed(false);
        pushLog(`تم فتح حرف «${cell.letter}» للمنافسة`, 'sys');
        // Load a question specific to current level and cell
        const levelQs = getQuestionsForLevel(cell.letter, currentLevel);
        if (levelQs.length > 0) {
            // Picking the first one from the rotated list makes it deterministic for the level
            setCurrentQuestion(levelQs[0]);
        } else {
            setCurrentQuestion(null);
        }
    };

    // Timer Effect
    useEffect(() => {
        if (answerTimer > 0 && (buzzedTeam || openTurn)) {
            const t = setInterval(() => {
                setAnswerTimer(prev => {
                    if (prev <= 1) {
                        clearInterval(t);
                        // Show "Time Out" for a brief moment
                        setLastAnswer({ text: 'انتهى الوقت!', correct: false });
                        playSfx('wrong');
                        if (openTurn) {
                            // Nobody took the open question — close the cell, leave it free
                            setTimeout(() => {
                                setOpenTurn(false);
                                setActiveCell(null);
                                setCurrentQuestion(null);
                                setLastAnswer({ text: '', correct: null });
                                pushLog('انتهى الوقت — لم يأخذ أحد الخلية', 'sys');
                            }, 2000);
                        } else {
                            setTimeout(() => handleWrongAnswer(true), 2000);
                        }
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(t);
        }
    }, [answerTimer, buzzedTeam, openTurn]);

    // Mirror the clock for the chat listener; a new turn re-opens answer acceptance.
    useEffect(() => {
        const running = answerTimer > 0 && (!!buzzedTeam || openTurn);
        if (running && !clockOpenRef.current) {
            turnDecidedRef.current = false;
            lateAnswerLoggedRef.current = false;
        }
        clockOpenRef.current = running;
    }, [answerTimer, buzzedTeam, openTurn]);

    const women = lobbyPlayers.filter(p => p.team === 'team1');
    const men = lobbyPlayers.filter(p => p.team === 'team2');
    const t1cells = cells.filter(c => c.owner === 'team1').length;
    const t2cells = cells.filter(c => c.owner === 'team2').length;
    const maxVotes = Math.max(1, ...Object.values(letterVotes));

    return (
        <div className={`w-full h-full relative overflow-hidden select-none text-white font-sans ${isOBS ? 'bg-transparent' : 'bg-[#0a0805]'}`} dir="rtl">

            {/* ARENA BACKGROUND - iCG1 gold arena (hidden in OBS for transparency) */}
            {!isOBS && (
                <div className="absolute inset-0 z-0 pointer-events-none">
                    <div className="absolute inset-0" style={{ background: "url('/icg1-arena-bg.png') center/cover no-repeat" }} />
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(10,8,5,.5), rgba(10,8,5,.82))' }} />
                    <div className="absolute inset-0" style={{ background: 'conic-gradient(from 45deg at 50% 50%, rgba(240,194,90,.14) 0deg 90deg, rgba(210,130,74,.12) 90deg 180deg, rgba(240,194,90,.14) 180deg 270deg, rgba(210,130,74,.12) 270deg 360deg)' }} />
                    <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 45%, transparent 25%, rgba(5,3,1,.78) 100%)' }} />
                </div>
            )}

            {/* GOLD EMBER PARTICLES */}
            {!isOBS && (
                <div className="absolute inset-0 z-[1] pointer-events-none overflow-hidden">
                    {Array.from({ length: 20 }).map((_, i) => (
                        <div key={i} className="absolute rounded-full" style={{
                            width: `${3 + (i % 4)}px`,
                            height: `${3 + (i % 4)}px`,
                            left: `${(i * 5 + 3) % 100}%`,
                            bottom: '-2%',
                            background: 'radial-gradient(circle,#f0c46e,rgba(240,196,110,0))',
                            animation: `ember ${16 + (i % 6) * 3}s linear ${(i % 8) * 2.2}s infinite`,
                            opacity: 0
                        }} />
                    ))}
                </div>
            )}

            {/* SHARED SVG GRADIENTS */}
            <svg className="absolute w-0 h-0 overflow-hidden">
                <defs>
                    <linearGradient id="g-neutral" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style={{ stopColor: '#f7dd9c' }} />
                        <stop offset="55%" style={{ stopColor: '#b88a3c' }} />
                        <stop offset="100%" style={{ stopColor: '#e9c46f' }} />
                    </linearGradient>
                    <linearGradient id="g-well" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style={{ stopColor: '#2a1e0e' }} />
                        <stop offset="100%" style={{ stopColor: '#0d0904' }} />
                    </linearGradient>
                    <linearGradient id="g-team1" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style={{ stopColor: '#fff3c4' }} />
                        <stop offset="45%" style={{ stopColor: '#f0c25a' }} />
                        <stop offset="100%" style={{ stopColor: '#9a6a12' }} />
                    </linearGradient>
                    <linearGradient id="g-team2" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style={{ stopColor: '#f8cfa8' }} />
                        <stop offset="45%" style={{ stopColor: '#cf7c43' }} />
                        <stop offset="100%" style={{ stopColor: '#6b3213' }} />
                    </linearGradient>
                    <linearGradient id="g-obs" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style={{ stopColor: 'rgba(30,21,10,0.85)' }} />
                        <stop offset="100%" style={{ stopColor: 'rgba(10,7,4,0.9)' }} />
                    </linearGradient>
                    <linearGradient id="g-badge" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style={{ stopColor: '#fbe5a8' }} />
                        <stop offset="100%" style={{ stopColor: '#a6772c' }} />
                    </linearGradient>
                    <radialGradient id="g-badgein" cx="50%" cy="28%" r="75%">
                        <stop offset="0%" style={{ stopColor: '#fff6dc' }} />
                        <stop offset="100%" style={{ stopColor: '#f0d9a2' }} />
                    </radialGradient>
                    <filter id="ultra-glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="8" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                </defs>
            </svg>

            {/* OBS BADGES - Live + Stage */}
            {isOBS && (
                <div className="absolute top-6 left-6 z-[300] flex flex-col gap-2 animate-in slide-in-from-left-10 duration-500">
                    <div className="flex items-center gap-2 bg-black/40 px-4 py-2 rounded-full border border-emerald-500/30 backdrop-blur-md">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_#10b981]"></div>
                        <span className="text-emerald-400 font-black text-[9px] uppercase tracking-[0.2em] italic">Live Online</span>
                    </div>
                    <div className="flex items-center gap-2 bg-indigo-600/60 px-4 py-2 rounded-full border border-white/20 backdrop-blur-md shadow-xl">
                        <Trophy className="text-yellow-400" size={12} />
                        <span className="text-white font-black text-[10px] italic">المرحلة {getArabicStageWord(currentLevel)} / 100</span>
                    </div>
                </div>
            )}

            {/* SPECIALIZED OBS LOBBY/WAITING VIEW */}
            {isOBS && (stage === 'settings' || stage === 'lobby') && (
                <div className="relative z-50 w-full h-full flex flex-col items-center justify-center animate-in fade-in duration-1000 scale-[0.6] overflow-visible">
                    {/* Background Letters Design Grid (Prominent) */}
                    <div className="absolute inset-0 z-0 opacity-[0.15] flex items-center justify-center scale-150 transform rotate-12 grayscale">
                        <div className="relative" style={{ width: `${boardWidth}px`, height: `${boardHeight}px` }}>
                            {ARABIC_LETTERS.map((letter, idx) => {
                                const row = [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4][idx];
                                const col = [0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 5][idx];
                                const isOffset = row % 2 !== 0;
                                const left = (col * X_OFFSET) + (isOffset ? X_OFFSET / 2 : 0);
                                const top = row * Y_OFFSET;
                                return (
                                    <div key={idx} className="absolute" style={{ left: `${left}px`, top: `${top}px`, width: `${SVG_WIDTH}px`, height: `${SVG_HEIGHT}px` }}>
                                        <svg width={SVG_WIDTH} height={SVG_HEIGHT} className="absolute inset-0">
                                            <polygon points={hexPoints} fill="none" stroke="white" strokeWidth="2" />
                                        </svg>
                                        <div className="absolute inset-0 flex items-center justify-center text-white text-4xl font-black opacity-20">{letter}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-5xl">
                        {/* THE LOGO */}
                        <div className="relative group">
                            <div className="absolute -inset-6 bg-white/5 blur-3xl rounded-full scale-150 animate-pulse"></div>
                            <div className="flex items-center gap-6 mb-3 relative z-10">
                                <span className="text-[7rem] font-black italic tracking-tighter text-yellow-400 drop-shadow-[0_10px_25px_rgba(234,179,8,0.6)] animate-bounce">حروف</span>
                                <span className="text-4xl font-black italic tracking-tighter text-blue-400 mt-8">مع</span>
                                <span className="text-[7rem] font-black italic tracking-tighter text-red-500 drop-shadow-[0_10px_25px_rgba(239,68,68,0.6)]">منصور</span>
                            </div>
                            <div className="h-1.5 w-full bg-gradient-to-r from-transparent via-white/40 to-transparent rounded-full"></div>
                        </div>

                        {/* STATUS AREA */}
                        <div className="flex flex-col items-center gap-4">
                            {stage === 'settings' ? (
                                <div className="flex flex-col items-center gap-3">
                                    <div className={`px-8 py-3 border-2 rounded-full flex items-center gap-3 text-white font-black text-2xl italic shadow-xl ${isOBS ? 'bg-black/60 border-white/10' : 'bg-white/10 backdrop-blur-xl border-white/20'}`}>
                                        <Clock className="text-yellow-400 animate-spin-slow" size={24} />
                                        <span>بإنتظار تحضير الساحة...</span>
                                    </div>
                                    <p className="text-white/40 font-black text-xs uppercase tracking-[0.5em] animate-pulse">SETTING UP THE BATTLEFIELD</p>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-4">
                                    <div className="px-10 py-4 rounded-[2rem] border-4 border-white shadow-2xl transition-all duration-500 transform scale-110 flex flex-col items-center gap-2 animate-bounce" style={{ background: '#53fc18' }}>
                                        <div className="flex items-center gap-3">
                                            <Volume2 className="text-black animate-pulse" size={28} />
                                            <span className="text-black font-black text-3xl italic tracking-tighter">أكتب [ {entryKeyword} ] + اسم الفريق للدخول!</span>
                                        </div>
                                        <div className="text-[10px] font-black text-black/40 uppercase tracking-widest">JOIN THE BATTLE NOW</div>
                                    </div>

                                    {/* TEAMS PREVIEW */}
                                    <div className="grid grid-cols-2 gap-12 mt-6 w-full">
                                        {/* Team 1 — red */}
                                        <div className="flex flex-col items-center gap-4 group">
                                            <div className="relative">
                                                <div className="absolute -inset-4 bg-[#FF0000]/30 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                                <div className="w-28 h-28 bg-[#FF0000] border-4 border-white rounded-[2rem] flex items-center justify-center text-5xl shadow-2xl relative z-10 transform -rotate-3 group-hover:rotate-0 transition-transform">🔴</div>
                                            </div>
                                            <div className="text-center">
                                                <h3 className="text-2xl font-black text-[#FF0000] italic drop-shadow-lg">{team1Name}</h3>
                                                <div className="text-white/40 font-bold text-xs uppercase tracking-widest mt-1">THE QUEEN WARRIORS</div>
                                                <div className="mt-3 inline-block px-5 py-2 rounded-full bg-black/70 border-2 border-[#FF0000] text-white font-black text-base italic shadow-lg">اكتب: {entryKeyword} {cleanTeamName(team1Name)}</div>
                                                <div className="mt-4 flex flex-wrap justify-center gap-2 max-w-sm">
                                                    {women.slice(0, 3).map(p => (
                                                        <div key={p.username} className="animate-in zoom-in">
                                                            <ProAvatar username={p.username} url={p.avatar} size="w-10 h-10" className="overflow-visible" />
                                                        </div>
                                                    ))}
                                                    {women.length > 3 && (
                                                        <div className="relative w-10 h-10 group/crowd animate-in zoom-in">
                                                            <div className="absolute top-1 left-1 w-full h-full rounded-2xl bg-black/40 border border-white/5"></div>
                                                            <div className="relative w-full h-full rounded-2xl border-2 border-white/20 bg-black/60 overflow-hidden shadow-2xl flex flex-col items-center justify-center">
                                                                <div className="absolute inset-0 opacity-40">
                                                                    <ProAvatar username={women[3].username} url={women[3].avatar} size="w-full h-full" className="scale-110" />
                                                                </div>
                                                                <div className="relative z-10 flex flex-col items-center leading-none">
                                                                    <span className="text-xs font-black text-white">+{women.length - 3}</span>
                                                                    <Users size={10} className="text-white/60 mt-0.5" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {women.length === 0 && <div className="w-10 h-10 rounded-full border-2 border-dashed border-white/10 flex items-center justify-center text-white/10 uppercase text-[8px] font-black">Empty</div>}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Team 2 — blue */}
                                        <div className="flex flex-col items-center gap-4 group">
                                            <div className="relative">
                                                <div className="absolute -inset-4 bg-[#0066FF]/30 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                                <div className="w-28 h-28 bg-[#0066FF] border-4 border-white rounded-[2rem] flex items-center justify-center text-5xl shadow-2xl relative z-10 transform rotate-3 group-hover:rotate-0 transition-transform">🔵</div>
                                            </div>
                                            <div className="text-center">
                                                <h3 className="text-2xl font-black text-[#0066FF] italic drop-shadow-lg">{team2Name}</h3>
                                                <div className="text-white/40 font-bold text-xs uppercase tracking-widest mt-1">THE TITAN KINGS</div>
                                                <div className="mt-3 inline-block px-5 py-2 rounded-full bg-black/70 border-2 border-[#0066FF] text-white font-black text-base italic shadow-lg">اكتب: {entryKeyword} {cleanTeamName(team2Name)}</div>
                                                <div className="mt-4 flex flex-wrap justify-center gap-2 max-w-sm">
                                                    {men.slice(0, 3).map(p => (
                                                        <div key={p.username} className="animate-in zoom-in">
                                                            <ProAvatar username={p.username} url={p.avatar} size="w-10 h-10" className="overflow-visible" />
                                                        </div>
                                                    ))}
                                                    {men.length > 3 && (
                                                        <div className="relative w-10 h-10 group/crowd animate-in zoom-in">
                                                            <div className="absolute top-1 left-1 w-full h-full rounded-2xl bg-black/40 border border-white/5"></div>
                                                            <div className="relative w-full h-full rounded-2xl border-2 border-white/20 bg-black/60 overflow-hidden shadow-2xl flex flex-col items-center justify-center">
                                                                <div className="absolute inset-0 opacity-40">
                                                                    <ProAvatar username={men[3].username} url={men[3].avatar} size="w-full h-full" className="scale-110" />
                                                                </div>
                                                                <div className="relative z-10 flex flex-col items-center leading-none">
                                                                    <span className="text-xs font-black text-white">+{men.length - 3}</span>
                                                                    <Users size={10} className="text-white/60 mt-0.5" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {men.length === 0 && <div className="w-10 h-10 rounded-full border-2 border-dashed border-white/10 flex items-center justify-center text-white/10 uppercase text-[8px] font-black">Empty</div>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* BOTTOM HIGHLIGHT */}
                        <div className="absolute bottom-10 flex flex-col items-center animate-bounce">
                            <ChevronDown className="text-white/20" size={40} />
                            <span className="text-[9px] font-black text-white/10 uppercase tracking-[0.8em]">Get Ready For Battle</span>
                        </div>
                    </div>
                </div>
            )}

            {/* STAGE: PLAYING (OBS — classic layout, restored exactly, team colors gold/copper) */}
            {isOBS && stage === 'playing' && (
                <div className="relative w-full h-full flex flex-col items-center justify-center transition-all duration-1000 bg-transparent overflow-visible">
                    {/* OBS Specific Background Glow Grid */}
                    <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(90,34,163,0.1),transparent)]"></div>
                    </div>

                    {/* Scale Wrapper for OBS - Hide board elements when a cell is active in OBS */}
                    <div className={`w-full h-full flex flex-col items-center justify-center transition-all duration-700 scale-[0.5] overflow-visible ${activeCell ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>

                        {/* Center Header (With Level Indicator) */}
                        <div className="absolute top-[-120px] left-1/2 transform -translate-x-1/2 z-20 text-center">
                            <h1 className="text-5xl font-black italic text-white drop-shadow-[0_6px_12px_rgba(0,0,0,0.5)]">حروف</h1>
                        </div>

                        {/* BOARD */}
                        <div className="relative z-10 animate-in zoom-in slide-in-from-bottom-20 duration-1000 animate-[obsBoardFloat_10s_ease-in-out_infinite]" style={{ width: `${boardWidth}px`, height: `${boardHeight}px` }}>
                            {/* SVG Filters and Gradients Definitions - Reusable for all cells */}
                            <svg className="absolute w-0 h-0 overflow-hidden">
                                <defs>
                                    <linearGradient id="grad-neutral" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" style={{ stopColor: '#ffffff' }} />
                                        <stop offset="100%" style={{ stopColor: '#e2e8f0' }} />
                                    </linearGradient>
                                    <linearGradient id="grad-team1" x1="0%" y1="0%" x2="0%" y2="100%">
                                        <stop offset="0%" style={{ stopColor: '#ff4d4d' }} />
                                        <stop offset="100%" style={{ stopColor: '#FF0000' }} />
                                    </linearGradient>
                                    <linearGradient id="grad-team2" x1="0%" y1="0%" x2="0%" y2="100%">
                                        <stop offset="0%" style={{ stopColor: '#4d94ff' }} />
                                        <stop offset="100%" style={{ stopColor: '#0066FF' }} />
                                    </linearGradient>
                                    <linearGradient id="grad-winning" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" style={{ stopColor: '#FDE047' }} />
                                        <stop offset="100%" style={{ stopColor: '#EAB308' }} />
                                    </linearGradient>
                                    <linearGradient id="grad-obs-empty" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" style={{ stopColor: 'rgba(255,255,255,0.1)' }} />
                                        <stop offset="100%" style={{ stopColor: 'rgba(255,255,255,0.02)' }} />
                                    </linearGradient>
                                </defs>
                            </svg>
                            {cells.map(cell => {
                                const isOffset = cell.row % 2 !== 0;
                                const left = (cell.col * X_OFFSET) + (isOffset ? X_OFFSET / 2 : 0);
                                const top = cell.row * Y_OFFSET;
                                const isActive = activeCell?.id === cell.id;
                                const isWinning = winningPath.includes(cell.id);

                                let fillId = 'url(#grad-obs-empty)';
                                // Fix: Add solid background for active cell in OBS
                                if (isActive && cell.owner === 'none') fillId = 'url(#grad-neutral)';

                                let strokeColor = 'rgba(255,255,255,0.3)';
                                let letterColor = 'white';

                                if (cell.owner === 'team1') {
                                    fillId = 'url(#grad-team1)';
                                    strokeColor = '#5A22A3';
                                    letterColor = 'white';
                                } else if (cell.owner === 'team2') {
                                    fillId = 'url(#grad-team2)';
                                    strokeColor = '#5A22A3';
                                    letterColor = 'white';
                                }

                                return (
                                    <div key={cell.id} onClick={() => selectCell(cell)} className={`absolute flex items-center justify-center cursor-pointer transition-all duration-300 ${isActive ? 'scale-110 z-50 drop-shadow-[0_0_60px_rgba(255,255,255,0.9)]' : 'hover:scale-105 hover:z-40 z-10'} ${isWinning ? 'animate-bounce' : ''}`} style={{ left: `${left}px`, top: `${top}px`, width: `${SVG_WIDTH}px`, height: `${SVG_HEIGHT}px` }}>
                                        <svg width={SVG_WIDTH} height={SVG_HEIGHT} className="absolute inset-0 overflow-visible z-0">
                                            {/* Main Hex Body with Sci-Fi Borders */}
                                            <polygon points={hexPoints} fill={fillId} stroke={strokeColor} strokeWidth={4} strokeLinejoin="round" className={cell.owner === 'none' ? 'animate-[neonPulse_4s_infinite]' : ''} />

                                            {/* Inner Neon Line for OBS */}
                                            {cell.owner === 'none' && (
                                                <polygon points={hexPoints} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeLinejoin="round" style={{ transform: 'scale(0.85)', transformOrigin: 'center' }} />
                                            )}

                                            {/* Glass/Gloss Overlay - Enhanced */}
                                            <polygon
                                                points={hexPoints}
                                                fill="white"
                                                style={{ opacity: 0.05, transform: 'scale(0.95)', transformOrigin: 'center' }}
                                                className="pointer-events-none"
                                            />

                                            {isWinning && (
                                                <polygon points={hexPoints} fill="none" stroke="url(#grad-winning)" strokeWidth="15" strokeLinejoin="round" style={{ filter: 'url(#ultra-glow)' }} />
                                            )}
                                        </svg>

                                        {/* Stylized Letter - High Impact Typography */}
                                        <div className={`relative z-10 font-black mt-2 select-none transition-all duration-500 italic text-[3rem] animate-[letterGlow_5s_infinite] ${cell.owner !== 'none' ? 'scale-75 opacity-30 blur-[1px]' : 'scale-100'}`} style={{ color: letterColor, textShadow: '0 6px 25px rgba(0,0,0,0.9), 0 0 8px rgba(255,255,255,0.4)' }}>
                                            {cell.letter}
                                        </div>

                                        {/* Selection FX - Multi-layer Heavy Duty */}
                                        {isActive && (
                                            <>
                                                <div className="absolute inset-[-25px] border-[6px] border-dashed border-white/60 rounded-full animate-[spin_4s_linear_infinite] z-[-1]"></div>
                                                <div className="absolute inset-[-35px] border-[2px] border-white/20 rounded-full animate-[spin_10s_linear_reverse_infinite] z-[-2]"></div>
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* QUESTION OVERLAY (NOW PRESET-FREE) */}
                    {activeCell && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in zoom-in duration-300">
                            {/* In OBS, use a solid black background for the modal area when active */}
                            <div className="absolute inset-0 bg-black/90 backdrop-blur-3xl animate-in fade-in duration-500"></div>

                            <div className="w-full max-w-xl bg-[#0a0a1a] border-4 border-[#5A22A3] rounded-[2rem] p-6 shadow-[0_0_60px_rgba(0,0,0,1)] relative z-10 text-center transition-all duration-500 scale-[0.8]">
                                <div className="flex flex-col items-center gap-8">
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-white/20 blur-2xl rounded-full scale-125 animate-pulse"></div>
                                        <div className="px-8 py-3 rounded-[1.5rem] bg-white border-4 border-[#5A22A3] text-black font-black text-5xl italic shadow-xl relative z-10 leading-none">
                                            {activeCell.letter}
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        {currentQuestion ? (
                                            <>
                                                <h2 className="text-3xl font-black text-white leading-tight drop-shadow-lg animate-in slide-in-from-bottom duration-700">{currentQuestion.question}</h2>
                                            </>
                                        ) : (
                                            <>
                                                <h2 className="text-3xl font-black text-white italic drop-shadow-lg">تحدي الحرف!</h2>
                                                <p className="text-2xl font-bold text-white/60">اكتب كلمة تبدأ بحرف <span className="text-white font-black">{activeCell.letter}</span></p>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-10">
                                    {/* Buzzer Area remains here */}
                                </div>

                                {transitioningToTeam ? (
                                    <div className="space-y-6 animate-in zoom-in duration-500 py-6">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="relative">
                                                <div className={`absolute -inset-8 blur-3xl rounded-full opacity-30 animate-pulse ${transitioningToTeam === 'open' ? 'bg-yellow-500' : transitioningToTeam === 'team1' ? 'bg-[#FF0000]' : 'bg-[#0066FF]'}`}></div>
                                                <div className={`w-28 h-28 rounded-[2rem] ${transitioningToTeam === 'open' ? 'bg-yellow-500' : transitioningToTeam === 'team1' ? 'bg-[#FF0000]' : 'bg-[#0066FF]'} border-4 border-white flex items-center justify-center text-6xl shadow-2xl relative z-10 animate-bounce`}>
                                                    {transitioningToTeam === 'open' ? '⚡' : transitioningToTeam === 'team1' ? '🔴' : '🔵'}
                                                </div>
                                            </div>
                                            <div className="text-center px-4">
                                                <p className="text-white/60 font-black text-lg mb-3 italic uppercase tracking-[0.2em]">
                                                    {transitioningToTeam === 'open' ? 'انتهت محاولات الفريقين !!' : 'تم استنفاذ المحاولات !!'}
                                                </p>
                                                <h3 className="text-3xl md:text-4xl font-black text-white italic drop-shadow-2xl">
                                                    {transitioningToTeam === 'open' ? 'السؤال الآن للمجموعة الأسرع!' : `الدور الآن لـ ${transitioningToTeam === 'team1' ? team1Name : team2Name}`}
                                                </h3>
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-center gap-3">
                                            <div className="relative w-20 h-20">
                                                <svg className="w-full h-full transform -rotate-90">
                                                    <circle cx="40" cy="40" r="34" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-white/10" />
                                                    <circle cx="40" cy="40" r="34" stroke="currentColor" strokeWidth="6" fill="transparent" className={`${transitioningToTeam === 'open' ? 'text-yellow-500' : transitioningToTeam === 'team1' ? 'text-[#FF0000]' : 'text-[#0066FF]'}`} strokeDasharray={213} strokeDashoffset={213 - (transitionTimer / (transitioningToTeam === 'open' ? 5 : 4)) * 213} style={{ transition: 'stroke-dashoffset 1s linear' }} />
                                                </svg>
                                                <div className="absolute inset-0 flex items-center justify-center text-3xl font-black text-white italic tabular-nums">
                                                    {transitionTimer}
                                                </div>
                                            </div>
                                            <span className="text-white/30 font-black text-[9px] uppercase tracking-[0.5em]">
                                                {transitioningToTeam === 'open' ? 'Opening for All' : 'Starting Turn'}
                                            </span>
                                        </div>
                                    </div>
                                ) : openTurn ? (
                                    <div className="space-y-6 animate-in zoom-in">
                                        <div className="p-4 rounded-[1.5rem] border-3 flex items-center justify-between gap-4 border-yellow-500 bg-yellow-500/20 shadow-[0_0_30px_rgba(234,179,8,0.35)]">
                                            <div className="flex items-center justify-between gap-4 flex-1 min-w-0">
                                                <div className="flex -space-x-3 shrink-0">
                                                    <div className="w-14 h-14 rounded-xl bg-[#FF0000] border-3 border-white flex items-center justify-center text-2xl shadow-lg">🔴</div>
                                                    <div className="w-14 h-14 rounded-xl bg-[#0066FF] border-3 border-white flex items-center justify-center text-2xl shadow-lg">🔵</div>
                                                </div>
                                                <div className="text-right min-w-0 flex-1">
                                                    <div className="text-2xl font-black text-white italic drop-shadow-md">السؤال مفتوح للجميع !!</div>
                                                    <div className="text-lg font-black mt-1 uppercase tracking-widest text-yellow-400">أول إجابة صحيحة تأخذ الخلية</div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-center bg-black/40 px-4 py-2 rounded-2xl border border-white/10">
                                                <div className={`text-4xl font-black italic tabular-nums drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] ${answerTimer <= 3 ? 'text-red-400' : 'text-white'}`}>
                                                    {answerTimer}s
                                                </div>
                                            </div>
                                        </div>

                                        {lastAnswer.text ? (
                                            <div className={`p-4 rounded-2xl border-3 text-center animate-in slide-in-from-bottom flex flex-col items-center gap-2 ${lastAnswer.correct === true ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-red-500/20 border-red-500 text-red-400'}`}>
                                                <div className="text-xs font-black uppercase tracking-widest opacity-60">الإجابة المكتوبة:</div>
                                                <div className="text-2xl font-black">{lastAnswer.text}</div>
                                                <div className="p-2 bg-white/10 rounded-full">
                                                    {lastAnswer.correct === true ? <Check size={24} /> : <X size={24} />}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center gap-4 animate-pulse p-6 bg-white/5 rounded-2xl border-2 border-dashed border-white/10">
                                                <BrainCircuit size={48} className="text-purple-500" />
                                                <h4 className="text-2xl font-black text-white italic">اكتبوا الإجابة في الشات الآن — بدون جرس !!</h4>
                                            </div>
                                        )}
                                    </div>
                                ) : buzzedTeam ? (
                                    <div className="space-y-6 animate-in zoom-in">
                                        <div className={`p-4 rounded-[1.5rem] border-3 flex items-center justify-between gap-4 transition-all duration-500 ${buzzedTeam === 'team1' ? 'border-[#FF0000] bg-[#FF0000]/20 shadow-[0_0_30px_rgba(255,0,0,0.3)]' : 'border-[#0066FF] bg-[#0066FF]/20 shadow-[0_0_30px_rgba(0,102,255,0.3)]'}`}>
                                            <div className="flex items-center gap-4">
                                                {buzzedPlayer && (
                                                    <div className="relative">
                                                        <div className={`absolute -inset-2 blur-lg rounded-full animate-pulse ${buzzedTeam === 'team1' ? 'bg-[#FF0000]/40' : 'bg-[#0066FF]/40'}`}></div>
                                                        <ProAvatar username={buzzedPlayer.username} url={buzzedPlayer.avatar} size="w-24 h-24" className="overflow-visible relative z-10" />
                                                    </div>
                                                )}
                                                <div className="text-right">
                                                    {buzzedPlayer ? (
                                                        <>
                                                            <div className="text-2xl font-black text-white italic drop-shadow-md">{buzzedPlayer.username}</div>
                                                            <div className={`text-lg font-black mt-1 uppercase tracking-widest ${buzzedTeam === 'team1' ? 'text-[#FF0000]' : 'text-[#0066FF]'}`}>{buzzedTeam === 'team1' ? team1Name : team2Name}</div>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <div className="text-2xl font-black text-white italic drop-shadow-md">الدور للفريق بدون جرس!</div>
                                                            <div className={`text-lg font-black mt-1 uppercase tracking-widest ${buzzedTeam === 'team1' ? 'text-[#FF0000]' : 'text-[#0066FF]'}`}>{buzzedTeam === 'team1' ? team1Name : team2Name} — جاوبوا على طول</div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="flex gap-1.5">
                                                    {[1, 2].map(attempt => (
                                                        <div key={attempt} className={`w-3 h-3 rounded-full border-2 ${currentBuzzedAttempts >= attempt ? 'bg-red-500 border-red-400 shadow-[0_0_8px_red]' : 'bg-white/10 border-white/20'}`}></div>
                                                    ))}
                                                </div>
                                                <div className="flex flex-col items-center bg-black/40 px-4 py-2 rounded-2xl border border-white/10">
                                                    <div className="text-4xl font-black text-white italic tabular-nums drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]">
                                                        {answerTimer}s
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {lastAnswer.text ? (
                                            <div className={`p-4 rounded-2xl border-3 text-center animate-in slide-in-from-bottom flex flex-col items-center gap-2 ${lastAnswer.correct === true ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-red-500/20 border-red-500 text-red-400'}`}>
                                                <div className="text-xs font-black uppercase tracking-widest opacity-60">الإجابة المكتوبة:</div>
                                                <div className="text-2xl font-black">{lastAnswer.text}</div>
                                                <div className="p-2 bg-white/10 rounded-full">
                                                    {lastAnswer.correct === true ? <Check size={24} /> : <X size={24} />}
                                                </div>
                                                {lastAnswer.correct === false && currentBuzzedAttempts === 1 && (
                                                    <div className="text-lg font-bold italic animate-pulse">محاولة أخيرة !!</div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center gap-4 animate-pulse p-6 bg-white/5 rounded-2xl border-2 border-dashed border-white/10">
                                                <BrainCircuit size={48} className="text-purple-500" />
                                                <h4 className="text-2xl font-black text-white italic">اكتب الإجابة في الشات !!</h4>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-6 p-6 bg-white/5 rounded-2xl border-2 border-dashed border-white/10 relative overflow-hidden">
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-[shimmer_2s_infinite]"></div>

                                        <div className="flex gap-8 items-center">
                                            <div className={`flex flex-col items-center gap-2 transition-opacity ${triedTeams.includes('team1') ? 'opacity-20 grayscale' : 'opacity-100'}`}>
                                                <div className="w-12 h-12 rounded-xl bg-[#FF0000] border-3 border-[#5A22A3] flex items-center justify-center text-white shadow-lg">🔴</div>
                                                <span className="text-[9px] font-black text-[#FF0000] uppercase mt-1 truncate max-w-[70px]">{team1Name}</span>
                                            </div>

                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-20 h-20 bg-[#5A22A3] rounded-[1.5rem] flex items-center justify-center shadow-2xl animate-bounce border-3 border-white/20">
                                                    <BellRing size={36} className="text-white" />
                                                </div>
                                                <h4 className="text-2xl font-black text-white italic tracking-tight">أكتب "جرس" للرن!</h4>
                                            </div>

                                            <div className={`flex flex-col items-center gap-2 transition-opacity ${triedTeams.includes('team2') ? 'opacity-20 grayscale' : 'opacity-100'}`}>
                                                <div className="w-12 h-12 rounded-xl bg-[#0066FF] border-3 border-[#5A22A3] flex items-center justify-center text-white shadow-lg">🔵</div>
                                                <span className="text-[9px] font-black text-[#0066FF] uppercase mt-1 truncate max-w-[70px]">{team2Name}</span>
                                            </div>
                                        </div>

                                        {triedTeams.length === 1 && (
                                            <div className="bg-red-500/20 text-red-500 px-4 py-1.5 rounded-full font-black text-xs border border-red-500/30 animate-pulse">
                                                ⚠️ الفريق الأول أخطأ.. الدور للفريق الثاني!
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* STAGE: ENDED (OBS — classic celebration screen, team colors gold/copper) */}
            {isOBS && stage === 'ended' && (
                <div className="absolute inset-0 z-[200] flex items-center justify-center overflow-hidden bg-transparent">
                    {/* GLOBAL BACKGROUND - Celebration mode */}
                    <div className="absolute inset-0 z-0">
                        <div className={`absolute inset-0 transition-colors duration-1000 ${winner === 'team1' ? 'bg-[#FF0000]/20' : 'bg-[#0066FF]/20'}`} />
                        {/* CSS PARTICLES */}
                        {Array.from({ length: 50 }).map((_, i) => (
                            <div key={i}
                                className={`absolute rounded-full animate-[obsFloat_10s_ease-in-out_infinite] ${winner === 'team1' ? 'bg-[#FF0000]' : 'bg-[#0066FF]'}`}
                                style={{
                                    width: `${Math.random() * 8 + 4}px`,
                                    height: `${Math.random() * 8 + 4}px`,
                                    top: `${Math.random() * 100}%`,
                                    left: `${Math.random() * 100}%`,
                                    animationDelay: `${Math.random() * 5}s`,
                                    opacity: Math.random() * 0.5 + 0.2,
                                    filter: 'blur(1px)'
                                }}
                            />
                        ))}
                    </div>

                    {/* Main Content */}
                    <div className="relative z-10 flex flex-col items-center gap-4 max-w-lg w-full px-4 text-center animate-in zoom-in duration-700">
                        {/* WINNER TITLE */}
                        <div className="flex flex-col items-center gap-3 animate-in slide-in-from-top-20 duration-[1000ms]">
                            <div className={`flex items-center gap-2 px-4 py-1.5 bg-white/5 border-2 rounded-full backdrop-blur-md ${winner === 'team1' ? 'border-[#FF0000]/30' : 'border-[#0066FF]/30'}`}>
                                <Trophy size={14} className="text-yellow-400" />
                                <span className="text-white font-black text-xs uppercase tracking-widest italic">نصر رائع!</span>
                                <Trophy size={14} className="text-yellow-400" />
                            </div>

                            <div className="relative mt-3">
                                <h1 className={`text-[3rem] font-black italic tracking-tighter leading-none select-none animate-pulse ${winner === 'team1' ? 'text-[#FF0000]' : 'text-[#0066FF]'}`}>
                                    فـــــــــــــــــاز
                                </h1>
                                <div className={`absolute -inset-8 blur-3xl opacity-20 animate-pulse ${winner === 'team1' ? 'bg-[#FF0000]' : 'bg-[#0066FF]'}`}></div>
                            </div>
                        </div>

                        {/* BIG TEAM CARD */}
                        <div className={`relative w-full max-w-sm py-6 px-4 rounded-[2rem] border-3 shadow-2xl flex flex-col items-center gap-4 animate-in zoom-in duration-700 delay-300 ${winner === 'team1' ? 'bg-black/60 border-[#FF0000]/50' : 'bg-black/60 border-[#0066FF]/50'}`}>
                            <div className={`absolute inset-0 rounded-[2rem] animate-pulse ${winner === 'team1' ? 'shadow-[0_0_30px_rgba(255,0,0,0.3)]' : 'shadow-[0_0_30px_rgba(0,102,255,0.3)]'}`}></div>
                            <div className="relative group">
                                <div className={`w-28 h-28 rounded-[1.5rem] flex items-center justify-center text-5xl border-4 shadow-2xl transition-transform duration-500 group-hover:scale-105 ${winner === 'team1' ? 'bg-[#FF0000] border-white/20' : 'bg-[#0066FF] border-white/20'}`}>
                                    {winner === 'team1' ? '🔴' : '🔵'}
                                </div>
                                <div className="absolute -top-4 -right-4 w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center border-3 border-[#0a0a1a] shadow-xl rotate-12 animate-bounce">
                                    <Crown size={24} className="text-black" />
                                </div>
                            </div>

                            <div className="space-y-3 relative z-10 text-center">
                                <h2 className="text-4xl font-black italic tracking-tighter drop-shadow-lg text-white animate-pulse">
                                    {winner === 'team1' ? team1Name : team2Name}
                                </h2>
                                <div className={`mx-auto h-1 w-24 rounded-full ${winner === 'team1' ? 'bg-[#FF6B52]' : 'bg-[#14b8a6]'}`}></div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 w-full mt-3">
                                <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/5 text-center">
                                    <div className="text-white/40 font-black text-[9px] uppercase mb-1">المرحلة</div>
                                    <div className="text-2xl font-black text-white italic">{getArabicStageWord(currentLevel - 1)}</div>
                                </div>
                                <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/5 text-center">
                                    <div className="text-white/40 font-black text-[9px] uppercase mb-1">المحاربين</div>
                                    <div className="text-2xl font-black text-white italic">{winner === 'team1' ? women.length : men.length}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* STAGE: SETTINGS (HIDDEN IN OBS) */}
            {!isOBS && stage === 'settings' && (
                <div className="relative z-20 w-full h-full flex flex-col items-center justify-center p-6 animate-in fade-in duration-700">
                    <div className="max-w-3xl w-full rounded-[2.5rem] p-8 relative overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,.85),0_0_60px_rgba(232,190,110,.08)] border border-[#e8be6e]/40 backdrop-blur-2xl" style={{ background: 'linear-gradient(165deg,rgba(40,29,14,.92),rgba(10,7,4,.94))' }}>

                        <div className="absolute top-0 left-0 w-full h-1.5" style={{ background: 'linear-gradient(90deg,#a97a30,#f9e0a4,#cf7c43,#a97a30)' }}></div>

                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-2xl flex items-center justify-center border-2 shadow-xl" style={{ background: 'rgba(232,190,110,.12)', borderColor: 'rgba(232,190,110,.5)', boxShadow: '0 0 25px rgba(232,190,110,.2)' }}>
                                    <Settings size={28} className="text-[#e8be6e] animate-spin-slow" />
                                </div>
                                <div>
                                    <h1 className="text-3xl font-extrabold italic tracking-tighter" style={{ color: '#fbeccb', fontFamily: FONT_DISPLAY }}>إعدادات اللعبة</h1>
                                    <p className="text-[#b2a283] font-bold uppercase tracking-widest mt-1 text-xs">تجهيز ساحة المعركة</p>
                                </div>
                            </div>
                            <button onClick={onHome} className="p-4 rounded-2xl transition-all shadow-xl group border-2 border-[#cf7c43]/40 bg-[#cf7c43]/10 text-[#d2824a] hover:bg-[#cf7c43] hover:text-[#fff3e2]">
                                <LogOut size={22} className="group-hover:rotate-12 transition-transform" />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-6 mb-8">
                            <div className="space-y-4">
                                <div className="p-4 rounded-[1.5rem] border-2 transition-all hover:border-[#e8be6e]/40 bg-white/[.04] border-white/[.07]">
                                    <label className="flex items-center gap-2 text-xs font-black text-[#b2a283] mb-3 tracking-widest uppercase"><Stars size={14} className="text-[#e8be6e]" /> كلمة دخول المشاركين</label>
                                    <input value={entryKeyword} onChange={e => setEntryKeyword(e.target.value)} className="w-full bg-black/50 border-2 border-[#e8be6e]/20 rounded-2xl p-4 text-center font-extrabold text-xl focus:border-[#e8be6e] transition-all outline-none text-[#fbeccb] shadow-inner" />
                                </div>
                                <div className="p-4 rounded-[1.5rem] border-2 transition-all hover:border-[#f0c25a]/40 bg-white/[.04] border-white/[.07]">
                                    <label className="flex items-center gap-2 text-xs font-black text-[#b2a283] mb-3 tracking-widest uppercase"><Crown size={14} className="text-[#f0c25a]" /> اسم الفريق الذهبي</label>
                                    <input value={team1Name} onChange={e => setTeam1Name(e.target.value)} className="w-full bg-black/50 border-2 border-[#f0c25a]/20 rounded-2xl p-4 text-center font-extrabold text-xl focus:border-[#f0c25a] transition-all outline-none text-[#fbeccb] shadow-inner" />
                                </div>
                                <div className="p-4 rounded-[1.5rem] border-2 transition-all hover:border-[#cf7c43]/40 bg-white/[.04] border-white/[.07]">
                                    <label className="flex items-center gap-2 text-xs font-black text-[#b2a283] mb-3 tracking-widest uppercase"><Swords size={14} className="text-[#cf7c43]" /> اسم الفريق النحاسي</label>
                                    <input value={team2Name} onChange={e => setTeam2Name(e.target.value)} className="w-full bg-black/50 border-2 border-[#cf7c43]/20 rounded-2xl p-4 text-center font-extrabold text-xl focus:border-[#cf7c43] transition-all outline-none text-[#fbeccb] shadow-inner" />
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="p-4 rounded-[1.5rem] border-2 bg-white/[.04] border-white/[.07]">
                                    <label className="flex items-center gap-2 text-xs font-black text-[#b2a283] mb-3 tracking-widest uppercase"><BellRing size={14} className="text-[#e8be6e]" /> نظام اللعب</label>
                                    <div className="p-4 rounded-2xl text-center border-2" style={{ background: 'rgba(232,190,110,.08)', borderColor: 'rgba(232,190,110,.35)' }}>
                                        <div className="text-lg font-extrabold italic" style={{ color: '#e8be6e' }}>نظام الجرس المباشر (شات)</div>
                                        <div className="text-[9px] text-[#fbeccb]/40 mt-1 uppercase tracking-widest font-black">اكتب "جرس" في الشات للرن</div>
                                    </div>
                                </div>
                                <div className="p-4 rounded-[1.5rem] border-2 bg-white/[.04] border-white/[.07]">
                                    <label className="flex items-center gap-2 text-xs font-black text-[#b2a283] mb-3 tracking-widest uppercase"><BrainCircuit size={14} className="text-[#cf7c43]" /> مستوى الصعوبة</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button onClick={() => setDifficulty('normal')} className={`py-4 rounded-2xl text-base font-black border-2 transition-all ${difficulty === 'normal' ? 'text-[#1a1006] shadow-xl border-white' : 'bg-black/50 border-white/10 text-[#b2a283]/50 opacity-60'}`} style={difficulty === 'normal' ? { background: 'linear-gradient(180deg,#f9e0a4,#b88a3e)' } : undefined}>عادي</button>
                                        <button onClick={() => setDifficulty('hard')} className={`py-4 rounded-2xl text-base font-black border-2 transition-all ${difficulty === 'hard' ? 'text-[#1a1006] shadow-xl border-white' : 'bg-black/50 border-white/10 text-[#b2a283]/50 opacity-60'}`} style={difficulty === 'hard' ? { background: 'linear-gradient(180deg,#f9e0a4,#b88a3e)' } : undefined}>صعب جداً</button>
                                    </div>
                                </div>
                                <div className="p-4 rounded-[1.5rem] border-2 bg-white/[.04] border-white/[.07]">
                                    <label className="flex items-center justify-between text-xs font-black text-[#b2a283] mb-3 tracking-widest uppercase">
                                        <span className="flex items-center gap-2"><Clock size={14} className="text-[#e8be6e]" /> مدة الإجابة (بعد الجرس)</span>
                                        <span className="text-[#e8be6e]">{answerDuration} ثانية</span>
                                    </label>
                                    <input type="range" min="10" max="60" step="1" value={answerDuration} onChange={e => setAnswerDuration(parseInt(e.target.value))} className="w-full h-2 bg-black rounded-full appearance-none accent-[#e8be6e] shadow-inner" />
                                </div>
                                <div className="p-4 rounded-[1.5rem] border-2 shadow-2xl" style={{ background: 'rgba(232,190,110,.05)', borderColor: 'rgba(232,190,110,.25)' }}>
                                    <label className="flex items-center justify-between text-xs font-black text-[#e8be6e] mb-2 tracking-widest uppercase">
                                        <span className="flex items-center gap-2"><Trophy size={14} /> أعلى مرحلة وصلتها</span>
                                        <span className="text-[#fbeccb] text-lg">{getArabicStageWord(highestUnlocked)} / 100</span>
                                    </label>
                                    <div className="h-2 bg-black/50 rounded-full overflow-hidden border border-[#e8be6e]/20">
                                        <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${highestUnlocked}%`, background: 'linear-gradient(90deg,#a97a30,#f9e0a4)' }}></div>
                                    </div>
                                    <p className="text-[#fbeccb]/30 text-[10px] mt-2 font-bold italic">الانتقال للمراحل يتم من خريطة المراحل</p>
                                </div>
                            </div>
                        </div>

                        <button onClick={() => { setStage('levelSelect'); setShowInstructions(true); playSfx('click'); }} className="w-full transition-all py-6 rounded-2xl font-extrabold text-2xl text-[#1a1006] shadow-[0_15px_35px_rgba(232,190,110,.35)] border-b-4 border-black/30 flex items-center justify-center gap-4 group hover:scale-[1.02] active:scale-95" style={{ background: 'linear-gradient(180deg,#f9e0a4,#b88a3e)', fontFamily: FONT_DISPLAY }}>
                            <Trophy size={28} className="group-hover:rotate-12 transition-transform" /> اختر مرحلتك <ArrowRight size={32} className="group-hover:translate-x-4 transition-transform" />
                        </button>
                    </div>
                </div>
            )}

            {/* STAGE: LEVEL SELECT MAP — GOLD WORLDS */}
            {/* STAGE: LEVEL SELECT — CLASSIC ISLAND MAP (gold/copper palette) */}
            {!isOBS && stage === 'levelSelect' && (() => {
                const goldIsland = { filter: 'sepia(0.85) saturate(1.5) hue-rotate(-8deg) brightness(1.2) contrast(1.05)' };
                const worlds = [
                    { id: 1, name: 'الغابة الخضراء', range: [1, 20] as [number, number], color: '#f9e0a4', glow: 'rgba(249,224,164,0.4)', image: '/island_green.png', desc: 'أسئلة سهلة ومرحة للجميع' },
                    { id: 2, name: 'قمم الجليد', range: [21, 40] as [number, number], color: '#e8be6e', glow: 'rgba(232,190,110,0.4)', image: '/island_ice.png', desc: 'أسئلة متوسطة للمتحدين' },
                    { id: 3, name: 'وادي الحمم', range: [41, 60] as [number, number], color: '#c99743', glow: 'rgba(201,151,67,0.4)', image: '/island_lava.png', desc: 'أسئلة صعبة للمحترفين' },
                    { id: 4, name: 'عرين التنين', range: [61, 80] as [number, number], color: '#d2824a', glow: 'rgba(210,130,74,0.4)', image: '/island_lava.png', desc: 'أسئلة صعبة جداً للأبطال' },
                    { id: 5, name: 'عالم الأساطير', range: [81, 100] as [number, number], color: '#a97a30', glow: 'rgba(169,122,48,0.45)', image: '/island_purple.png', desc: 'أسئلة للخبراء فقط' },
                ];
                return (
                    <div className="absolute inset-0 z-[100] bg-[#0a0805] flex flex-col items-center overflow-hidden animate-in fade-in duration-700">
                        {/* Immersive Space Background */}
                        <div className="absolute inset-0 pointer-events-none opacity-40">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#241a0c,transparent)]"></div>
                            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30"></div>
                        </div>

                        {/* Top Navigation Header */}
                        <div className="flex w-full items-center justify-between px-12 pt-6 pb-4 z-20 shrink-0">
                            <button onClick={() => setStage('settings')} className="group flex items-center gap-3 bg-white/5 hover:bg-white/10 px-6 py-3 rounded-full border border-white/10 text-white font-black italic transition-all hover:-translate-x-2">
                                <ArrowLeft size={22} className="group-hover:animate-pulse" /> الرجوع للإعدادات
                            </button>
                            <div className="text-center relative">
                                <h1 className="text-5xl font-black italic text-white drop-shadow-[0_3px_10px_rgba(0,0,0,0.5)] relative z-10">🗺️ خريطة العوالم</h1>
                                <p className="text-[#e8be6e]/60 font-bold text-xs tracking-[0.5em] mt-1 uppercase">Your Epic Journey Starts Here</p>
                            </div>
                            <div className="flex items-center gap-4">
                                {/* WIN COUNTER SUMMARY */}
                                <div className="flex items-center bg-black/40 backdrop-blur-2xl px-6 py-2 rounded-xl border border-[#e8be6e]/15 shadow-xl">
                                    <div className="flex flex-col items-center">
                                        <span className="text-[#f0c25a] font-black text-[10px] uppercase tracking-widest">فوز الذهبي</span>
                                        <span className="text-white font-black text-2xl italic">{Object.values(levelWinners).filter(v => v === 'team1').length}</span>
                                    </div>
                                    <div className="w-px h-10 bg-white/10 mx-4"></div>
                                    <div className="flex flex-col items-center">
                                        <span className="text-[#cf7c43] font-black text-[10px] uppercase tracking-widest">فوز النحاسي</span>
                                        <span className="text-white font-black text-2xl italic">{Object.values(levelWinners).filter(v => v === 'team2').length}</span>
                                    </div>
                                </div>

                                <div className="px-6 py-3 rounded-xl text-[#1a1006] font-black text-xl shadow-xl shadow-[#e8be6e]/20 border-2 border-[#fff6dc]/60" style={{ background: 'linear-gradient(180deg,#f9e0a4,#b88a3e)' }}>
                                    المستوى المفتوح: {getArabicStageWord(highestUnlocked)}
                                </div>
                            </div>
                        </div>

                        {/* Map Scrollable Core */}
                        <div className="flex-1 w-full px-8 pb-20 overflow-y-auto overflow-x-hidden gold-scroll relative">
                            {/* Floating Clouds Background */}
                            <div className="absolute inset-0 pointer-events-none">
                                {Array.from({ length: 12 }).map((_, i) => (
                                    <div key={i} className="absolute blur-3xl bg-[#e8be6e] rounded-full translate-x-1/2 opacity-[0.03]"
                                        style={{
                                            width: `${Math.random() * 500 + 300}px`,
                                            height: `${Math.random() * 200 + 100}px`,
                                            top: `${Math.random() * 4000}px`,
                                            left: `${Math.random() * 100}%`,
                                            animation: `float ${Math.random() * 25 + 20}s linear infinite alternate`
                                        }} />
                                ))}
                            </div>

                            {worlds.map(world => (
                                <div key={world.id} className="mb-40 relative z-10 first:mt-20">
                                    {/* Major World Entryway - BALANCED PROPORTIONS */}
                                    <div className="flex flex-col items-center mb-32 group">
                                        {/* Island - Sized for clarity not dominance */}
                                        <div className="relative w-[260px] h-[190px] transition-all duration-1000 group-hover:scale-110">
                                            <div className={`absolute inset-0 blur-[60px] rounded-full opacity-20 filter`} style={{ backgroundColor: world.color }}></div>
                                            <img src={world.image} className="w-full h-full object-contain drop-shadow-[0_30px_50px_rgba(0,0,0,0.8)] animate-[float_10s_ease-in-out_infinite]" style={goldIsland} />
                                        </div>

                                        {/* Name Below Island - Sized for readability */}
                                        <div className="mt-8 flex flex-col items-center w-full">
                                            <h2 className="text-[4vw] font-black italic tracking-tighter drop-shadow-[0_8px_25px_rgba(0,0,0,1)] leading-[0.9] mb-4 whitespace-nowrap" style={{ color: world.color }}>{world.name}</h2>
                                            <div className="bg-white/5 backdrop-blur-3xl px-8 py-2 rounded-xl border border-[#e8be6e]/15 shadow-2xl">
                                                <p className="text-white font-black text-xl tracking-widest italic uppercase opacity-80">{world.desc}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Level Zig-Zag Trail */}
                                    <div className="flex flex-col gap-32 items-center w-full">
                                        {Array.from({ length: Math.ceil(20 / 4) }).map((_, rowIndex) => (
                                            <div key={rowIndex} className={`flex gap-24 md:gap-32 lg:gap-40 items-center ${rowIndex % 2 !== 0 ? 'flex-row-reverse' : 'flex-row'}`}>
                                                {Array.from({ length: 4 }).map((_, colIndex) => {
                                                    const lvl = world.range[0] + rowIndex * 4 + colIndex;
                                                    if (lvl > world.range[1]) return null;

                                                    const isCompleted = lvl < highestUnlocked;
                                                    const isLocked = lvl > highestUnlocked;
                                                    const isCurrent = lvl === currentLevel;

                                                    return (
                                                        <div key={lvl} className="relative group">
                                                            {/* Path Overlay */}
                                                            {colIndex < 3 && lvl < world.range[1] && (
                                                                <div className={`absolute top-1/2 ${rowIndex % 2 === 0 ? 'left-full w-24 md:w-32 lg:w-40' : 'right-full w-24 md:w-32 lg:w-40'} h-2 border-t-6 border-dashed ${isLocked ? 'border-[#e8be6e]/10 opacity-40' : 'border-[#e8be6e]/25'} z-0`}></div>
                                                            )}

                                                            <button
                                                                onClick={() => { if (!isLocked) { setCurrentLevel(lvl); setStage('lobby'); } }}
                                                                className={`relative w-36 h-60 transition-all duration-700 hover:scale-110 active:scale-95 flex flex-col items-center justify-center group ${isLocked ? 'cursor-not-allowed grayscale brightness-90 opacity-60' : 'cursor-pointer'}`}
                                                            >
                                                                 <div className={`relative z-20 w-18 h-18 rounded-[1.5rem] flex items-center justify-center font-black text-xs border-3 shadow-2xl transition-all duration-700 transform ${isLocked ? 'bg-[#120d06] border-[#e8be6e]/15 text-[#e8be6e]/30 scale-90' : isCurrent ? 'bg-[#f9e0a4] border-white text-black scale-125 shadow-[0_0_40px_rgba(249,224,164,0.7)] rotate-3' : isCompleted ? (levelWinners[lvl] === 'team1' ? 'bg-[#f0c25a] border-[#ffd97a] text-[#2b1a05] shadow-[#f0c25a]/40 shadow-xl' : 'bg-[#cf7c43] border-[#e9b582] text-white shadow-[#cf7c43]/40 shadow-xl') : 'bg-[#1a1208] border-[#e8be6e]/15 text-[#b2a283]/50 group-hover:text-white'}`}>
                                                                     {isLocked ? <Shield size={24} /> : isCompleted ? <Check size={28} strokeWidth={4} /> : <span className="leading-none">{getArabicStageWord(lvl)}</span>}
                                                                    {!isLocked && (
                                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0.5 h-14 bg-gradient-to-b from-[#e8be6e]/40 to-transparent blur-[1px]"></div>
                                                                    )}
                                                                </div>

                                                                <div className="mt-8 group-hover:scale-115 transition-transform duration-1000">
                                                                    <div className="relative w-28 h-28">
                                                                        <img src={world.image} className={`w-full h-full object-contain drop-shadow-[0_20px_30px_rgba(0,0,0,1)] ${isLocked ? 'opacity-45 blur-[1px]' : 'filter brightness-110'} animate-[float_8s_ease-in-out_infinite]`} style={{ ...goldIsland, animationDelay: `${lvl * 0.3}s` }} />
                                                                    </div>
                                                                </div>

                                                                {isCurrent && (
                                                                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-[#f9e0a4] text-black px-4 py-1 rounded-full font-black text-[9px] uppercase tracking-widest border-2 border-white animate-bounce shadow-xl">
                                                                        المرحلة الحالية ⚔️
                                                                    </div>
                                                                )}
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })()}

            {/* INSTRUCTIONS MODAL */}
            {showInstructions && (
                <div className="absolute inset-0 z-[500] flex items-center justify-center p-6 animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setShowInstructions(false)}></div>
                    <div className="relative w-full max-w-3xl rounded-[2.5rem] border-2 border-[#e8be6e]/50 shadow-[0_40px_120px_rgba(0,0,0,.9),0_0_60px_rgba(232,190,110,.15)] overflow-hidden animate-in zoom-in-95 duration-300" style={{ background: 'linear-gradient(165deg,rgba(40,29,14,.97),rgba(10,7,4,.98))' }}>
                        <div className="absolute top-0 left-0 w-full h-1.5" style={{ background: 'linear-gradient(90deg,#a97a30,#f9e0a4,#cf7c43,#a97a30)' }}></div>
                        <button onClick={() => setShowInstructions(false)} className="absolute top-5 left-5 w-11 h-11 rounded-2xl bg-[#cf7c43]/15 border-2 border-[#cf7c43]/40 text-[#d2824a] flex items-center justify-center hover:bg-[#cf7c43] hover:text-[#fff3e2] transition-all z-20"><X size={20} /></button>
                        <div className="p-9 pt-12 max-h-[80vh] overflow-y-auto gold-scroll">
                            <div className="text-center mb-8">
                                <div className="inline-flex items-center gap-3 mb-3">
                                    <div className="h-px w-16 bg-gradient-to-l from-transparent to-[#e8be6e]/60"></div>
                                    <h2 className="text-4xl font-extrabold italic gtitle" style={{ fontFamily: FONT_DISPLAY }}>قوانين الساحة</h2>
                                    <div className="h-px w-16 bg-gradient-to-r from-transparent to-[#e8be6e]/60"></div>
                                </div>
                                <p className="text-[#b2a283] font-bold text-sm">كل شي تحتاج تعرفه قبل تبدأ معركة الحروف</p>
                            </div>
                            <div className="grid md:grid-cols-2 gap-4 mb-6">
                                <div className="rounded-[1.5rem] p-5 border-2" style={{ background: 'rgba(232,190,110,.06)', borderColor: 'rgba(240,194,90,.35)' }}>
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(160deg,#f0c25a,#8f5f12)' }}><Crown size={22} className="text-[#2b1a05]" /></div>
                                        <div>
                                            <h3 className="text-xl font-extrabold italic text-[#f0c25a]" style={{ fontFamily: FONT_DISPLAY }}>{team1Name}</h3>
                                            <p className="text-[10px] text-[#b2a283] font-black uppercase tracking-widest">يبنون من الأعلى إلى الأسفل ↕</p>
                                        </div>
                                    </div>
                                    <p className="text-[#fbeccb]/80 text-sm font-bold leading-relaxed">هدفهم ربط خلية علوية بأي خلية سفلى عبر سلسلة خلايا يملكونها. كل جواب صحيح يفتح لهم خلية جديدة.</p>
                                </div>
                                <div className="rounded-[1.5rem] p-5 border-2" style={{ background: 'rgba(210,130,74,.06)', borderColor: 'rgba(207,124,67,.35)' }}>
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(160deg,#cf7c43,#6b3213)' }}><Swords size={22} className="text-[#fff3e2]" /></div>
                                        <div>
                                            <h3 className="text-xl font-extrabold italic text-[#cf7c43]" style={{ fontFamily: FONT_DISPLAY }}>{team2Name}</h3>
                                            <p className="text-[10px] text-[#b2a283] font-black uppercase tracking-widest">يبنون من اليمين إلى الشمال ↔</p>
                                        </div>
                                    </div>
                                    <p className="text-[#fbeccb]/80 text-sm font-bold leading-relaxed">هدفهم ربط حافة يمين الساحة بحافة شمالها. أول فريق يكمل رباطه ينتصر فوراً وينهي المرحلة.</p>
                                </div>
                            </div>
                            <div className="space-y-3 mb-6">
                                {[
                                    { icon: <Users size={18} />, t: '٠ — الانضمام لفريقك', d: `في صفحة الانتظار اكتب في الشات «${entryKeyword} ${cleanTeamName(team1Name)}» أو «${entryKeyword} ${cleanTeamName(team2Name)}» حسب الفريق اللي تبيه. اسم الفريق مكتوب عند كل فريق.` },
                                    { icon: <BellRing size={18} />, t: '١ — اكتب «جرس»', d: 'أي لاعب من الفريقين يستطيع رنّ الجرس على الخلية المفتوحة. الفريق الذي جرّب يخسر حقه بالتناوب. الجرس مرة واحدة فقط — بعد الخطأ الدور يروح للفريق الثاني وهو جاهز للجواب بدون جرس.' },
                                    { icon: <BrainCircuit size={18} />, t: '٢ — جاوب بالإجابة نفسها', d: 'الإجابة المطلوبة كلمة واحدة — اكتبها كما هي، و«ال» والتشكيل ما يفرقون. جواب خاطئ مرتين أو انتهاء الوقت = الخسارة. بعد فشل الفريقين السؤال يصير مفتوحاً للأسرع — بدون جرس، وأول إجابة صحيحة تأخذ الخلية.' },
                                    { icon: <Vote size={18} />, t: '٣ — صوت على الحرف', d: 'خلال التصويت المفتوح اكتب الحرف اللي تبيه في الشات، وأكثر حرف تصويتاً هو اللي ينفتح للمنافسة.' },
                                    { icon: <Trophy size={18} />, t: '٤ — انتصر وكسّب فريقك', d: 'كل خلية تُفتح لفريقك نقطتين للجولة، والفوز بالمرحلة يرفعك لعالم أبعد في الخريطة.' },
                                ].map((r, i) => (
                                    <div key={i} className="flex items-start gap-4 p-4 rounded-2xl bg-white/[.04] border border-[#e8be6e]/15 hover:border-[#e8be6e]/40 transition-colors">
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-[#e8be6e] border border-[#e8be6e]/30 bg-[#e8be6e]/10">{r.icon}</div>
                                        <div>
                                            <h4 className="font-extrabold text-[#fbeccb] italic" style={{ fontFamily: FONT_DISPLAY }}>{r.t}</h4>
                                            <p className="text-[#b2a283] text-sm font-bold mt-0.5 leading-relaxed">{r.d}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button onClick={() => setShowInstructions(false)} className="w-full py-5 rounded-2xl font-extrabold text-xl text-[#1a1006] shadow-[0_12px_30px_rgba(232,190,110,.3)] border-b-4 border-black/30 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3" style={{ background: 'linear-gradient(180deg,#f9e0a4,#b88a3e)', fontFamily: FONT_DISPLAY }}>
                                <Check size={24} strokeWidth={4} /> فهمت، جهّزوا الجرس!
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* STAGE: LOBBY (MANAGER VIEW) */}
            {!isOBS && stage === 'lobby' && (
                <div className="relative z-20 w-full h-full flex flex-col p-8 animate-in fade-in duration-700">
                    {/* LOBBY HEADER */}
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <button onClick={() => setStage('levelSelect')} className="w-14 h-14 rounded-2xl flex items-center justify-center border-2 border-[#e8be6e]/30 bg-[#e8be6e]/10 text-[#e8be6e] hover:bg-[#e8be6e] hover:text-[#1a1006] transition-all active:scale-90"><ArrowRight size={24} /></button>
                            <div>
                                <div className="flex items-center gap-3">
                                    <h1 className="text-4xl font-extrabold italic tracking-tighter gtitle" style={{ fontFamily: FONT_DISPLAY }}>حروف</h1>
                                    <span className="text-lg font-extrabold italic text-[#fbeccb]/50 mt-1" style={{ fontFamily: FONT_DISPLAY }}>مع</span>
                                    <h1 className="text-4xl font-extrabold italic tracking-tighter ctitle" style={{ fontFamily: FONT_DISPLAY }}>منصور</h1>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="w-2 h-2 rounded-full" style={{ background: getWorldForLevel(currentLevel).color }}></span>
                                    <span className="text-[#b2a283] font-bold text-xs uppercase tracking-[0.3em]">المرحلة {getArabicStageWord(currentLevel)} • {getWorldForLevel(currentLevel).name}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={() => setShowInstructions(true)} className="flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-sm border-2 transition-all bg-[#cf7c43]/10 border-[#cf7c43]/40 text-[#d2824a] hover:bg-[#cf7c43] hover:text-[#fff3e2]"><Sparkles size={18} /> القوانين</button>
                            <button onClick={() => setSfxMuted(m => !m)} title={sfxMuted ? 'تشغيل الأصوات' : 'كتم الأصوات'} className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all ${sfxMuted ? 'bg-[#cf7c43]/15 border-[#cf7c43]/40 text-[#d2824a]' : 'bg-[#e8be6e]/10 border-[#e8be6e]/30 text-[#e8be6e]'}`}>{sfxMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}</button>
                            <button onClick={onHome} className="w-12 h-12 rounded-2xl flex items-center justify-center border-2 border-[#cf7c43]/40 bg-[#cf7c43]/10 text-[#d2824a] hover:bg-[#cf7c43] hover:text-[#fff3e2] transition-all"><LogOut size={20} /></button>
                        </div>
                    </div>

                    <div className="flex-1 grid grid-cols-2 gap-8 overflow-hidden">
                        {/* TEAM 1 PANEL — GOLD */}
                        <div className="rounded-[2rem] p-6 flex flex-col border-2 relative overflow-hidden" style={{ background: 'linear-gradient(165deg,rgba(40,29,14,.9),rgba(10,7,4,.92))', borderColor: 'rgba(240,194,90,.4)', boxShadow: '0 20px 60px rgba(0,0,0,.6), inset 0 0 40px rgba(240,194,90,.05)' }}>
                            <div className="absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl opacity-15" style={{ background: '#f0c25a' }}></div>
                            <div className="flex items-center justify-between mb-5 relative z-10">
                                <div className="flex items-center gap-3">
                                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(160deg,#f0c25a,#8f5f12)', border: '2px solid rgba(255,246,220,.5)' }}><Crown size={26} className="text-[#2b1a05]" /></div>
                                    <div>
                                        <h3 className="text-2xl font-extrabold italic text-[#f0c25a]" style={{ fontFamily: FONT_DISPLAY }}>{team1Name}</h3>
                                        <div className="text-[#e8be6e]/40 text-[10px] font-black uppercase tracking-widest">THE GOLD TEAM • ↕ أعلى ↔ أسفل</div>
                                        <div className="mt-1 inline-flex w-fit items-center gap-1 px-3 py-1 rounded-full text-[11px] font-black italic text-[#1a1006] shadow" style={{ background: 'linear-gradient(180deg,#f9e0a4,#b88a3e)' }}>للدخول اكتب: {entryKeyword} {cleanTeamName(team1Name)}</div>
                                    </div>
                                </div>
                                <div className="px-4 py-2 rounded-full bg-[#f0c25a]/15 border border-[#f0c25a]/30 text-[#f0c25a] font-black text-lg italic">{women.length}</div>
                            </div>
                            <div className="flex-1 flex flex-wrap content-start gap-3 overflow-y-auto gold-scroll pr-1 relative z-10">
                                {women.map(p => (
                                    <div key={p.username} className="flex flex-col items-center gap-1 animate-in zoom-in duration-300">
                                        <ProAvatar username={p.username} url={p.avatar} size="w-14 h-14" className="overflow-visible" />
                                        <span className="text-[10px] font-black text-[#fbeccb]/70 max-w-[5rem] truncate">{p.username}</span>
                                    </div>
                                ))}
                                {women.length === 0 && <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-[#e8be6e]/25"><Users size={36} /><span className="font-black text-sm italic">لا لاعبين بعد...</span></div>}
                                <div className="w-14 h-14 rounded-2xl border-2 border-dashed border-[#f0c25a]/25 flex items-center justify-center text-[#f0c25a]/30 animate-pulse"><Users size={16} /></div>
                            </div>
                            <div className="mt-auto relative z-10 flex items-center justify-center gap-2.5 py-3.5 rounded-2xl border-2 border-[#f0c25a]/25 bg-[#f0c25a]/[.06]">
                                <span className="relative w-2 h-2 shrink-0">
                                    <span className="absolute inset-0 rounded-full bg-[#6fdc9e] opacity-60 animate-ping"></span>
                                    <span className="absolute inset-0 rounded-full" style={{ background: '#6fdc9e', boxShadow: '0 0 10px #6fdc9e' }}></span>
                                </span>
                                <span className="text-[12px] font-black italic tracking-[0.22em] text-[#f0c25a]/85">مفتوح للانضمام</span>
                            </div>
                        </div>

                        {/* TEAM 2 PANEL — COPPER */}
                        <div className="rounded-[2rem] p-6 flex flex-col border-2 relative overflow-hidden" style={{ background: 'linear-gradient(165deg,rgba(40,29,14,.9),rgba(10,7,4,.92))', borderColor: 'rgba(207,124,67,.4)', boxShadow: '0 20px 60px rgba(0,0,0,.6), inset 0 0 40px rgba(207,124,67,.05)' }}>
                            <div className="absolute top-0 left-0 w-40 h-40 rounded-full blur-3xl opacity-15" style={{ background: '#cf7c43' }}></div>
                            <div className="flex items-center justify-between mb-5 relative z-10">
                                <div className="flex items-center gap-3">
                                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(160deg,#cf7c43,#6b3213)', border: '2px solid rgba(255,240,225,.4)' }}><Swords size={26} className="text-[#fff3e2]" /></div>
                                    <div>
                                        <h3 className="text-2xl font-extrabold italic text-[#cf7c43]" style={{ fontFamily: FONT_DISPLAY }}>{team2Name}</h3>
                                        <div className="text-[#cf7c43]/40 text-[10px] font-black uppercase tracking-widest">THE COPPER TEAM • ↔ يمين ↔ شمال</div>
                                        <div className="mt-1 inline-flex w-fit items-center gap-1 px-3 py-1 rounded-full text-[11px] font-black italic text-[#2b1a05] shadow" style={{ background: 'linear-gradient(180deg,#e9b582,#8a4a1e)' }}>للدخول اكتب: {entryKeyword} {cleanTeamName(team2Name)}</div>
                                    </div>
                                </div>
                                <div className="px-4 py-2 rounded-full bg-[#cf7c43]/15 border border-[#cf7c43]/30 text-[#cf7c43] font-black text-lg italic">{men.length}</div>
                            </div>
                            <div className="flex-1 flex flex-wrap content-start gap-3 overflow-y-auto gold-scroll pr-1 relative z-10">
                                {men.map(p => (
                                    <div key={p.username} className="flex flex-col items-center gap-1 animate-in zoom-in duration-300">
                                        <ProAvatar username={p.username} url={p.avatar} size="w-14 h-14" className="overflow-visible" />
                                        <span className="text-[10px] font-black text-[#fbeccb]/70 max-w-[5rem] truncate">{p.username}</span>
                                    </div>
                                ))}
                                {men.length === 0 && <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-[#cf7c43]/25"><Users size={36} /><span className="font-black text-sm italic">لا لاعبين بعد...</span></div>}
                                <div className="w-14 h-14 rounded-2xl border-2 border-dashed border-[#cf7c43]/25 flex items-center justify-center text-[#cf7c43]/30 animate-pulse"><Users size={16} /></div>
                            </div>
                            <div className="mt-auto relative z-10 flex items-center justify-center gap-2.5 py-3.5 rounded-2xl border-2 border-[#cf7c43]/25 bg-[#cf7c43]/[.06]">
                                <span className="relative w-2 h-2 shrink-0">
                                    <span className="absolute inset-0 rounded-full bg-[#6fdc9e] opacity-60 animate-ping"></span>
                                    <span className="absolute inset-0 rounded-full" style={{ background: '#6fdc9e', boxShadow: '0 0 10px #6fdc9e' }}></span>
                                </span>
                                <span className="text-[12px] font-black italic tracking-[0.22em] text-[#cf7c43]/85">مفتوح للانضمام</span>
                            </div>
                        </div>
                    </div>

                    {/* LOBBY FOOTER — JOIN BANNER + CONTROLS */}
                    <div className="mt-8 flex items-center justify-between gap-6">
                        <div className="flex-1 rounded-[2rem] p-5 border-2 border-[#e8be6e]/60 bg-[#e8be6e]/10 shadow-[0_0_40px_rgba(232,190,110,.15)] flex items-center justify-between transition-all">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-[linear-gradient(180deg,#f9e0a4,#b88a3e)] text-[#1a1006] animate-pulse"><BellRing size={24} /></div>
                                <div>
                                    <div className="font-extrabold italic text-2xl text-[#e8be6e]" style={{ fontFamily: FONT_DISPLAY }}>
                                        أكتب <span className="text-[#fbeccb] bg-black/50 px-4 py-1 rounded-xl border border-[#e8be6e]/40 text-xl">[ {entryKeyword} ]</span> + اسم الفريق للدخول!
                                    </div>
                                    <div className="flex items-center gap-2 mt-1.5">
                                        <span className="px-3 py-1 rounded-full text-[10px] font-black italic text-[#1a1006]" style={{ background: 'linear-gradient(180deg,#f9e0a4,#b88a3e)' }}>{entryKeyword} {cleanTeamName(team1Name)}</span>
                                        <span className="px-3 py-1 rounded-full text-[10px] font-black italic text-[#2b1a05]" style={{ background: 'linear-gradient(180deg,#e9b582,#8a4a1e)' }}>{entryKeyword} {cleanTeamName(team2Name)}</span>
                                        <span className="text-[10px] font-black uppercase tracking-[0.35em]" style={{ color: 'rgba(232,190,110,.5)' }}>WRITE دخول + TEAM NAME</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button onClick={() => { const url = `${window.location.origin}/?obs=true&view=LETTER_GAME&transparent=true`; navigator.clipboard.writeText(url); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); }}
                                    className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-black transition-all border-2 shadow-lg text-sm ${linkCopied ? 'bg-[#6fdc9e]/15 border-[#6fdc9e]/50 text-[#6fdc9e]' : 'bg-[#e8be6e]/5 border-[#e8be6e]/30 text-[#e8be6e] hover:bg-[#e8be6e]/15'}`}>
                                    {linkCopied ? <Check size={18} /> : <Link size={18} />} {linkCopied ? 'تم النسخ' : 'رابط OBS'}
                                </button>
                                <div className="px-4 py-3 rounded-2xl border border-[#e8be6e]/20 bg-black/40 text-center">
                                    <span className="text-[9px] font-black text-[#b2a283] uppercase tracking-widest block">المجموع</span>
                                    <span className="text-xl font-extrabold italic text-[#fbeccb]">{lobbyPlayers.length}</span>
                                </div>
                            </div>
                        </div>
                        <button onClick={startGame} disabled={lobbyPlayers.length < 2}
                            className={`flex items-center gap-4 px-10 py-5 rounded-[1.8rem] font-black text-3xl italic shadow-2xl transition-all select-none border-b-4 border-black/30 ${lobbyPlayers.length < 2 ? 'bg-[#241a0c] text-[#b2a283]/30 cursor-not-allowed border-none shadow-none' : 'text-[#1a1006] hover:scale-105 active:scale-95 animate-goldpulse'}`}
                            style={lobbyPlayers.length < 2 ? undefined : { background: 'linear-gradient(180deg,#f9e0a4,#b88a3e)', fontFamily: FONT_DISPLAY }}>
                            <Play fill="currentColor" size={28} /> {lobbyPlayers.length < 2 ? 'لاعبان على الأقل' : 'بـدء الـتـحـدي'}
                        </button>
                    </div>
                </div>
            )}

            {/* STAGE: PLAYING + ENDED (shared board view — manager only, OBS has its own classic view below) */}
            {!isOBS && (stage === 'playing' || stage === 'ended') && (
                <div className="relative z-20 w-full h-full flex animate-in fade-in duration-700 overflow-hidden">

                    {/* RIGHT COLUMN — TEAM 1 CARD + GAME LOG (manager only) */}
                    {!isOBS && (
                        <div className="w-[290px] shrink-0 flex flex-col gap-4 p-5 z-30">
                            <div className="rounded-[1.8rem] p-5 border-2 relative overflow-hidden" style={{ background: 'linear-gradient(165deg,rgba(40,29,14,.9),rgba(10,7,4,.92))', borderColor: 'rgba(240,194,90,.4)', boxShadow: '0 15px 45px rgba(0,0,0,.5)' }}>
                                <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl opacity-20" style={{ background: '#f0c25a' }}></div>
                                <div className="flex items-center gap-3 mb-4 relative z-10">
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg group" style={{ background: 'linear-gradient(160deg,#f0c25a,#8f5f12)', border: '2px solid rgba(255,246,220,.5)' }}><Crown size={22} className="text-[#2b1a05]" /></div>
                                    <div className="min-w-0">
                                        <h3 className="text-base font-extrabold italic text-[#f0c25a] truncate" style={{ fontFamily: FONT_DISPLAY }}>{team1Name}</h3>
                                        <div className="text-[9px] text-[#e8be6e]/40 font-black uppercase tracking-widest">↕ أعلى ↔ أسفل</div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 relative z-10">
                                    <div className="rounded-xl p-2.5 text-center border border-[#f0c25a]/20 bg-[#f0c25a]/5">
                                        <div className="text-xl font-extrabold italic text-[#fbeccb] leading-none">{t1cells}</div>
                                        <div className="text-[9px] font-black text-[#b2a283] mt-1">⬡ خلية</div>
                                    </div>
                                    <div className="rounded-xl p-2.5 text-center border border-[#f0c25a]/20 bg-[#f0c25a]/5">
                                        <div className="text-xl font-extrabold italic text-[#fbeccb] leading-none flex items-center justify-center gap-1">{t1cells}<Trophy size={11} className="text-[#f0c25a]" /></div>
                                        <div className="text-[9px] font-black text-[#b2a283] mt-1">جولة</div>
                                    </div>
                                </div>
                                <div className="mt-3 pt-3 border-t border-[#f0c25a]/15 text-[10px] font-bold text-[#b2a283] italic relative z-10">هدفهم: ربط الحافة العلوية بالسفلية</div>
                            </div>

                            {/* GAME LOG */}
                            <div className="flex-1 rounded-[1.8rem] p-4 border-2 min-h-0 flex flex-col" style={{ background: 'linear-gradient(165deg,rgba(40,29,14,.85),rgba(10,7,4,.9))', borderColor: 'rgba(232,190,110,.2)' }}>
                                <div className="flex items-center gap-2 mb-3">
                                    <Sparkles size={14} className="text-[#e8be6e]" />
                                    <h4 className="text-xs font-black text-[#e8be6e] uppercase tracking-[0.25em] italic">سجل اللعبة</h4>
                                </div>
                                <div className="flex-1 overflow-y-auto gold-scroll space-y-2 min-h-0">
                                    {gameLog.length === 0 && <div className="text-[#b2a283]/30 text-xs font-bold italic text-center pt-6">ابدأ ليمتلئ السجل...</div>}
                                    {gameLog.map(entry => (
                                        <div key={entry.id} className="text-[11px] font-bold leading-snug rounded-lg px-3 py-2 bg-white/[.04] text-[#fbeccb]/80 animate-in slide-in-from-top-2 duration-300" style={{ borderInlineStart: `3px solid ${entry.team === 'team1' ? '#f0c25a' : entry.team === 'team2' ? '#cf7c43' : 'rgba(232,190,110,.3)'}` }}>
                                            {entry.text}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* CENTER — ARENA + BOARD */}
                    <div className="flex-1 relative flex items-center justify-center overflow-visible">
                        {/* GOAL EDGE STRIPS */}
                        <div className={`absolute top-0 left-[10%] right-[10%] h-2 z-10 pointer-events-none ${isOBS ? 'opacity-80' : 'opacity-60'}`} style={{ background: 'linear-gradient(90deg,transparent,#f0c25a,transparent)' }}></div>
                        <div className={`absolute bottom-0 left-[10%] right-[10%] h-2 z-10 pointer-events-none ${isOBS ? 'opacity-80' : 'opacity-60'}`} style={{ background: 'linear-gradient(90deg,transparent,#f0c25a,transparent)' }}></div>
                        <div className={`absolute right-2 top-[15%] bottom-[15%] w-2 z-10 pointer-events-none ${isOBS ? 'opacity-80' : 'opacity-60'}`} style={{ background: 'linear-gradient(180deg,transparent,#cf7c43,transparent)' }}></div>
                        <div className={`absolute left-2 top-[15%] bottom-[15%] w-2 z-10 pointer-events-none ${isOBS ? 'opacity-80' : 'opacity-60'}`} style={{ background: 'linear-gradient(180deg,transparent,#cf7c43,transparent)' }}></div>

                        {/* MANAGER TOP CHROME — TITLE + TOOLS */}
                        {!isOBS && (
                            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 pointer-events-none">
                                <div className="flex items-center gap-3 pointer-events-auto">
                                    <div className="flex items-center gap-2 px-5 py-2 rounded-full border-2 text-sm font-extrabold italic" style={{ background: 'linear-gradient(165deg,rgba(40,29,14,.9),rgba(10,7,4,.92))', borderColor: 'rgba(232,190,110,.4)', color: '#e8be6e', fontFamily: FONT_DISPLAY }}>
                                        <Trophy size={15} /> المرحلة {getArabicStageWord(currentLevel)}
                                    </div>
                                    <button onClick={() => setShowVotingPanel(!showVotingPanel)} className={`w-11 h-11 rounded-2xl flex items-center justify-center border-2 transition-all shadow-lg active:scale-90 ${showVotingPanel || votingActive ? 'text-[#1a1006] animate-pulse border-white/60' : 'bg-[#e8be6e]/10 border-[#e8be6e]/30 text-[#e8be6e] hover:bg-[#e8be6e]/20'}`} style={showVotingPanel || votingActive ? { background: 'linear-gradient(180deg,#f9e0a4,#b88a3e)' } : undefined} title="التصويت"><Vote size={19} /></button>
                                    <button onClick={() => setSfxMuted(m => !m)} className={`w-11 h-11 rounded-2xl flex items-center justify-center border-2 transition-all shadow-lg active:scale-90 ${sfxMuted ? 'bg-[#cf7c43]/15 border-[#cf7c43]/40 text-[#d2824a]' : 'bg-[#e8be6e]/10 border-[#e8be6e]/30 text-[#e8be6e]'}`} title={sfxMuted ? 'تشغيل الأصوات' : 'كتم الأصوات'}>{sfxMuted ? <VolumeX size={19} /> : <Volume2 size={19} />}</button>
                                    <button onClick={() => broadcastFullState()} className="w-11 h-11 rounded-2xl flex items-center justify-center border-2 bg-[#e8be6e]/10 border-[#e8be6e]/30 text-[#e8be6e] hover:bg-[#e8be6e]/20 transition-all shadow-lg active:scale-90" title="إعادة مزامنة OBS"><RefreshCw size={19} /></button>
                                    <button onClick={() => setStage('settings')} className="w-11 h-11 rounded-2xl flex items-center justify-center border-2 bg-[#cf7c43]/10 border-[#cf7c43]/30 text-[#d2824a] hover:bg-[#cf7c43] hover:text-[#fff3e2] transition-all shadow-lg active:scale-90" title="الإعدادات"><Settings size={19} /></button>
                                </div>
                                <div className="text-[8px] font-black text-[#e8be6e]/25 uppercase tracking-[0.6em]">حروف مع منصور</div>
                            </div>
                        )}

                        {/* BOARD */}
                        <div className={`relative z-10 animate-in zoom-in slide-in-from-bottom-20 duration-1000 ${isOBS ? 'animate-[boardFloat_10s_ease-in-out_infinite]' : ''}`} style={{ width: `${boardWidth}px`, height: `${boardHeight}px` }}>
                            {cells.map(cell => {
                                const isOffset = cell.row % 2 !== 0;
                                const left = (cell.col * X_OFFSET) + (isOffset ? X_OFFSET / 2 : 0);
                                const top = cell.row * Y_OFFSET;
                                const isActive = activeCell?.id === cell.id;
                                const isWinning = winningPath.includes(cell.id);

                                return (
                                    <div key={cell.id} onClick={() => { if (!isOBS) selectCell(cell); }} className={`absolute flex items-center justify-center ${isOBS ? '' : 'cursor-pointer'} transition-all duration-300 ${isActive ? 'scale-110 z-50' : 'hover:scale-105 hover:z-40 z-10'} ${isWinning ? 'animate-bounce z-50' : ''}`} style={{ left: `${left}px`, top: `${top}px`, width: `${SVG_WIDTH}px`, height: `${SVG_HEIGHT}px` }}>
                                        <svg width={SVG_WIDTH} height={SVG_HEIGHT} className="absolute inset-0 overflow-visible z-0">
                                            {/* Gold base plate (rim) */}
                                            <polygon points={hexPoints} fill={isOBS ? 'url(#g-obs)' : 'url(#g-neutral)'} stroke={isOBS ? 'rgba(232,190,110,.45)' : '#6b4a15'} strokeWidth={isOBS ? 3 : 4} strokeLinejoin="round" className={isOBS && cell.owner === 'none' ? 'animate-[neonPulse_4s_infinite]' : ''} />
                                            {/* Owner fill / dark well */}
                                            <polygon points={hexPoints}
                                                fill={cell.owner === 'team1' ? 'url(#g-team1)' : cell.owner === 'team2' ? 'url(#g-team2)' : (isOBS ? 'url(#g-obs)' : 'url(#g-well)')}
                                                stroke="none" strokeLinejoin="round" style={{ transform: 'scale(0.86)', transformOrigin: 'center' }} />
                                            {/* Gloss */}
                                            <polygon points={hexPoints} fill="white" style={{ opacity: isOBS ? 0.04 : 0.08, transform: 'scale(0.86)', transformOrigin: 'center' }} className="pointer-events-none" />
                                            {/* Inner rim hairline */}
                                            <polygon points={hexPoints} fill="none" stroke={cell.owner === 'none' ? 'rgba(232,190,110,.28)' : 'rgba(255,246,220,.35)'} strokeWidth="1.5" strokeLinejoin="round" style={{ transform: 'scale(0.86)', transformOrigin: 'center' }} />
                                            {isWinning && <polygon points={hexPoints} fill="none" stroke="url(#g-badge)" strokeWidth="14" strokeLinejoin="round" style={{ filter: 'url(#ultra-glow)' }} />}
                                        </svg>

                                        {/* LETTER */}
                                        <div className={`relative z-10 font-black mt-1 select-none transition-all duration-500 italic ${isOBS ? 'text-[3rem] animate-[letterGlow_5s_infinite]' : 'text-[2.4rem]'} ${cell.owner !== 'none' ? 'scale-75 opacity-40 blur-[0.5px]' : 'scale-100'}`}
                                            style={{
                                                fontFamily: FONT_DISPLAY,
                                                color: cell.owner === 'team1' ? '#2b1a05' : cell.owner === 'team2' ? '#fff3e2' : (isOBS ? '#fbeccb' : '#e8be6e'),
                                                textShadow: isOBS ? '0 6px 25px rgba(0,0,0,0.9), 0 0 10px rgba(232,190,110,0.5)' : (cell.owner === 'none' ? '0 0 16px rgba(232,190,110,.45)' : '0 2px 8px rgba(0,0,0,.6)')
                                            }}>
                                            {cell.letter}
                                        </div>

                                        {/* ACTIVE FX */}
                                        {isActive && (
                                            <>
                                                <div className="absolute inset-[-22px] border-[5px] border-dashed border-[#e8be6e]/70 rounded-full animate-[spin_4s_linear_infinite] z-[-1]"></div>
                                                <div className="absolute inset-[-34px] border-2 border-[#cf7c43]/30 rounded-full animate-[spin_10s_linear_infinite_reverse] z-[-2]"></div>
                                                <div className="absolute inset-[-10px] rounded-full bg-[#e8be6e]/15 blur-xl z-[-3] animate-pulse"></div>
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* LEFT COLUMN — TEAM 2 CARD (manager only) */}
                    {!isOBS && (
                        <div className="w-[290px] shrink-0 flex flex-col gap-4 p-5 z-30">
                            <div className="rounded-[1.8rem] p-5 border-2 relative overflow-hidden" style={{ background: 'linear-gradient(165deg,rgba(40,29,14,.9),rgba(10,7,4,.92))', borderColor: 'rgba(207,124,67,.4)', boxShadow: '0 15px 45px rgba(0,0,0,.5)' }}>
                                <div className="absolute -top-10 -left-10 w-32 h-32 rounded-full blur-2xl opacity-20" style={{ background: '#cf7c43' }}></div>
                                <div className="flex items-center gap-3 mb-4 relative z-10">
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(160deg,#cf7c43,#6b3213)', border: '2px solid rgba(255,240,225,.4)' }}><Swords size={22} className="text-[#fff3e2]" /></div>
                                    <div className="min-w-0">
                                        <h3 className="text-base font-extrabold italic text-[#cf7c43] truncate" style={{ fontFamily: FONT_DISPLAY }}>{team2Name}</h3>
                                        <div className="text-[9px] text-[#cf7c43]/40 font-black uppercase tracking-widest">↔ يمين ↔ شمال</div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 relative z-10">
                                    <div className="rounded-xl p-2.5 text-center border border-[#cf7c43]/20 bg-[#cf7c43]/5">
                                        <div className="text-xl font-extrabold italic text-[#fbeccb] leading-none">{t2cells}</div>
                                        <div className="text-[9px] font-black text-[#b2a283] mt-1">⬡ خلية</div>
                                    </div>
                                    <div className="rounded-xl p-2.5 text-center border border-[#cf7c43]/20 bg-[#cf7c43]/5">
                                        <div className="text-xl font-extrabold italic text-[#fbeccb] leading-none flex items-center justify-center gap-1">{t2cells}<Trophy size={11} className="text-[#cf7c43]" /></div>
                                        <div className="text-[9px] font-black text-[#b2a283] mt-1">جولة</div>
                                    </div>
                                </div>
                                <div className="mt-3 pt-3 border-t border-[#cf7c43]/15 text-[10px] font-bold text-[#b2a283] italic relative z-10">هدفهم: ربط الحافة اليمنى باليسرى</div>
                            </div>

                            {/* PROGRESS TOWARD WIN */}
                            <div className="rounded-[1.8rem] p-4 border-2" style={{ background: 'linear-gradient(165deg,rgba(40,29,14,.85),rgba(10,7,4,.9))', borderColor: 'rgba(232,190,110,.2)' }}>
                                <div className="text-[10px] font-black text-[#b2a283] uppercase tracking-[0.3em] mb-3">السيطرة على الساحة</div>
                                <div className="h-3 rounded-full bg-black/60 border border-[#e8be6e]/15 overflow-hidden flex">
                                    <div className="h-full transition-all duration-700" style={{ width: `${(t1cells / 28) * 100}%`, background: 'linear-gradient(90deg,#9a6a12,#f0c25a)' }}></div>
                                    <div className="h-full flex-1 bg-[#1a130a]"></div>
                                    <div className="h-full transition-all duration-700" style={{ width: `${(t2cells / 28) * 100}%`, background: 'linear-gradient(90deg,#cf7c43,#6b3213)' }}></div>
                                </div>
                                <div className="flex justify-between mt-2 text-xs font-extrabold italic">
                                    <span className="text-[#f0c25a]">{t1cells} ⬡</span>
                                    <span className="text-[#b2a283]/40">{28 - t1cells - t2cells} متبقي</span>
                                    <span className="text-[#cf7c43]">{t2cells} ⬡</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* VOTING DRAWER (manager only) */}
                    {!isOBS && showVotingPanel && (
                        <div className="absolute top-24 bottom-6 left-6 z-[400] w-[350px] rounded-[2rem] border-2 flex flex-col overflow-hidden animate-in slide-in-from-left-8 duration-500 shadow-[0_30px_80px_rgba(0,0,0,.9)]" style={{ background: 'linear-gradient(165deg,rgba(40,29,14,.97),rgba(10,7,4,.98))', borderColor: 'rgba(232,190,110,.4)' }}>
                            <div className="h-1.5 w-full shrink-0" style={{ background: 'linear-gradient(90deg,#a97a30,#f9e0a4,#cf7c43)' }}></div>
                            <div className="flex items-center justify-between p-5 pb-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-[#1a1006] shadow-lg" style={{ background: 'linear-gradient(180deg,#f9e0a4,#b88a3e)' }}><Vote size={20} /></div>
                                    <div>
                                        <h3 className="text-xl font-extrabold italic text-[#fbeccb]" style={{ fontFamily: FONT_DISPLAY }}>تصويت الحروف</h3>
                                        <div className="text-[9px] font-black text-[#e8be6e]/50 uppercase tracking-widest">CHAT LETTER VOTE</div>
                                    </div>
                                </div>
                                <button onClick={() => setShowVotingPanel(false)} className="w-9 h-9 rounded-xl bg-[#cf7c43]/15 border border-[#cf7c43]/40 text-[#d2824a] flex items-center justify-center hover:bg-[#cf7c43] hover:text-[#fff3e2] transition-all"><X size={16} /></button>
                            </div>
                            <div className="flex-1 overflow-y-auto gold-scroll px-5 space-y-5 pb-5">
                                <div>
                                    <label className="text-[10px] font-black text-[#b2a283] uppercase tracking-widest flex items-center gap-2 mb-2"><Users size={12} className="text-[#e8be6e]" /> المسموح لهم بالتصويت</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[{ id: 'all', name: 'الجميع' }, { id: 'team1', name: 'الذهبي' }, { id: 'team2', name: 'النحاسي' }].map(t => (
                                            <button key={t.id} onClick={() => setVotingEligibleTeam(t.id as any)}
                                                className={`py-3 rounded-xl border-2 font-black text-sm transition-all ${votingEligibleTeam === t.id ? 'text-[#1a1006] shadow-lg border-white/50 scale-105' : 'bg-black/40 border-white/10 text-[#b2a283]/50 hover:border-[#e8be6e]/30'}`}
                                                style={votingEligibleTeam === t.id ? { background: t.id === 'team2' ? 'linear-gradient(180deg,#e9b582,#8a4a1e)' : 'linear-gradient(180deg,#f9e0a4,#b88a3e)' } : undefined}>
                                                {t.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="flex items-center justify-between text-[10px] font-black text-[#b2a283] uppercase tracking-widest mb-2"><span className="flex items-center gap-2"><Clock size={12} className="text-[#e8be6e]" /> مدة التصويت</span><span className="text-[#e8be6e]">{votingDuration} ثانية</span></label>
                                    <input type="range" min="10" max="120" step="5" value={votingDuration} onChange={e => setVotingDuration(parseInt(e.target.value))} className="w-full h-2 bg-black rounded-full appearance-none accent-[#e8be6e]" />
                                </div>
                                <div className="rounded-xl p-3 flex items-start gap-3 border" style={{ background: 'rgba(111,220,158,.07)', borderColor: 'rgba(111,220,158,.3)' }}>
                                    <Shield size={14} className="text-[#6fdc9e] mt-0.5 shrink-0" />
                                    <div className="text-[10px] text-[#6fdc9e]/80 font-bold leading-relaxed">تلقائياً: يتم تجاهل أي حرف فُتح سابقاً، ويُسمح بالتصويت فقط للأحرف المتاحة.</div>
                                </div>
                                <button onClick={() => { if (!votingActive) { setLetterVotes({}); setVotedUsers({}); setVotingTimer(votingDuration); setShowVotingPanel(false); } setVotingActive(!votingActive); playSfx('click'); }}
                                    className={`w-full py-4 rounded-2xl font-black text-lg italic transition-all shadow-xl flex items-center justify-center gap-3 border-b-4 border-black/30 ${votingActive ? 'bg-[#ff7a7a]/15 border-[#ff7a7a]/50 text-[#ff7a7a] animate-pulse' : 'text-[#1a1006] hover:scale-[1.02]'}`}
                                    style={votingActive ? { borderColor: 'transparent' } : { background: 'linear-gradient(180deg,#f9e0a4,#b88a3e)' }}>
                                    {votingActive ? <><X size={20} /> إيقاف التصويت</> : <><Play fill="currentColor" size={20} /> بدء جمع الأصوات</>}
                                </button>
                                <div className="space-y-2">
                                    <h4 className="text-sm font-extrabold italic text-[#fbeccb] flex items-center justify-between" style={{ fontFamily: FONT_DISPLAY }}>
                                        <span>الأحرف الأكثر طلباً</span>
                                        <span className="bg-white/5 px-2.5 py-1 rounded-full text-[10px] not-italic text-[#e8be6e] border border-[#e8be6e]/20">{Object.keys(votedUsers).length} صوت</span>
                                    </h4>
                                    {Object.entries(letterVotes).sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 5).map(([letter, count], idx) => (
                                        <div key={idx} className="rounded-xl p-3 border border-[#e8be6e]/15 bg-white/[.04] hover:border-[#e8be6e]/40 transition-all group">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-11 flex items-center justify-center text-lg font-extrabold italic shadow-lg" style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)', background: idx === 0 ? 'linear-gradient(160deg,#f9e0a4,#b88a3e)' : 'linear-gradient(160deg,#3a2a14,#1a1208)', color: idx === 0 ? '#1a1006' : '#e8be6e', fontFamily: FONT_DISPLAY }}>{letter}</div>
                                                    <div>
                                                        <div className="text-xs font-black text-[#fbeccb]">#{idx + 1} • {count} صوت</div>
                                                        <div className="h-1.5 w-24 bg-black/60 rounded-full mt-1 overflow-hidden"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${(count / maxVotes) * 100}%`, background: 'linear-gradient(90deg,#a97a30,#f9e0a4)' }}></div></div>
                                                    </div>
                                                </div>
                                                <button onClick={() => { const cellMatch = cells.find(c => c.letter === letter && c.owner === 'none'); if (cellMatch) { selectCell(cellMatch); setShowVotingPanel(false); setVotingActive(false); } }}
                                                    className="w-9 h-9 rounded-xl flex items-center justify-center border-2 border-[#f0c25a]/40 bg-[#f0c25a]/10 text-[#f0c25a] opacity-40 group-hover:opacity-100 hover:bg-[#f0c25a] hover:text-[#1a1006] active:scale-90 transition-all shadow-lg" title="تفعيل هذا الحرف">
                                                    <Check size={16} strokeWidth={4} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {Object.keys(letterVotes).length === 0 && (
                                        <div className="text-center py-8 rounded-2xl border-2 border-dashed border-[#e8be6e]/15 text-[#b2a283]/40 font-black italic text-sm">
                                            {votingActive ? 'أكتب أي حرف في الشات للتصويت!' : 'لا أصوات بعد'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* VOTING MINI WIDGET */}
                    {votingActive && (
                        <div className="fixed left-6 bottom-6 z-[400] w-[240px] pointer-events-none select-none animate-in slide-in-from-bottom duration-700">
                            <div className="backdrop-blur-2xl border-2 rounded-[2rem] p-4 shadow-[0_15px_50px_rgba(0,0,0,0.9)] relative overflow-hidden" style={{ background: 'linear-gradient(165deg,rgba(40,29,14,.92),rgba(10,7,4,.95))', borderColor: 'rgba(232,190,110,.4)' }}>
                                <div className="absolute top-0 left-0 h-1.5 transition-all duration-1000 ease-linear" style={{ width: `${(votingTimer / votingDuration) * 100}%`, background: 'linear-gradient(90deg,#a97a30,#f9e0a4)' }}></div>
                                <div className="flex flex-col items-center gap-3 pt-1">
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[#1a1006] shadow" style={{ background: 'linear-gradient(180deg,#f9e0a4,#b88a3e)' }}><Vote size={13} /></div>
                                        <h3 className="text-lg font-extrabold italic text-[#fbeccb]" style={{ fontFamily: FONT_DISPLAY }}>تصويت الحروف</h3>
                                    </div>
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="px-3 py-0.5 rounded-xl text-xl font-extrabold italic tabular-nums text-[#1a1006] shadow-lg" style={{ background: 'linear-gradient(180deg,#f9e0a4,#b88a3e)', fontFamily: FONT_DISPLAY }}>{votingTimer}s</div>
                                        <div className="px-2 py-0.5 rounded-full bg-white/5 border border-[#e8be6e]/20 text-[#e8be6e] font-black text-[7px] uppercase tracking-widest">
                                            {votingEligibleTeam === 'all' ? 'EVERYONE' : (votingEligibleTeam === 'team1' ? 'GOLD TEAM' : 'COPPER TEAM')}
                                        </div>
                                    </div>
                                    <div className="w-full grid grid-cols-2 gap-2">
                                        {Object.entries(letterVotes).sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 4).map(([char, count], i) => (
                                            <div key={i} className="relative flex flex-col items-center p-2.5 rounded-[1rem] border animate-in zoom-in duration-500" style={{ background: 'rgba(232,190,110,.05)', borderColor: i === 0 ? 'rgba(232,190,110,.5)' : 'rgba(232,190,110,.15)', animationDelay: `${i * 100}ms` }}>
                                                <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center font-black text-[8px] text-[#1a1006] border-2 border-[#0d0904]" style={{ background: i === 0 ? '#f9e0a4' : '#8a6a2a', color: i === 0 ? '#1a1006' : '#fbeccb' }}>#{i + 1}</div>
                                                <div className="w-9 h-10 flex items-center justify-center text-lg font-extrabold italic shadow mb-0.5" style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)', background: i === 0 ? 'linear-gradient(160deg,#f9e0a4,#b88a3e)' : 'linear-gradient(160deg,#3a2a14,#1a1208)', color: i === 0 ? '#1a1006' : '#e8be6e', fontFamily: FONT_DISPLAY }}>{char}</div>
                                                <div className="text-base font-extrabold italic tabular-nums text-[#e8be6e]">{count}</div>
                                            </div>
                                        ))}
                                        {Object.keys(letterVotes).length === 0 && <div className="col-span-2 text-center py-5 text-[#b2a283]/30 text-sm font-black italic border-2 border-dashed border-[#e8be6e]/10 rounded-[1.2rem]">بانتظار الأصوات..</div>}
                                    </div>
                                    <div className="flex items-center justify-center gap-2 text-[#e8be6e]/40 font-black italic pt-2 w-full border-t border-[#e8be6e]/10">
                                        <Users size={13} /><span className="text-sm">{Object.keys(votedUsers).length}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                        {/* QUESTION MODAL */}
                        {activeCell && (
                            <div className="fixed inset-0 z-[350] flex items-center justify-center p-6 animate-in zoom-in duration-300">
                                {isOBS && <div className="absolute inset-0 bg-black/85 backdrop-blur-3xl animate-in fade-in duration-500"></div>}
                                {!isOBS && <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setActiveCell(null)}></div>}

                                <div className={`relative w-full max-w-xl rounded-[2.5rem] border-2 shadow-[0_40px_120px_rgba(0,0,0,.95),0_0_60px_rgba(232,190,110,.12)] p-8 pt-12 text-center animate-in fade-in slide-in-from-bottom-6 duration-500 ${isOBS ? 'scale-[0.8]' : ''}`} style={{ background: 'linear-gradient(165deg,rgba(40,29,14,.97),rgba(10,7,4,.98))', borderColor: 'rgba(232,190,110,.5)', fontFamily: FONT_DISPLAY }}>
                                    <div className="absolute top-0 left-0 w-full h-1.5 rounded-t-[2.5rem]" style={{ background: 'linear-gradient(90deg,#a97a30,#f9e0a4,#cf7c43,#a97a30)' }}></div>

                                    {/* FLOATING HEX BADGE */}
                                    <div className="absolute -top-14 left-1/2 -translate-x-1/2 z-20">
                                        <div className="absolute inset-0 bg-[#e8be6e]/30 blur-2xl rounded-full scale-150 animate-pulse"></div>
                                        <div className="relative w-24 h-26 flex items-center justify-center animate-[boardFloat_4s_ease-in-out_infinite]" style={{ width: '6rem', height: '6.8rem', clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)', background: 'linear-gradient(160deg,#fbe5a8,#a6772c)' }}>
                                            <div className="absolute inset-[5px] flex items-center justify-center" style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)', background: 'radial-gradient(circle at 50% 30%,#fff6dc,#f0d9a2)' }}>
                                                <span className={`${isOBS ? 'text-5xl' : 'text-4xl'} font-extrabold italic text-[#2b1a05] leading-none mt-1`} style={{ fontFamily: FONT_DISPLAY, textShadow: '0 2px 10px rgba(122,80,20,.35)' }}>{activeCell.letter}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* QUESTION */}
                                    <div className="space-y-4 mt-6">
                                        {currentQuestion ? (
                                            <>
                                                <h2 className={`${isOBS ? 'text-3xl' : 'text-xl'} font-extrabold italic text-[#fbeccb] leading-tight drop-shadow-lg animate-in slide-in-from-bottom duration-700`}>{currentQuestion.question}</h2>
                                                {!isOBS && (
                                                    <>
                                                        <div className="rounded-2xl p-3 border-2 relative overflow-hidden" style={{ background: 'rgba(232,190,110,.06)', borderColor: 'rgba(232,190,110,.3)' }}>
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[9px] font-black text-[#b2a283] uppercase tracking-widest">الإجابة المتوقعة</span>
                                                                <button onClick={() => setAnswerRevealed(r => !r)} className="w-8 h-8 rounded-lg flex items-center justify-center border border-[#e8be6e]/30 bg-black/40 text-[#e8be6e] hover:bg-[#e8be6e]/15 transition-all" title={answerRevealed ? 'إخفاء الإجابة' : 'إظهار الإجابة'}>{answerRevealed ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                                                            </div>
                                                            <span className={`block text-lg font-extrabold text-[#6fdc9e] mt-1 transition-all duration-300 ${answerRevealed ? '' : 'blur-[8px] select-none'}`}>{currentQuestion.answer}</span>
                                                        </div>
                                                        <p className="text-xs font-bold text-[#b2a283]/60 italic">الإجابة كلمة واحدة — اكتبها كما هي، بدون «ال» أو التشكيل تُحتسب صحيحة</p>
                                                    </>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                <h2 className={`${isOBS ? 'text-3xl' : 'text-2xl'} font-extrabold italic text-[#fbeccb] drop-shadow-lg`}>تحدي الحرف!</h2>
                                                <p className={`${isOBS ? 'text-2xl' : 'text-lg'} font-bold text-[#b2a283]`}>اكتب كلمة تبدأ بحرف <span className="text-[#e8be6e] font-extrabold">{activeCell.letter}</span></p>
                                            </>
                                        )}
                                    </div>

                                    {/* STATES */}
                                    {transitioningToTeam ? (
                                        <div className="space-y-5 animate-in zoom-in duration-500 pt-4">
                                            <div className="flex flex-col items-center gap-4">
                                                <div className="relative">
                                                    <div className="absolute -inset-6 blur-2xl rounded-full opacity-40 animate-pulse" style={{ background: transitioningToTeam === 'open' ? '#e8be6e' : transitioningToTeam === 'team1' ? '#f0c25a' : '#cf7c43' }}></div>
                                                    <div className="w-24 h-26 flex items-center justify-center text-5xl shadow-2xl relative z-10 animate-bounce" style={{ width: '6rem', height: '6.6rem', clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)', background: transitioningToTeam === 'open' ? 'linear-gradient(160deg,#f9e0a4,#b88a3e)' : transitioningToTeam === 'team1' ? 'linear-gradient(160deg,#f0c25a,#8f5f12)' : 'linear-gradient(160deg,#cf7c43,#6b3213)', border: '3px solid rgba(255,246,220,.5)' }}>
                                                        {transitioningToTeam === 'open' ? <BellRing className="text-[#1a1006]" size={36} /> : transitioningToTeam === 'team1' ? <Crown className="text-[#2b1a05]" size={36} /> : <Swords className="text-[#fff3e2]" size={36} />}
                                                    </div>
                                                </div>
                                                <div className="text-center px-4">
                                                    <p className="text-[#b2a283] font-black text-sm mb-2 italic uppercase tracking-[0.2em]">{transitioningToTeam === 'open' ? 'انتهت محاولات الفريقين !!' : 'تم استنفاذ المحاولات !!'}</p>
                                                    <h3 className={`${isOBS ? 'text-4xl' : 'text-3xl'} font-extrabold italic text-[#fbeccb] drop-shadow-2xl`}>
                                                        {transitioningToTeam === 'open' ? 'السؤال الآن للمجموعة الأسرع!' : `الدور الآن لـ ${transitioningToTeam === 'team1' ? team1Name : team2Name}`}
                                                    </h3>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="w-full h-4 rounded-full bg-black/60 border border-[#e8be6e]/25 overflow-hidden relative">
                                                    <div className="h-full transition-all duration-1000 ease-linear" style={{ width: `${(transitionTimer / (transitioningToTeam === 'open' ? 5 : 4)) * 100}%`, background: transitioningToTeam === 'open' ? 'linear-gradient(90deg,#b88a3e,#f9e0a4)' : transitioningToTeam === 'team1' ? 'linear-gradient(90deg,#8f5f12,#f0c25a)' : 'linear-gradient(90deg,#6b3213,#cf7c43)' }}></div>
                                                </div>
                                                <div className="flex items-center justify-between w-full text-[10px] font-black uppercase tracking-[0.4em] text-[#e8be6e]/40">
                                                    <span>{transitioningToTeam === 'open' ? 'Opening for All' : 'Starting Turn'}</span>
                                                    <span className="text-2xl font-extrabold italic tabular-nums text-[#e8be6e]" style={{ fontFamily: FONT_DISPLAY }}>{transitionTimer}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ) : openTurn ? (
                                        <div className="space-y-5 animate-in zoom-in pt-4">
                                            <div className="p-4 rounded-[1.5rem] border-2 flex items-center justify-between gap-4" style={{ borderColor: 'rgba(232,190,110,.6)', background: 'rgba(232,190,110,.08)', boxShadow: '0 0 30px rgba(232,190,110,.2)' }}>
                                                <div className="flex items-center gap-4 min-w-0">
                                                    <div className="flex -space-x-3 shrink-0">
                                                        <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg border-2 border-white/50" style={{ background: 'linear-gradient(160deg,#f0c25a,#8f5f12)' }}><Crown size={20} className="text-[#2b1a05]" /></div>
                                                        <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg border-2 border-white/50" style={{ background: 'linear-gradient(160deg,#cf7c43,#6b3213)' }}><Swords size={20} className="text-[#fff3e2]" /></div>
                                                    </div>
                                                    <div className="text-right min-w-0">
                                                        <div className={`${isOBS ? 'text-2xl' : 'text-xl'} font-extrabold italic text-[#fbeccb]`}>السؤال مفتوح للجميع !!</div>
                                                        <div className={`${isOBS ? 'text-lg' : 'text-xs'} font-black mt-1 uppercase tracking-widest text-[#e8be6e]`}>أول إجابة صحيحة تأخذ الخلية</div>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-center gap-2 shrink-0">
                                                    <div className="flex flex-col items-center bg-black/50 px-4 py-1.5 rounded-2xl border border-[#e8be6e]/25">
                                                        <div className={`${isOBS ? 'text-4xl' : 'text-2xl'} font-extrabold italic tabular-nums drop-shadow-[0_0_10px_rgba(232,190,110,.5)]`} style={{ color: answerTimer <= 3 ? '#ff7a7a' : '#fbeccb' }}>{answerTimer}s</div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* ANSWER TIMER BAR */}
                                            <div className="w-full h-3 rounded-full bg-black/60 border border-[#e8be6e]/20 overflow-hidden">
                                                <div className="h-full transition-all duration-1000 ease-linear" style={{ width: `${answerDuration > 0 ? (answerTimer / answerDuration) * 100 : 0}%`, background: answerTimer / answerDuration > 0.35 ? 'linear-gradient(90deg,#a97a30,#f9e0a4)' : 'linear-gradient(90deg,#8a2f2f,#ff7a7a)' }}></div>
                                            </div>

                                            {lastAnswer.text ? (
                                                <div className="p-4 rounded-2xl border-2 text-center animate-in slide-in-from-bottom flex flex-col items-center gap-2" style={{ background: lastAnswer.correct === true ? 'rgba(111,220,158,.1)' : 'rgba(255,122,122,.1)', borderColor: lastAnswer.correct === true ? 'rgba(111,220,158,.5)' : 'rgba(255,122,122,.5)' }}>
                                                    <div className="text-xs font-black uppercase tracking-widest text-[#b2a283]/60">الإجابة المكتوبة:</div>
                                                    <div className="text-2xl font-extrabold" style={{ color: lastAnswer.correct === true ? '#6fdc9e' : '#ff7a7a' }}>{lastAnswer.text}</div>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center gap-3 animate-pulse p-5 rounded-2xl border-2 border-dashed border-[#e8be6e]/20 bg-white/[.03]">
                                                    <BrainCircuit size={40} className="text-[#e8be6e]/60" />
                                                    <h4 className="text-xl font-extrabold italic text-[#fbeccb]">اكتبوا الإجابة في الشات الآن — بدون جرس !!</h4>
                                                </div>
                                            )}
                                        </div>
                                    ) : buzzedTeam ? (
                                        <div className="space-y-5 animate-in zoom-in pt-4">
                                            <div className="p-4 rounded-[1.5rem] border-2 flex items-center justify-between gap-4 transition-all duration-500" style={{ borderColor: buzzedTeam === 'team1' ? 'rgba(240,194,90,.6)' : 'rgba(207,124,67,.6)', background: buzzedTeam === 'team1' ? 'rgba(240,194,90,.08)' : 'rgba(207,124,67,.08)', boxShadow: `0 0 30px ${buzzedTeam === 'team1' ? 'rgba(240,194,90,.2)' : 'rgba(207,124,67,.2)'}` }}>
                                                <div className="flex items-center gap-4 min-w-0">
                                                    {buzzedPlayer && (
                                                        <div className="relative shrink-0">
                                                            <div className="absolute -inset-2 blur-lg rounded-full animate-pulse" style={{ background: buzzedTeam === 'team1' ? 'rgba(240,194,90,.4)' : 'rgba(207,124,67,.4)' }}></div>
                                                            <ProAvatar username={buzzedPlayer.username} url={buzzedPlayer.avatar} size={isOBS ? 'w-24 h-24' : 'w-16 h-16'} className="overflow-visible relative z-10" />
                                                        </div>
                                                    )}
                                                    <div className="text-right min-w-0">
                                                        {buzzedPlayer ? (
                                                            <>
                                                                <div className={`${isOBS ? 'text-2xl' : 'text-xl'} font-extrabold italic text-[#fbeccb] truncate`}>{buzzedPlayer.username}</div>
                                                                <div className={`${isOBS ? 'text-lg' : 'text-xs'} font-black mt-1 uppercase tracking-widest`} style={{ color: buzzedTeam === 'team1' ? '#f0c25a' : '#cf7c43' }}>{buzzedTeam === 'team1' ? team1Name : team2Name}</div>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <div className={`${isOBS ? 'text-2xl' : 'text-xl'} font-extrabold italic text-[#fbeccb]`}>الدور للفريق بدون جرس!</div>
                                                                <div className={`${isOBS ? 'text-lg' : 'text-xs'} font-black mt-1 uppercase tracking-widest`} style={{ color: buzzedTeam === 'team1' ? '#f0c25a' : '#cf7c43' }}>{buzzedTeam === 'team1' ? team1Name : team2Name} — جاوبوا على طول</div>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-center gap-2 shrink-0">
                                                    <div className="flex gap-1.5">
                                                        {[1, 2].map(attempt => (
                                                            <div key={attempt} className="w-3 h-3 rounded-full border-2 transition-all" style={currentBuzzedAttempts >= attempt ? { background: '#ff7a7a', borderColor: '#ffb0b0', boxShadow: '0 0 8px #ff7a7a' } : { background: 'rgba(255,255,255,.08)', borderColor: 'rgba(232,190,110,.3)' }}></div>
                                                        ))}
                                                    </div>
                                                    <div className="flex flex-col items-center bg-black/50 px-4 py-1.5 rounded-2xl border border-[#e8be6e]/25">
                                                        <div className={`${isOBS ? 'text-4xl' : 'text-2xl'} font-extrabold italic tabular-nums drop-shadow-[0_0_10px_rgba(232,190,110,.5)]`} style={{ color: answerTimer <= 3 ? '#ff7a7a' : '#fbeccb' }}>{answerTimer}s</div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* ANSWER TIMER BAR */}
                                            <div className="w-full h-3 rounded-full bg-black/60 border border-[#e8be6e]/20 overflow-hidden">
                                                <div className="h-full transition-all duration-1000 ease-linear" style={{ width: `${answerDuration > 0 ? (answerTimer / answerDuration) * 100 : 0}%`, background: answerTimer / answerDuration > 0.35 ? 'linear-gradient(90deg,#a97a30,#f9e0a4)' : 'linear-gradient(90deg,#8a2f2f,#ff7a7a)' }}></div>
                                            </div>

                                            {lastAnswer.text ? (
                                                <div className="p-4 rounded-2xl border-2 text-center animate-in slide-in-from-bottom flex flex-col items-center gap-2" style={{ background: lastAnswer.correct === true ? 'rgba(111,220,158,.1)' : 'rgba(255,122,122,.1)', borderColor: lastAnswer.correct === true ? 'rgba(111,220,158,.5)' : 'rgba(255,122,122,.5)' }}>
                                                    <div className="text-xs font-black uppercase tracking-widest text-[#b2a283]/60">الإجابة المكتوبة:</div>
                                                    <div className="text-2xl font-extrabold" style={{ color: lastAnswer.correct === true ? '#6fdc9e' : '#ff7a7a' }}>{lastAnswer.text}</div>
                                                    <div className="p-2 rounded-full border" style={{ background: 'rgba(255,255,255,.05)', borderColor: lastAnswer.correct === true ? 'rgba(111,220,158,.4)' : 'rgba(255,122,122,.4)', color: lastAnswer.correct === true ? '#6fdc9e' : '#ff7a7a' }}>
                                                        {lastAnswer.correct === true ? <Check size={24} strokeWidth={4} /> : <X size={24} strokeWidth={4} />}
                                                    </div>
                                                    {lastAnswer.correct === false && currentBuzzedAttempts === 1 && <div className="text-lg font-extrabold italic animate-pulse text-[#ff7a7a]">محاولة أخيرة !!</div>}
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center gap-3 animate-pulse p-5 rounded-2xl border-2 border-dashed border-[#e8be6e]/20 bg-white/[.03]">
                                                    <BrainCircuit size={40} className="text-[#e8be6e]/60" />
                                                    <h4 className="text-xl font-extrabold italic text-[#fbeccb]">اكتب الإجابة في الشات !!</h4>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-5 p-5 rounded-2xl border-2 border-dashed border-[#e8be6e]/20 bg-white/[.03] relative overflow-hidden pt-6">
                                            <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(105deg,transparent 40%,rgba(232,190,110,.08) 50%,transparent 60%)', animation: 'shimmer 2.5s infinite' }}></div>

                                            <div className="flex gap-8 items-center relative z-10">
                                                <div className={`flex flex-col items-center gap-2 transition-all duration-500 ${triedTeams.includes('team1') ? 'opacity-20 grayscale' : 'opacity-100'}`}>
                                                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(160deg,#f0c25a,#8f5f12)', border: '2px solid rgba(255,246,220,.5)' }}><Crown size={26} className="text-[#2b1a05]" /></div>
                                                    <span className="text-[9px] font-black text-[#f0c25a] uppercase mt-1 truncate max-w-[80px]">{team1Name}</span>
                                                </div>

                                                <div className="flex flex-col items-center gap-3">
                                                    <div className="w-20 h-20 rounded-[1.5rem] flex items-center justify-center shadow-2xl animate-bounce relative" style={{ background: 'linear-gradient(180deg,#f9e0a4,#b88a3e)', border: '3px solid rgba(255,246,220,.6)', boxShadow: '0 0 35px rgba(232,190,110,.35)' }}>
                                                        <BellRing size={34} className="text-[#1a1006]" />
                                                    </div>
                                                    <h4 className={`${isOBS ? 'text-3xl' : 'text-2xl'} font-extrabold italic tracking-tight text-[#fbeccb]`}>أكتب "جرس" للرن!</h4>
                                                </div>

                                                <div className={`flex flex-col items-center gap-2 transition-all duration-500 ${triedTeams.includes('team2') ? 'opacity-20 grayscale' : 'opacity-100'}`}>
                                                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(160deg,#cf7c43,#6b3213)', border: '2px solid rgba(255,240,225,.4)' }}><Swords size={26} className="text-[#fff3e2]" /></div>
                                                    <span className="text-[9px] font-black text-[#cf7c43] uppercase mt-1 truncate max-w-[80px]">{team2Name}</span>
                                                </div>
                                            </div>

                                            {triedTeams.length === 1 && (
                                                <div className="relative z-10 px-4 py-1.5 rounded-full font-black text-xs border animate-pulse" style={{ background: 'rgba(255,122,122,.12)', color: '#ff7a7a', borderColor: 'rgba(255,122,122,.35)' }}>
                                                    ⚠️ الفريق الأول أخطأ.. الدور للفريق الثاني!
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {!isOBS && (
                                        <div className="mt-6 pt-4 border-t border-[#e8be6e]/10 flex gap-3 opacity-30 hover:opacity-100 transition-opacity">
                                            <button onClick={() => finalizeRound(true, 'team1')} className="flex-1 p-4 rounded-xl border-2 font-black text-lg transition-all hover:scale-[1.02] active:scale-95" style={{ background: 'rgba(240,194,90,.08)', borderColor: 'rgba(240,194,90,.35)', color: '#f0c25a' }}>تخطي للفريق الذهبي 🟡</button>
                                            <button onClick={() => finalizeRound(true, 'team2')} className="flex-1 p-4 rounded-xl border-2 font-black text-lg transition-all hover:scale-[1.02] active:scale-95" style={{ background: 'rgba(207,124,67,.08)', borderColor: 'rgba(207,124,67,.35)', color: '#cf7c43' }}>تخطي للفريق النحاسي 🟠</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                </div>
            )}

            {/* STAGE: ENDED — GOLD VICTORY SCREEN (manager only) */}
            {!isOBS && stage === 'ended' && (
                <div className="absolute inset-0 z-[500] flex items-center justify-center overflow-hidden">
                    {!isOBS && <div className="absolute inset-0" style={{ background: winner === 'team1' ? 'radial-gradient(ellipse at center,rgba(240,194,90,.16) 0%,rgba(10,8,5,.94) 70%)' : 'radial-gradient(ellipse at center,rgba(207,124,67,.16) 0%,rgba(10,8,5,.94) 70%)' }}></div>}
                    {isOBS && <div className="absolute inset-0 pointer-events-none" style={{ background: winner === 'team1' ? 'radial-gradient(ellipse at center,rgba(240,194,90,.22) 0%,transparent 70%)' : 'radial-gradient(ellipse at center,rgba(207,124,67,.22) 0%,transparent 70%)' }}></div>}

                    {/* CELEBRATION PARTICLES */}
                    {Array.from({ length: 40 }).map((_, i) => (
                        <div key={i} className="absolute rounded-full pointer-events-none" style={{
                            width: `${(i % 5) * 2 + 4}px`,
                            height: `${(i % 5) * 2 + 4}px`,
                            top: `${(i * 17) % 100}%`,
                            left: `${(i * 23 + 7) % 100}%`,
                            background: winner === 'team1' ? (i % 3 === 0 ? '#f9e0a4' : '#c99743') : (i % 3 === 0 ? '#e9b582' : '#a05a26'),
                            boxShadow: `0 0 12px ${winner === 'team1' ? 'rgba(240,194,90,.6)' : 'rgba(207,124,67,.6)'}`,
                            animation: `float ${8 + (i % 6)}s ease-in-out ${(i % 10) * 0.7}s infinite`,
                            opacity: 0.7,
                            filter: 'blur(0.5px)'
                        }} />
                    ))}

                    <div className="relative z-10 flex flex-col items-center gap-4 max-w-lg w-full px-4 text-center animate-in zoom-in duration-700">
                        <div className="flex items-center gap-2 px-5 py-1.5 rounded-full backdrop-blur-md border" style={{ background: 'rgba(232,190,110,.08)', borderColor: 'rgba(232,190,110,.4)' }}>
                            <Trophy size={14} className="text-[#e8be6e]" />
                            <span className="text-[#fbeccb] font-black text-xs uppercase tracking-widest italic">نصر رائع!</span>
                            <Trophy size={14} className="text-[#e8be6e]" />
                        </div>

                        <div className="relative mt-2">
                            <h1 className="text-[3.4rem] font-extrabold italic tracking-tighter leading-none select-none animate-pulse" style={{ fontFamily: FONT_DISPLAY, background: winner === 'team1' ? 'linear-gradient(180deg,#fff6dc,#e8be6e 55%,#8f5f12)' : 'linear-gradient(180deg,#ffe8cf,#cf7c43 55%,#6b3213)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', WebkitTextStroke: '1px rgba(232,190,110,.15)' }}>
                                فـــــــــــــــــاز
                            </h1>
                            <div className="absolute -inset-8 blur-3xl opacity-20 animate-pulse rounded-full" style={{ background: winner === 'team1' ? '#f0c25a' : '#cf7c43' }}></div>
                        </div>

                        <div className="relative w-full max-w-sm py-6 px-4 rounded-[2rem] border-2 shadow-2xl flex flex-col items-center gap-4 animate-in zoom-in duration-700 delay-300" style={{ background: 'linear-gradient(165deg,rgba(40,29,14,.95),rgba(10,7,4,.97))', borderColor: winner === 'team1' ? 'rgba(240,194,90,.55)' : 'rgba(207,124,67,.55)', boxShadow: `0 0 60px ${winner === 'team1' ? 'rgba(240,194,90,.25)' : 'rgba(207,124,67,.25)'}` }}>
                            <div className="relative group">
                                <div className="w-28 h-28 flex items-center justify-center shadow-2xl transition-transform duration-500 group-hover:scale-105 animate-goldpulse" style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)', background: winner === 'team1' ? 'linear-gradient(160deg,#f0c25a,#8f5f12)' : 'linear-gradient(160deg,#cf7c43,#6b3213)', border: '4px solid rgba(255,246,220,.5)' }}>
                                    {winner === 'team1' ? <Crown size={52} className="text-[#2b1a05]" /> : <Swords size={52} className="text-[#fff3e2]" />}
                                </div>
                                <div className="absolute -top-3 -right-3 w-12 h-12 rounded-full flex items-center justify-center shadow-xl rotate-12 animate-bounce text-[#1a1006] border-2 border-[#0d0904]" style={{ background: 'linear-gradient(180deg,#f9e0a4,#b88a3e)' }}>
                                    <Trophy size={22} />
                                </div>
                            </div>

                            <div className="space-y-2 relative z-10 text-center">
                                <h2 className="text-4xl font-extrabold italic tracking-tighter drop-shadow-lg text-[#fbeccb]">{winner === 'team1' ? team1Name : team2Name}</h2>
                                <div className="mx-auto h-1 w-24 rounded-full" style={{ background: winner === 'team1' ? 'linear-gradient(90deg,transparent,#f0c25a,transparent)' : 'linear-gradient(90deg,transparent,#cf7c43,transparent)' }}></div>
                                <p className="text-[#b2a283] text-sm font-bold italic">{winner === 'team1' ? 'ربطوا القمة بالأسفل وتوّجوا بالمرحلة' : 'قطعوا الساحة يميناً إلى شمالاً وحسموا الجولة'}</p>
                            </div>

                            <div className="grid grid-cols-3 gap-3 w-full mt-2">
                                <div className="p-3 rounded-2xl border text-center" style={{ background: 'rgba(255,255,255,.04)', borderColor: 'rgba(232,190,110,.15)' }}>
                                    <div className="text-[9px] font-black text-[#b2a283] uppercase mb-1">المرحلة</div>
                                    <div className="text-lg font-extrabold italic text-[#fbeccb]">{getArabicStageWord(Math.max(1, currentLevel - 1))}</div>
                                </div>
                                <div className="p-3 rounded-2xl border text-center" style={{ background: 'rgba(255,255,255,.04)', borderColor: 'rgba(232,190,110,.15)' }}>
                                    <div className="text-[9px] font-black text-[#b2a283] uppercase mb-1">اللاعبون</div>
                                    <div className="text-lg font-extrabold italic text-[#fbeccb]">{winner === 'team1' ? women.length : men.length}</div>
                                </div>
                                <div className="p-3 rounded-2xl border text-center" style={{ background: 'rgba(255,255,255,.04)', borderColor: 'rgba(232,190,110,.15)' }}>
                                    <div className="text-[9px] font-black text-[#b2a283] uppercase mb-1">الخلايا</div>
                                    <div className="text-lg font-extrabold italic text-[#fbeccb]">{winner === 'team1' ? t1cells : t2cells}</div>
                                </div>
                            </div>
                        </div>

                        {!isOBS && (
                            <div className="flex gap-3 mt-3">
                                <button onClick={() => startGame()} className="flex items-center gap-3 px-7 py-4 rounded-2xl font-extrabold text-xl text-[#1a1006] transition-all hover:scale-105 active:scale-95 shadow-[0_12px_30px_rgba(232,190,110,.3)] border-b-4 border-black/30" style={{ background: 'linear-gradient(180deg,#f9e0a4,#b88a3e)', fontFamily: FONT_DISPLAY }}>
                                    <Play fill="currentColor" size={20} /> المرحلة التالية
                                </button>
                                <button onClick={() => setStage('levelSelect')} className="flex items-center gap-2 px-6 py-4 rounded-2xl font-black text-base transition-all border-2 hover:scale-105 active:scale-95 bg-[#e8be6e]/5 border-[#e8be6e]/30 text-[#e8be6e] hover:bg-[#e8be6e]/15">
                                    <Stars size={20} /> الخريطة
                                </button>
                                <button onClick={onHome} className="flex items-center gap-2 px-6 py-4 rounded-2xl font-black text-base transition-all border-2 hover:scale-105 active:scale-95 bg-[#cf7c43]/10 border-[#cf7c43]/30 text-[#d2824a] hover:bg-[#cf7c43] hover:text-[#fff3e2]">
                                    <Home size={20} /> الرئيسية
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <style>{`
                .gtitle { background: linear-gradient(180deg,#fff6dc 5%,#e8be6e 50%,#a97a30 95%); -webkit-background-clip: text; background-clip: text; color: transparent; }
                .ctitle { background: linear-gradient(180deg,#ffe8cf 5%,#cf7c43 55%,#6b3213 95%); -webkit-background-clip: text; background-clip: text; color: transparent; }
                .animate-spin-slow { animation: spin 8s linear infinite; }
                .animate-goldpulse { animation: goldpulse 2.4s ease-in-out infinite; }
                .gold-scroll::-webkit-scrollbar { width: 6px; }
                .gold-scroll::-webkit-scrollbar-track { background: rgba(232,190,110,.06); border-radius: 4px; }
                .gold-scroll::-webkit-scrollbar-thumb { background: linear-gradient(180deg,#e8be6e,#8a5a1c); border-radius: 4px; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes ember { 0% { transform: translateY(0) translateX(0); opacity: 0; } 8% { opacity: .8; } 85% { opacity: .35; } 100% { transform: translateY(-105vh) translateX(30px); opacity: 0; } }
                @keyframes goldpulse { 0%,100% { box-shadow: 0 0 0 0 rgba(232,190,110,.45); filter: brightness(1); } 50% { box-shadow: 0 0 28px 8px rgba(232,190,110,.25); filter: brightness(1.15); } }
                @keyframes boardFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-14px); } }
                @keyframes obsBoardFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20px); } }
                @keyframes obsFloat { 0%, 100% { transform: translateY(0) rotate(0); } 50% { transform: translateY(-50px) rotate(180deg); } }
                @keyframes neonPulse { 0%, 100% { opacity: 0.4; filter: brightness(1); } 50% { opacity: 0.8; filter: brightness(2); } }
                @keyframes letterGlow { 0%, 100% { text-shadow: 0 0 10px rgba(255,255,255,0.5); } 50% { text-shadow: 0 0 30px rgba(255,255,255,1), 0 0 50px rgba(90,34,163,0.5); } }
                @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
                @keyframes float { 0%,100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-60px) rotate(180deg); } }
            `}</style>
        </div>
    );
};
