import React, { useState, useEffect, useRef } from 'react';
import { chatService } from '../services/chatService';
import { ChatUser } from '../types';
import { awardPoints } from '../services/points';
import { ProAvatar } from './ProAvatar';
import './TimeBomb.css';

interface TimeBombProps {
    onHome: () => void;
    isOBS?: boolean;
}

interface BombConfig {
    joinKeyword: string;
    maxPlayers: number;
    minTimer: number;
    maxTimer: number;
    passTimeLimit: number;
}

interface Player extends ChatUser {
    num: number;
    alive: boolean;
    col: string;
}

type GamePhase = 'SETUP' | 'LOBBY' | 'PLAYING' | 'EXPLODED' | 'ROUND_END' | 'FINALE';

const COLORS = ['#f0c25a', '#d2824a', '#c9a86a', '#e0a458', '#b98a5a', '#f3d58a', '#cf9f6f', '#a9884f'];

const IC: Record<string, string> = {
    gear: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    play: '<path d="M6 3l14 9-14 9z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    exit: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.7V17c0 .6-.5 1-1 1.2C7.9 18.8 7 20.2 7 22M14 14.7V17c0 .6.5 1 1 1.2 1.1.6 2 2 2 3.8"/><path d="M18 2H6v7a6 6 0 0 0 12 0z"/>',
    skull: '<circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><path d="M8 20v2h8v-2M12.5 17l-.5-1-.5 1zM16 20a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20"/>',
    send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>'
};

const ic = (n: string, c = '') => `<svg class="ic ${c}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n] || ''}</svg>`;

const arDigits = (s: string) =>
    String(s)
        .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
        .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));

export const TimeBomb: React.FC<TimeBombProps> = ({ onHome, isOBS }) => {
    const [config, setConfig] = useState<BombConfig>({
        joinKeyword: 'دخول',
        maxPlayers: 50,
        minTimer: 15,
        maxTimer: 45,
        passTimeLimit: 8,
    });

    const [phase, setPhase] = useState<GamePhase>('SETUP');
    const [players, setPlayers] = useState<Player[]>([]);
    const [currentHolder, setCurrentHolder] = useState<Player | null>(null);
    const [bombTimer, setBombTimer] = useState(0);
    const [passTimer, setPassTimer] = useState(0);
    const [lastEliminated, setLastEliminated] = useState<Player | null>(null);
    const [winner, setWinner] = useState<Player | null>(null);
    const [eventMsg, setEventMsg] = useState('');
    const [shake, setShake] = useState(false);

    const phaseRef = useRef(phase);
    const configRef = useRef(config);
    const playersRef = useRef<Player[]>([]);
    const currentHolderRef = useRef<Player | null>(null);
    const bombTimerRef = useRef(bombTimer);
    const passTimerRef = useRef(passTimer);
    const lockRef = useRef(true);

    useEffect(() => { phaseRef.current = phase; }, [phase]);
    useEffect(() => { configRef.current = config; }, [config]);
    useEffect(() => { playersRef.current = players; }, [players]);
    useEffect(() => { currentHolderRef.current = currentHolder; }, [currentHolder]);
    useEffect(() => { bombTimerRef.current = bombTimer; }, [bombTimer]);
    useEffect(() => { passTimerRef.current = passTimer; }, [passTimer]);

    useEffect(() => {
        const unsub = chatService.onMessage((msg) => {
            const text = String(msg.content || '').trim();
            const username = msg.user?.username || '';
            if (!username) return;

            if (phaseRef.current === 'LOBBY') {
                const keyword = configRef.current.joinKeyword.trim();
                if (text === keyword || text.toLowerCase() === keyword.toLowerCase()) {
                    addPlayerChat(username, msg.user?.avatar);
                }
                return;
            }

            if (phaseRef.current === 'PLAYING' && currentHolderRef.current) {
                if (username.toLowerCase() === currentHolderRef.current.username.toLowerCase()) {
                    passFromChat(text);
                }
            }
        });
        return () => unsub();
    }, []);

    const addPlayerChat = (username: string, avatar?: string) => {
        setPlayers((prev) => {
            if (prev.length >= configRef.current.maxPlayers) return prev;
            if (prev.some((p) => p.username.toLowerCase() === username.toLowerCase())) return prev;
            let num = 1;
            while (prev.some((p) => p.num === num)) num++;
            const col = COLORS[([...username].reduce((a, c) => a + c.charCodeAt(0), 0)) % COLORS.length];
            const newPlayer: Player = {
                id: username,
                username,
                avatar,
                num,
                alive: true,
                col,
            } as Player;
            chatService.fetchKickAvatar(username).then((av) => {
                if (av) {
                    setPlayers((curr) => curr.map((p) => p.username.toLowerCase() === username.toLowerCase() ? { ...p, avatar: av } : p));
                }
            }).catch(() => {});
            return [...prev, newPlayer];
        });
    };

    const parseTarget = (t: string): Player | null => {
        const cleaned = arDigits(String(t || '')).trim();
        let m = cleaned.match(/^(?:رقم\s*)?(\d+)$/);
        if (m) {
            const num = parseInt(m[1]);
            return playersRef.current.find((p) => p.alive && p.num === num && p.username.toLowerCase() !== currentHolderRef.current?.username.toLowerCase()) || null;
        }
        m = cleaned.match(/^@?(\S+)$/);
        if (m) {
            const name = m[1].toLowerCase();
            return playersRef.current.find((p) => p.alive && p.username.toLowerCase() === name && p.username.toLowerCase() !== currentHolderRef.current?.username.toLowerCase()) || null;
        }
        return null;
    };

    const passFromChat = (text: string) => {
        const target = parseTarget(text);
        if (!target) return;
        if (lockRef.current) return;
        passBomb(target);
    };

    const passBomb = (to: Player) => {
        const from = currentHolderRef.current;
        if (!from || lockRef.current) return;
        setCurrentHolder(to);
        setPassTimer(configRef.current.passTimeLimit);
        setEventMsg(`${from.username} مرّر القنبلة إلى ${to.username} (رقم ${to.num})`);
        setTimeout(() => setEventMsg(''), 2000);
    };

    useEffect(() => {
        if (phase !== 'PLAYING') return;
        const interval = window.setInterval(() => {
            if (lockRef.current) return;
            setBombTimer((prev) => {
                if (prev <= 1) {
                    explodeBomb();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => window.clearInterval(interval);
    }, [phase]);

    useEffect(() => {
        if (phase !== 'PLAYING') return;
        const interval = window.setInterval(() => {
            setPassTimer((prev) => Math.max(0, prev - 1));
        }, 1000);
        return () => window.clearInterval(interval);
    }, [phase]);

    useEffect(() => {
        if (phase === 'PLAYING' && bombTimer > 0) {
            const total = config.maxTimer;
            const remaining = bombTimer / total;
            setShake(remaining < 0.3);
        } else {
            setShake(false);
        }
    }, [bombTimer, phase, config.maxTimer]);

    // Credit the last survivor once the board transitions to FINALE. Guarded by
    // the phase change (winner is set in the same tick, either in startRound or
    // explodeBomb), so it fires exactly once per match and not on every render.
    useEffect(() => {
        if (phase === 'FINALE' && winner) {
            awardPoints('TIME_BOMB', winner.username, winner.avatar || '', 'match');
        }
    }, [phase, winner]);

    const startGame = () => {
        if (players.length < 2) return;
        const alive = [...players].map((p) => ({ ...p, alive: true }));
        setPlayers(alive);
        playersRef.current = alive;
        lockRef.current = false;
        startRound(alive);
    };

    const startRound = (aliveList: Player[]) => {
        const alive = aliveList.filter((p) => p.alive);
        if (alive.length <= 1) {
            setWinner(alive[0] || null);
            setPhase('FINALE');
            return;
        }
        const randomHolder = alive[Math.floor(Math.random() * alive.length)];
        const randomTime = Math.floor(Math.random() * (config.maxTimer - config.minTimer + 1)) + config.minTimer;
        setCurrentHolder(randomHolder);
        currentHolderRef.current = randomHolder;
        setBombTimer(randomTime);
        setPassTimer(config.passTimeLimit);
        setEventMsg('');
        lockRef.current = false;
        setPhase('PLAYING');
    };

    const explodeBomb = () => {
        lockRef.current = true;
        const holder = currentHolderRef.current;
        if (!holder) return;
        setLastEliminated(holder);
        setPhase('EXPLODED');
        setTimeout(() => {
            const updated = playersRef.current.map((p) => p.username.toLowerCase() === holder.username.toLowerCase() ? { ...p, alive: false } : p);
            setPlayers(updated);
            playersRef.current = updated;
            const remaining = updated.filter((p) => p.alive);
            if (remaining.length <= 1) {
                setWinner(remaining[0] || null);
                setPhase('FINALE');
            } else {
                setPhase('ROUND_END');
            }
        }, 2000);
    };

    const nextRound = () => {
        startRound(playersRef.current);
    };

    const resetGame = () => {
        setPhase('SETUP');
        setPlayers([]);
        setCurrentHolder(null);
        setBombTimer(0);
        setPassTimer(0);
        setLastEliminated(null);
        setWinner(null);
        setEventMsg('');
        lockRef.current = true;
    };

    const stepConfig = (k: 'maxPlayers' | 'minTimer' | 'maxTimer' | 'passTimeLimit', dir: number) => {
        setConfig((prev) => {
            let newVal = prev[k] + dir * (k === 'maxPlayers' ? 5 : k === 'passTimeLimit' ? 1 : 5);
            if (k === 'maxPlayers') newVal = Math.max(2, Math.min(200, newVal));
            if (k === 'minTimer') newVal = Math.max(5, Math.min(prev.maxTimer - 5, newVal));
            if (k === 'maxTimer') newVal = Math.max(prev.minTimer + 5, Math.min(120, newVal));
            if (k === 'passTimeLimit') newVal = Math.max(3, Math.min(30, newVal));
            return { ...prev, [k]: newVal };
        });
    };

    const alivePlayers = players.filter((p) => p.alive);
    const deadPlayers = players.filter((p) => !p.alive);

    return (
        <div className="tb-root" data-s={phase.toLowerCase()} dir="rtl">
            <canvas className="fx" aria-hidden="true" />
            <div className="top"><img src="/logo-435242.png" alt="" />iCG1</div>
            <button className="exit" onClick={onHome} aria-label="خروج" dangerouslySetInnerHTML={{ __html: ic('exit') }}></button>

            <main>
                <header className="ttl">
                    <div className="wm"><h1>القنبلة الموقوتة</h1></div>
                    <div className="sub">TIME BOMB • iCG1</div>
                </header>

                {phase === 'SETUP' && (
                    <div className="two">
                        <div className="card">
                            <div className="ch"><h2>إعدادات اللعبة</h2><span dangerouslySetInnerHTML={{ __html: ic('gear') }} /></div>
                            <div className="box">
                                <div className="bl"><label>الحد الأقصى للاعبين</label><b>{config.maxPlayers}</b></div>
                                <input type="range" min="2" max="200" value={config.maxPlayers} onChange={(e) => setConfig({ ...config, maxPlayers: parseInt(e.target.value) })} />
                            </div>
                            <div className="row2">
                                <div className="box c"><label>أكثر وقت للقنبلة</label>
                                    <div className="stp">
                                        <button onClick={() => stepConfig('maxTimer', 1)} dangerouslySetInnerHTML={{ __html: ic('plus') }} />
                                        <b>{config.maxTimer}s</b>
                                        <button onClick={() => stepConfig('maxTimer', -1)} dangerouslySetInnerHTML={{ __html: ic('minus') }} />
                                    </div>
                                </div>
                                <div className="box c"><label>أقل وقت للقنبلة</label>
                                    <div className="stp">
                                        <button onClick={() => stepConfig('minTimer', 1)} dangerouslySetInnerHTML={{ __html: ic('plus') }} />
                                        <b>{config.minTimer}s</b>
                                        <button onClick={() => stepConfig('minTimer', -1)} dangerouslySetInnerHTML={{ __html: ic('minus') }} />
                                    </div>
                                </div>
                            </div>
                            <div className="box c"><label>وقت التمرير (ثواني)</label>
                                <div className="stp">
                                    <button onClick={() => stepConfig('passTimeLimit', 1)} dangerouslySetInnerHTML={{ __html: ic('plus') }} />
                                    <b>{config.passTimeLimit}s</b>
                                    <button onClick={() => stepConfig('passTimeLimit', -1)} dangerouslySetInnerHTML={{ __html: ic('minus') }} />
                                </div>
                            </div>
                            <div className="box"><label>كلمة الانضمام</label><input className="txt" value={config.joinKeyword} onChange={(e) => setConfig({ ...config, joinKeyword: e.target.value })} maxLength={12} /></div>
                        </div>
                        <div className="card hw">
                            <svg className="bomb" width={120} height={120} viewBox="-6 -12 112 120" aria-hidden="true">
                                <circle cx="46" cy="60" r="34" fill="#17100a" stroke="#e8be6e" strokeWidth="5"/>
                                <circle cx="46" cy="60" r="26" fill="none" stroke="rgba(232,190,110,.28)" strokeWidth="2"/>
                                <path d="M24 52a24 24 0 0 1 13-17" fill="none" stroke="#f6e2b2" strokeWidth="5" strokeLinecap="round"/>
                                <rect x="37" y="18" width="20" height="14" rx="3" fill="#e8be6e"/>
                                <path d="M47 18c0-10 9-11 17-18" fill="none" stroke="#c98a4a" strokeWidth="5" strokeLinecap="round"/>
                                <g className="sp" stroke="#ffb347" strokeWidth="4" strokeLinecap="round">
                                    <path d="M68-6v14M61 1h14M63-4l10 10M73-4L63 6"/>
                                </g>
                            </svg>
                            <h2>كيف تلعب؟</h2>
                            <ol>
                                <li><span className="sn">1</span><span>القنبلة تبدأ عند لاعب عشوائي</span></li>
                                <li><span className="sn">2</span><span>اكتب رقم اللاعب لتمريرها، مثل <span className="nb">8</span></span></li>
                                <li><span className="sn">3</span><span>من تنفجر عنده يخرج!</span></li>
                            </ol>
                            <button className="go" onClick={() => setPhase('LOBBY')}><span dangerouslySetInnerHTML={{ __html: ic('play', 'f') }} />بدء المعركة</button>
                        </div>
                    </div>
                )}

                {phase === 'LOBBY' && (
                    <>
                        <div className="lob">
                            <svg className="bomb" width={90} height={90} viewBox="-6 -12 112 120" aria-hidden="true">
                                <circle cx="46" cy="60" r="34" fill="#17100a" stroke="#e8be6e" strokeWidth="5"/>
                                <circle cx="46" cy="60" r="26" fill="none" stroke="rgba(232,190,110,.28)" strokeWidth="2"/>
                                <path d="M24 52a24 24 0 0 1 13-17" fill="none" stroke="#f6e2b2" strokeWidth="5" strokeLinecap="round"/>
                                <rect x="37" y="18" width="20" height="14" rx="3" fill="#e8be6e"/>
                                <path d="M47 18c0-10 9-11 17-18" fill="none" stroke="#c98a4a" strokeWidth="5" strokeLinecap="round"/>
                                <g className="sp" stroke="#ffb347" strokeWidth="4" strokeLinecap="round">
                                    <path d="M68-6v14M61 1h14M63-4l10 10M73-4L63 6"/>
                                </g>
                            </svg>
                            <h2 className="h2">في انتظار اللاعبين</h2>
                            <div className="pill"><span>أرسل</span><b className="word">{config.joinKeyword}</b><span>للمشاركة</span></div>
                            <div className="plist">
                                {players.length ? players.map((p) => (
                                    <div className="pcard" key={p.username}>
                                        <span className="nb">{p.num}</span>
                                        <div className="av" style={{ '--ac': p.col } as any}><ProAvatar url={p.avatar} username={p.username} size="w-full h-full" /></div>
                                        <span className="t">{p.username}</span>
                                    </div>
                                )) : (
                                    <div className="emp"><span dangerouslySetInnerHTML={{ __html: ic('users') }} /><span>لا يوجد لاعبون بعد</span></div>
                                )}
                            </div>
                        </div>
                        <div className="dock">
                            <div className="cnt"><b>{players.length}</b><small>/{config.maxPlayers}</small></div>
                            <span className="sp"></span>
                            <button className="btn2" onClick={resetGame}>تراجع</button>
                            <button className="btn1" onClick={startGame} disabled={players.length < 2}><span dangerouslySetInnerHTML={{ __html: ic('play', 'f') }} />ابدأ!</button>
                        </div>
                    </>
                )}

                {phase === 'PLAYING' && currentHolder && (
                    <>
                        <div className="rd">
                            <span className="chip"><svg className="bomb" width={18} height={18} viewBox="-6 -12 112 120" aria-hidden="true"><circle cx="46" cy="60" r="34" fill="#17100a" stroke="#e8be6e" strokeWidth="5"/><circle cx="46" cy="60" r="26" fill="none" stroke="rgba(232,190,110,.28)" strokeWidth="2"/><path d="M24 52a24 24 0 0 1 13-17" fill="none" stroke="#f6e2b2" strokeWidth="5" strokeLinecap="round"/><rect x="37" y="18" width="20" height="14" rx="3" fill="#e8be6e"/><path d="M47 18c0-10 9-11 17-18" fill="none" stroke="#c98a4a" strokeWidth="5" strokeLinecap="round"/><g className="sp" stroke="#ffb347" strokeWidth="4" strokeLinecap="round"><path d="M68-6v14M61 1h14M63-4l10 10M73-4L63 6"/></g></svg>مع <b>{currentHolder.username}</b></span>
                            <span className="chip">باقي <b>{alivePlayers.length}</b></span>
                        </div>
                        <div className={`hcard ${shake ? 'shake' : ''}`} style={{ '--bs': `${Math.max(0.4, bombTimer / config.maxTimer * 1.2)}s` } as any}>
                            <div className={`hv in`}>
                                <div className="av lg" style={{ '--ac': currentHolder.col } as any}><ProAvatar url={currentHolder.avatar} username={currentHolder.username} size="w-full h-full" /></div>
                                <div className="hn">{currentHolder.username}</div>
                                <div className="hnum">رقمه <span className="nb">{currentHolder.num}</span></div>
                            </div>
                            <div className="bw"><svg className="bomb" width={96} height={96} viewBox="-6 -12 112 120" aria-hidden="true"><circle cx="46" cy="60" r="34" fill="#17100a" stroke="#e8be6e" strokeWidth="5"/><circle cx="46" cy="60" r="26" fill="none" stroke="rgba(232,190,110,.28)" strokeWidth="2"/><path d="M24 52a24 24 0 0 1 13-17" fill="none" stroke="#f6e2b2" strokeWidth="5" strokeLinecap="round"/><rect x="37" y="18" width="20" height="14" rx="3" fill="#e8be6e"/><path d="M47 18c0-10 9-11 17-18" fill="none" stroke="#c98a4a" strokeWidth="5" strokeLinecap="round"/><g className="sp" stroke="#ffb347" strokeWidth="4" strokeLinecap="round"><path d="M68-6v14M61 1h14M63-4l10 10M73-4L63 6"/></g></svg></div>
                            <p className="hint">اكتب رقم اللاعب لتمرير القنبلة. مثال: <span className="nb">{alivePlayers.find(p => p.num !== currentHolder.num)?.num || 1}</span></p>
                            <div className="pt">
                                <div className="bar"><i style={{ width: `${(bombTimer / config.maxTimer) * 100}%` }} className={bombTimer <= 5 ? 'low' : ''}></i></div>
                                <span>{bombTimer}</span>
                            </div>
                        </div>
                        {eventMsg && <div className="evt">{eventMsg}</div>}
                        <div className="chips">
                            {alivePlayers.filter(p => p.username !== currentHolder.username).map(p => (
                                <div className="pc" key={p.username}>
                                    <span className="nb">{p.num}</span>
                                    <div className="av" style={{ '--ac': p.col } as any}><ProAvatar url={p.avatar} username={p.username} size="w-full h-full" /></div>
                                    <span>{p.username}</span>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {phase === 'EXPLODED' && lastEliminated && (
                    <div className="ov on">
                        <div className="flash"></div>
                        <div className="boom">
                            <svg viewBox="0 0 200 200" aria-hidden="true">
                                <polygon points="100,10 120,70 180,70 130,110 150,170 100,130 50,170 70,110 20,70 80,70" fill="#ff9a3c" stroke="#fff0b8" strokeWidth="4" strokeLinejoin="round"/>
                                <circle cx="100" cy="100" r="34" fill="#ffe08a"/>
                                <circle cx="100" cy="100" r="18" fill="#fff8e0"/>
                            </svg>
                            <h2>انفجرت عند {lastEliminated.username}!</h2>
                            <p>رقم {lastEliminated.num} خرج من اللعبة</p>
                        </div>
                    </div>
                )}

                {phase === 'FINALE' && winner && (
                    <div className="ov on">
                        <div className="card winc boom">
                            <div className="tro"><span dangerouslySetInnerHTML={{ __html: ic('trophy', 'f') }} /></div>
                            <h2>الفائز</h2>
                            <div className="av lg" style={{ '--ac': winner.col } as any}><ProAvatar url={winner.avatar} username={winner.username} size="w-full h-full" /></div>
                            <h2>{winner.username}</h2>
                            <p>رقم {winner.num}</p>
                            <div className="row">
                                <button className="btn1" onClick={startGame}><span dangerouslySetInnerHTML={{ __html: ic('play', 'f') }} />العب مرة ثانية</button>
                                <button className="btn2" onClick={resetGame}>الإعدادات</button>
                            </div>
                        </div>
                    </div>
                )}

                {phase === 'ROUND_END' && (
                    <div className="ov on">
                        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
                            <h2 style={{ font: 'italic 800 42px var(--dsp)', margin: '0 0 20px' }}>الباقون: {alivePlayers.length}</h2>
                            <div className="chips" style={{ marginBottom: '30px' }}>
                                {alivePlayers.map(p => (
                                    <div className="pc" key={p.username}>
                                        <span className="nb">{p.num}</span>
                                        <div className="av" style={{ '--ac': p.col } as any}><ProAvatar url={p.avatar} username={p.username} size="w-full h-full" /></div>
                                        <span>{p.username}</span>
                                    </div>
                                ))}
                            </div>
                            <button className="btn1" onClick={nextRound}>الجولة التالية</button>
                        </div>
                    </div>
                )}
            </main>
            <div id="toast" role="status"></div>
        </div>
    );
};
