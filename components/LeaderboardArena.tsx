import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Crown, Medal, RefreshCw, Search, Trophy, Users, Flame, Home, ChevronRight, Star,
    Skull, RotateCw, Image as ImageIcon, Flag, Keyboard, Bomb, Globe, Lock, Type, Brain,
    Armchair, Coffee, PaintBucket, Footprints, Swords, ArrowUp, Gift, Timer, Volume2 } from 'lucide-react';
import { ProAvatar } from './ProAvatar';
import { gameLeaderboardService } from '../services/supabase';
import { GAME_POINTS } from '../services/gameRewards';
import { GAME_DETAILS } from './home435242Icons';
import { useArenaStatus, type ArenaFx, type ArenaStatus } from '../services/arenaStatus';

interface LeaderboardArenaProps {
    data: any[];
    loading: boolean;
    onRefresh: () => void;
    onHome: () => void;
    me?: string;
    games?: any[];
    initialGame?: string;
}

const PAGE = 15;

const fmt = (n: any) => (Number(n) || 0).toLocaleString('en-US');

const GLOBAL = 'GLOBAL';

const GAME_ICONS: Record<string, any> = {
    MAHMAH_GAME: Skull,
    SPIN_WHEEL: RotateCw,
    BLUR_GUESS: ImageIcon,
    FLAG_QUIZ: Flag,
    TYPING_RACE: Keyboard,
    TIME_BOMB: Bomb,
    MAP_GUESSER: Globe,
    SAFE_CODE: Lock,
    LETTER_GAME: Type,
    TRUTH_OR_LIE: Brain,
    MUSICAL_CHAIRS: Armchair,
    CUP_SHUFFLE: Coffee,
    DRAWING_CHALLENGE: PaintBucket,
    GLASS_BRIDGE_V2: Footprints,
    EMOJI_CODE: Swords,
    HIGHER_LOWER: ArrowUp,
    FLOOR_IS_LAVA: Flame,
    RAFFLE: Gift,
};

const gameTitle = (code: string) => GAME_DETAILS[code]?.title || code;

const PERIODS = [
    { id: 'all', label: 'كل الوقت', days: 0 },
    { id: 'week', label: 'أسبوع', days: 7 },
    { id: 'month', label: 'شهر', days: 30 },
] as const;

type PeriodId = typeof PERIODS[number]['id'];

const sinceFor = (period: PeriodId): string | null => {
    const days = PERIODS.find(p => p.id === period)?.days || 0;
    if (!days) return null;
    return new Date(Date.now() - days * 86400000).toISOString();
};

const LeaderboardArena: React.FC<LeaderboardArenaProps> = ({ data, loading, onRefresh, onHome, me, games, initialGame }) => {
    const [query, setQuery] = useState('');
    const [limit, setLimit] = useState(PAGE);
    const [selected, setSelected] = useState<string>(initialGame && GAME_POINTS[initialGame] ? initialGame : GLOBAL);
    const [period, setPeriod] = useState<PeriodId>('all');
    const [nonce, setNonce] = useState(0);

    const [gameRows, setGameRows] = useState<any[]>([]);
    const [gameSummary, setGameSummary] = useState<any>(null);
    const [mePos, setMePos] = useState<any>(null);
    const [gameLoading, setGameLoading] = useState(false);
    const [badges, setBadges] = useState<Record<string, any>>({});

    // سمة الساحة + الجزيئات + الصوت العام: كلها من arena_status، تتغيّر عند المشاهدين فور حفظ المشرف
    const { status: arena } = useArenaStatus();

    const isGame = selected !== GLOBAL;

    // ترتيب التبويبات على نفس ترتيب الرئيسية، وكل لعبة تعطي نقاطاً موجودة
    const tabs = useMemo(() => {
        const awardable = Object.keys(GAME_POINTS);
        const ordered: string[] = [];
        (games || []).forEach((g: any) => {
            const code = String(g?.view_id || '').toUpperCase();
            if (awardable.includes(code) && !ordered.includes(code)) ordered.push(code);
        });
        awardable.forEach(code => { if (!ordered.includes(code)) ordered.push(code); });
        return ordered;
    }, [games]);

    useEffect(() => {
        if (!isGame) return;
        let alive = true;
        setGameLoading(true);
        const since = sinceFor(period);
        Promise.all([
            gameLeaderboardService.getTop(selected, since, 200),
            gameLeaderboardService.getSummary(selected, since),
            me ? gameLeaderboardService.getPosition(selected, me, since) : Promise.resolve(null),
        ]).then(([rows, summary, pos]) => {
            if (!alive) return;
            setGameRows(rows || []);
            setGameSummary(summary);
            setMePos(pos);
            setGameLoading(false);
        }).catch(() => { if (alive) setGameLoading(false); });
        return () => { alive = false; };
    }, [selected, period, me, nonce, isGame]);

    useEffect(() => {
        let alive = true;
        gameLeaderboardService.getGamesSummary(sinceFor(period))
            .then(map => { if (alive) setBadges(map || {}); })
            .catch(() => { });
        return () => { alive = false; };
    }, [period, nonce]);

    const rankedGlobal = useMemo(() => {
        const seen: Record<string, boolean> = {};
        return data
            .filter(r => r && r.username && !seen[String(r.username).toLowerCase()] && (seen[String(r.username).toLowerCase()] = true))
            .slice()
            .sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
    }, [data]);

    const rankedGame = useMemo(() => gameRows
        .filter(r => r && r.username)
        .slice()
        .sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0) || (Number(b.wins) || 0) - (Number(a.wins) || 0)),
        [gameRows]);

    const ranked = isGame ? rankedGame : rankedGlobal;
    const busy = isGame ? gameLoading : loading;

    const topScore = Number(ranked[0]?.score) || 0;
    const totalPoints = useMemo(() => ranked.reduce((s, r) => s + (Number(r.score) || 0), 0), [ranked]);
    const totalWins = useMemo(() => ranked.reduce((s, r) => s + (Number(r.wins) || 0), 0), [ranked]);
    const totalRounds = useMemo(() => ranked.reduce((s, r) => s + (Number(r.rounds) || 0), 0), [ranked]);

    const stats = isGame
        ? [
            { v: gameSummary?.players ?? ranked.length, l: 'لاعب في اللعبة' },
            { v: gameSummary?.total_points ?? totalPoints, l: 'نقطة موزّعة' },
            { v: gameSummary?.total_wins ?? totalWins, l: `فوز كامل · ${fmt(totalRounds)} جولة` },
            { v: gameSummary?.top_score ?? topScore, l: 'أعلى رصيد' },
        ]
        : [
            { v: ranked.length, l: 'لاعب مسجّل' },
            { v: totalPoints, l: 'مجموع النقاط' },
            { v: totalWins, l: 'انتصارات كاملة' },
            { v: topScore, l: 'أعلى رصيد' },
        ];

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return ranked;
        return ranked.filter(r => String(r.username).toLowerCase().includes(q));
    }, [ranked, query]);

    const searching = query.trim().length > 0;
    const podium = ranked.slice(0, 3);
    const rest = searching ? filtered : filtered.slice(3);
    const shown = rest.slice(0, limit);

    const reload = () => { setNonce(n => n + 1); onRefresh(); };
    const pickGame = (code: string) => { setSelected(code); setQuery(''); setLimit(PAGE); };

    const EmptyIcon = isGame ? (GAME_ICONS[selected] || Trophy) : Trophy;
    const headTitle = isGame ? `صدارة ${gameTitle(selected)}` : 'لوحة الصدارة';
    const headSub = isGame
        ? `${period === 'all' ? 'كل الوقت' : `آخر ${PERIODS.find(p => p.id === period)?.days} يوم`} · النقاط تُحتسب تلقائياً مع كل فوز في هذه اللعبة`
        : 'ترتيب اللاعبين بالنقاط — يتحدث مباشرة مع كل فوز في أي لعبة';

    return (
        <div className={`lba-root lba-${arena.theme}`}>
            <style>{LBA_STYLES}</style>

            <ArenaFx kind={arena.particles} />
            <ArenaAudio audio={arena.audio} />

            <header className="lba-head">
                <div className="lba-head-mark"><Trophy /></div>
                <div className="lba-head-text">
                    <h1 className="lba-title">{headTitle}</h1>
                    <p className="lba-sub">{headSub}</p>
                </div>
                <div className="lba-head-actions">
                    <button className="lba-btn" onClick={reload} disabled={busy}>
                        <RefreshCw className={busy ? 'spin' : ''} /> تحديث
                    </button>
                    <button className="lba-btn ghost" onClick={onHome}>
                        <Home /> الرئيسية
                    </button>
                </div>
            </header>

            {/* زر رجوع عائم للصفحة الرئيسية (مريح بالهاتف) */}
            <button className="lba-back" onClick={onHome} aria-label="العودة إلى الصفحة الرئيسية">
                <ChevronRight />
                <span>الصفحة الرئيسية</span>
            </button>

            <nav className="lba-tabs">
                <button className={`lba-tab${!isGame ? ' on' : ''}`} onClick={() => pickGame(GLOBAL)}>
                    <Trophy />
                    <b>العام</b>
                    <i>{fmt(rankedGlobal.length)}</i>
                </button>
                {tabs.map(code => {
                    const Icon = GAME_ICONS[code] || Star;
                    const b = badges[code];
                    return (
                        <button key={code} className={`lba-tab${selected === code ? ' on' : ''}`} onClick={() => pickGame(code)}
                            title={`${gameTitle(code)} — ${fmt(b?.players || 0)} لاعب`}>
                            <Icon />
                            <b>{gameTitle(code)}</b>
                            <i>{fmt(b?.players || 0)}</i>
                        </button>
                    );
                })}
            </nav>

            {isGame && (
                <div className="lba-periods">
                    <Timer />
                    <span>الفترة</span>
                    {PERIODS.map(p => (
                        <button key={p.id} className={`lba-per${period === p.id ? ' on' : ''}`}
                            onClick={() => { setPeriod(p.id); setLimit(PAGE); }}>{p.label}</button>
                    ))}
                </div>
            )}

            <div className="lba-stats">
                {stats.map((s, i) => (
                    <div key={i} className="lba-stat"><b>{fmt(s.v)}</b><span>{s.l}</span></div>
                ))}
            </div>

            {busy && !ranked.length ? (
                <div className="lba-skeleton">
                    {[0, 1, 2, 3, 4].map(i => <div key={i} className="lba-sk-row" style={{ animationDelay: `${i * 90}ms` }} />)}
                </div>
            ) : !ranked.length ? (
                <div className="lba-empty">
                    <EmptyIcon />
                    <b>{isGame ? `لا نقاط في ${gameTitle(selected)} بعد` : 'لا يوجد لاعبون بعد'}</b>
                    <span>{isGame
                        ? (period === 'all' ? 'كن أول من يفوز بهذه اللعبة ويظهر هنا.' : `ما أحد سجّل نقاط في ${gameTitle(selected)} خلال هذه الفترة — جرّب «كل الوقت».`)
                        : 'ابدأ لعبة وفز بجولتك الأولى لتظهر هنا.'}</span>
                    <button className="lba-btn" onClick={onHome}><ChevronRight /> إلى الألعاب</button>
                </div>
            ) : (
                <>
                    {!searching && (
                    <section className="lba-podium">
                        {podium[1] && (
                            <article className="lba-pod silver">
                                <div className="lba-pod-rank">{Number(podium[1].pos) || 2}</div>
                                <div className="lba-pod-avatar">
                                    <ProAvatar username={podium[1].username} url={podium[1].avatar_url} frameUrl={podium[1].active_frame_url} size="w-24 h-24" />
                                </div>
                                <b className="lba-pod-name">{podium[1].username}</b>
                                <div className="lba-pod-score">{fmt(podium[1].score)}<em>نقطة</em></div>
                                <div className="lba-pod-wins"><Medal /> {fmt(podium[1].wins)} فوز</div>
                                <div className="lba-pod-stand" style={{ height: '86px' }} />
                            </article>
                        )}

                        {podium[0] && (
                            <article className="lba-pod gold">
                                <div className="lba-crown"><Crown /></div>
                                <div className="lba-pod-rank">{Number(podium[0].pos) || 1}</div>
                                <div className="lba-pod-avatar">
                                    <div className="lba-halo" />
                                    <ProAvatar username={podium[0].username} url={podium[0].avatar_url} frameUrl={podium[0].active_frame_url} size="w-32 h-32" />
                                </div>
                                <b className="lba-pod-name">{podium[0].username}</b>
                                <div className="lba-pod-score">{fmt(podium[0].score)}<em>نقطة</em></div>
                                <div className="lba-pod-wins"><Flame /> {fmt(podium[0].wins)} فوز</div>
                                <div className="lba-pod-stand" style={{ height: '124px' }}>
                                    <span>{isGame ? `بطل ${gameTitle(selected)}` : 'بطل الساحة'}</span>
                                </div>
                            </article>
                        )}

                        {podium[2] && (
                            <article className="lba-pod bronze">
                                <div className="lba-pod-rank">{Number(podium[2].pos) || 3}</div>
                                <div className="lba-pod-avatar">
                                    <ProAvatar username={podium[2].username} url={podium[2].avatar_url} frameUrl={podium[2].active_frame_url} size="w-24 h-24" />
                                </div>
                                <b className="lba-pod-name">{podium[2].username}</b>
                                <div className="lba-pod-score">{fmt(podium[2].score)}<em>نقطة</em></div>
                                <div className="lba-pod-wins"><Star /> {fmt(podium[2].wins)} فوز</div>
                                <div className="lba-pod-stand" style={{ height: '62px' }} />
                            </article>
                        )}
                    </section>
                    )}

                    {isGame && me && (
                        <section className={`lba-me${mePos ? ' has' : ''}`}>
                            <div className="lba-me-pos">
                                <span>موقعك</span>
                                <b>{mePos ? `#${fmt(mePos.pos)}` : '—'}</b>
                            </div>
                            <div className="lba-me-name">
                                <ProAvatar username={me} url="" size="w-10 h-10" />
                                <div>
                                    <b>{me}</b>
                                    <span>{mePos
                                        ? `${fmt(mePos.score)} نقطة · ${fmt(mePos.wins)} فوز كامل · ${fmt(mePos.plays)} مكافأة مسجّلة`
                                        : `ما لك نقاط في ${gameTitle(selected)} ${period === 'all' ? 'بعد' : 'خلال هذه الفترة'}`}</span>
                                </div>
                            </div>
                            <div className="lba-me-gap">
                                {mePos && Number(mePos.pos) > 1
                                    ? <>تحتاج <b>{fmt(topScore - (Number(mePos.score) || 0))}</b> نقطة لتتصدّر اللعبة</>
                                    : mePos
                                        ? <>أنت متصدّر {gameTitle(selected)}</>
                                        : <>العب وفز بجولة لتظهر هنا</>}
                            </div>
                        </section>
                    )}

                    <section className={`lba-board${isGame ? ' per-game' : ''}`}>
                        <div className="lba-board-bar">
                            <div className="lba-board-title">
                                <Users /> {isGame ? `متصدرو ${gameTitle(selected)}` : 'بقية المتسابقين'}
                                <span className="lba-count">{fmt(filtered.length)}</span>
                            </div>
                            <label className="lba-search">
                                <Search />
                                <input
                                    value={query}
                                    onChange={e => { setQuery(e.target.value); setLimit(PAGE); }}
                                    placeholder="ابحث عن اسمك أو اسم لاعب"
                                />
                                {query && <button className="lba-clear" onClick={() => setQuery('')}>×</button>}
                            </label>
                        </div>

                        <div className="lba-thead">
                            <span>الترتيب</span>
                            <span>اللاعب</span>
                            <span>الفوز</span>
                            {isGame && <span>جولات</span>}
                            <span>النقاط</span>
                        </div>

                        <div className="lba-rows">
                            {shown.map((row, i) => {
                                const rank = Number(row.pos) || (ranked.indexOf(row) + 1);
                                const pct = topScore > 0 ? Math.max(4, Math.round(((Number(row.score) || 0) / topScore) * 100)) : 0;
                                const isMe = me && String(row.username).toLowerCase() === String(me).toLowerCase();
                                return (
                                    <div key={String(row.username).toLowerCase()} className={`lba-row${isMe ? ' me' : ''}${isGame ? ' five' : ''}`} style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}>
                                        <div className="lba-rank">{rank}</div>
                                        <div className="lba-player">
                                            <ProAvatar username={row.username} url={row.avatar_url} frameUrl={row.active_frame_url} size="w-10 h-10" />
                                            <b>{row.username}</b>
                                            {isMe && <i className="lba-tag">أنت</i>}
                                        </div>
                                        <div className="lba-wins">{fmt(row.wins)}</div>
                                        {isGame && <div className="lba-wins">{fmt(row.rounds)}</div>}
                                        <div className="lba-pts">
                                            <div className="lba-pts-bar"><i style={{ width: `${pct}%` }} /></div>
                                            <strong>{fmt(row.score)}</strong>
                                        </div>
                                    </div>
                                );
                            })}
                            {!shown.length && searching && (
                                <div className="lba-noresult">لا يوجد اسم مطابق لـ «{query}»</div>
                            )}
                        </div>

                        {!searching && rest.length > limit && (
                            <button className="lba-more" onClick={() => setLimit(l => l + PAGE)}>
                                عرض المزيد ({fmt(rest.length - limit)})
                            </button>
                        )}
                    </section>
                </>
            )}
        </div>
    );
};

/* الجزيئات: طبقة canvas فوق الساحة كلها، تتبع نوع المؤثر المحفوظ في arena_status */
const FX_COUNT: Record<Exclude<ArenaFx, 'none'>, number> = { snow: 90, ember: 70, celeb: 80 };

function ArenaFx({ kind }: { kind: ArenaFx }) {
    const ref = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        if (kind === 'none') return;
        const c = ref.current;
        if (!c) return;
        const ctx = c.getContext('2d');
        if (!ctx) return;

        let W = 0, H = 0, raf = 0;
        const rnd = (a: number, b: number) => a + Math.random() * (b - a);
        const size = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            W = c.clientWidth; H = c.clientHeight;
            c.width = Math.max(1, Math.round(W * dpr));
            c.height = Math.max(1, Math.round(H * dpr));
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };
        size();

        type P = { x: number; y: number; r: number; vy: number; vx: number; a: number; hue: number; sq: boolean };
        const seed = (): P => ({
            x: rnd(0, W), y: rnd(0, H),
            r: kind === 'celeb' ? rnd(2.5, 5) : rnd(1, 3.2),
            vy: kind === 'ember' ? -rnd(.25, .8) : rnd(.25, .9),
            vx: rnd(-.25, .25),
            a: rnd(0, 6.28),
            hue: kind === 'celeb' ? rnd(0, 360) : kind === 'ember' ? rnd(14, 38) : 45,
            sq: kind === 'celeb' && Math.random() > .45,
        });
        const ps = Array.from({ length: FX_COUNT[kind] }, seed);

        window.addEventListener('resize', size);
        const loop = () => {
            ctx.clearRect(0, 0, W, H);
            for (const p of ps) {
                p.a += kind === 'snow' ? .015 : .045;
                p.y += p.vy;
                p.x += p.vx + (kind === 'snow' ? Math.sin(p.a) * .5 : Math.sin(p.a) * .9);
                if (kind === 'celeb') p.y += Math.abs(Math.sin(p.a)) * .25;

                const out = kind === 'ember' ? p.y < -12 : p.y > H + 12 || p.y < -12;
                if (out) {
                    p.y = kind === 'ember' ? H + rnd(0, 20) : rnd(-20, 0);
                    p.x = rnd(0, W);
                    if (kind === 'celeb') p.hue = rnd(0, 360);
                }
                if (p.x < -14) p.x = W + 12; else if (p.x > W + 14) p.x = -12;

                const glow = .4 + Math.abs(Math.sin(p.a)) * .55;
                ctx.fillStyle = kind === 'snow'
                    ? `rgba(255,255,255,${glow * .85})`
                    : `hsla(${p.hue},90%,${kind === 'ember' ? 58 : 62}%,${glow})`;
                ctx.shadowBlur = kind === 'ember' ? 12 : 6;
                ctx.shadowColor = kind === 'snow' ? 'rgba(255,255,255,.5)' : `hsla(${p.hue},90%,60%,.8)`;
                if (p.sq) ctx.fillRect(p.x, p.y, p.r * 2.2, p.r * 1.4);
                else { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill(); }
            }
            raf = requestAnimationFrame(loop);
        };
        loop();
        return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', size); };
    }, [kind]);

    if (kind === 'none') return null;
    return <canvas ref={ref} className="lba-fx" aria-hidden="true" />;
}

/* الصوت العام: المتصفح يرفض التشغيل الذاتي بلا تفاعل، فالزر يظهر فقط عند الرفض */
function ArenaAudio({ audio }: { audio: ArenaStatus['audio'] }) {
    const ref = useRef<HTMLAudioElement | null>(null);
    const [blocked, setBlocked] = useState(false);

    const play = useCallback(() => {
        const el = ref.current;
        if (!el) return;
        el.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
    }, []);

    const src = audio.enabled ? audio.url : '';

    useEffect(() => {
        const el = ref.current;
        if (!el || !src) return;
        el.volume = audio.volume / 100;
        play();
    }, [src, audio.volume, play]);

    // إيقاف نظيف عند إخفاء الصوت من اللوحة
    useEffect(() => {
        if (src) return;
        const el = ref.current;
        if (el) { el.pause(); el.currentTime = 0; }
        setBlocked(false);
    }, [src]);

    if (!src) return null;
    return (
        <>
            <audio ref={ref} src={src} loop preload="auto" />
            {blocked && (
                <button className="lba-audio" onClick={play} title="تشغيل صوت الساحة">
                    <Volume2 /> موسيقى الساحة
                </button>
            )}
        </>
    );
}

const LBA_STYLES = /* CSS */ `
.lba-root {
  --gold: #e8be6e; --gold-lt: #f9e0a4; --gold-dp: #a97a30;
  --cream: #fbeccb; --muted: #b2a283; --ink: #0a0805; --ember: #e8552f;
  width: 100%; max-width: 1080px; margin: 0 auto; padding: 26px 18px 70px;
  color: var(--cream); font-family: "Tajawal", Tahoma, sans-serif; text-align: right;
}
.lba-root * { box-sizing: border-box; }
.lba-root .lba-head svg,
.lba-root .lba-btn svg,
.lba-root .lba-pod-wins svg,
.lba-root .lba-board-title svg,
.lba-root .lba-search svg,
.lba-root .lba-empty svg,
.lba-root .lba-tab svg,
.lba-root .lba-periods svg { width: 1em; height: 1em; }

.lba-head { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 20px; }
.lba-head-mark {
  width: 62px; height: 62px; border-radius: 20px; font-size: 30px; display: flex; align-items: center; justify-content: center;
  color: var(--ink); background: linear-gradient(150deg, var(--gold-lt), var(--gold-dp));
  box-shadow: 0 14px 34px rgba(232,190,110,.28), inset 0 1px 0 rgba(255,255,255,.6);
}
.lba-head-text { flex: 1; min-width: 220px; }
.lba-title {
  margin: 0; font-size: clamp(28px, 5vw, 42px); font-weight: 900; font-style: italic; letter-spacing: -.5px;
  background: linear-gradient(180deg, #fff6e0, var(--gold) 55%, var(--gold-dp));
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.lba-sub { margin: 4px 0 0; font-size: 13px; font-weight: 700; color: var(--muted); }
.lba-head-actions { display: flex; gap: 10px; }
.lba-btn {
  display: inline-flex; align-items: center; gap: 8px; padding: 11px 18px; border-radius: 14px; cursor: pointer;
  font-family: inherit; font-size: 14px; font-weight: 900; color: var(--ink); font-style: normal;
  background: linear-gradient(150deg, var(--gold-lt), var(--gold)); border: 1px solid rgba(255,255,255,.25);
  box-shadow: 0 10px 26px rgba(232,190,110,.22); transition: transform .15s ease, box-shadow .15s ease;
}
.lba-btn:hover { transform: translateY(-2px); box-shadow: 0 16px 34px rgba(232,190,110,.32); }
.lba-btn:disabled { opacity: .6; cursor: default; transform: none; }
.lba-btn.ghost { background: rgba(255,255,255,.05); color: var(--cream); border: 1px solid rgba(232,190,110,.28); box-shadow: none; }
.lba-btn.ghost:hover { background: rgba(232,190,110,.12); }
.spin { animation: lbaSpin 1s linear infinite; }
@keyframes lbaSpin { to { transform: rotate(360deg); } }

.lba-tabs {
  display: flex; gap: 8px; overflow-x: auto; padding: 4px 4px 12px; margin-bottom: 2px;
  scrollbar-width: thin; scrollbar-color: rgba(232,190,110,.35) transparent;
}
.lba-tabs::-webkit-scrollbar { height: 6px; }
.lba-tabs::-webkit-scrollbar-thumb { background: rgba(232,190,110,.35); border-radius: 99px; }
.lba-tab {
  display: inline-flex; align-items: center; gap: 8px; flex-shrink: 0; padding: 9px 14px; border-radius: 14px; cursor: pointer;
  font-family: inherit; color: var(--muted); background: rgba(255,255,255,.04); border: 1px solid rgba(232,190,110,.16);
  transition: color .16s ease, background .16s ease, border-color .16s ease;
}
.lba-tab svg { font-size: 17px; opacity: .85; }
.lba-tab b { font-size: 13px; font-weight: 900; white-space: nowrap; }
.lba-tab i {
  font-style: normal; font-size: 11px; font-weight: 900; padding: 2px 8px; border-radius: 99px;
  background: rgba(0,0,0,.35); color: var(--gold-lt); font-variant-numeric: tabular-nums;
}
.lba-tab:hover { color: var(--cream); border-color: rgba(232,190,110,.4); background: rgba(232,190,110,.08); }
.lba-tab.on {
  color: var(--ink); background: linear-gradient(150deg, var(--gold-lt), var(--gold));
  border-color: rgba(255,255,255,.35); box-shadow: 0 10px 26px rgba(232,190,110,.26);
}
.lba-tab.on i { background: rgba(10,8,5,.28); color: var(--ink); }

.lba-periods { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; font-size: 12px; font-weight: 900; color: var(--muted); }
.lba-periods svg { font-size: 15px; color: var(--gold); }
.lba-per {
  font-family: inherit; font-size: 12px; font-weight: 900; cursor: pointer; padding: 7px 14px; border-radius: 11px;
  color: var(--muted); background: rgba(255,255,255,.04); border: 1px solid rgba(232,190,110,.16);
  transition: color .15s ease, background .15s ease, border-color .15s ease;
}
.lba-per:hover { color: var(--cream); }
.lba-per.on { color: var(--gold-lt); background: rgba(232,190,110,.14); border-color: rgba(232,190,110,.45); }

.lba-me {
  display: grid; grid-template-columns: 92px minmax(0,1fr) auto; align-items: center; gap: 14px;
  padding: 13px 16px; margin-bottom: 22px; border-radius: 18px;
  background: linear-gradient(100deg, rgba(232,190,110,.14), rgba(10,8,5,.7));
  border: 1px solid rgba(232,190,110,.26);
}
.lba-me.has { border-color: rgba(232,190,110,.5); box-shadow: 0 0 34px rgba(232,190,110,.12); }
.lba-me-pos { display: flex; flex-direction: column; align-items: center; gap: 1px; }
.lba-me-pos span { font-size: 10px; font-weight: 900; letter-spacing: .14em; color: var(--muted); }
.lba-me-pos b { font-size: 26px; font-weight: 900; font-style: italic; color: var(--gold-lt); font-variant-numeric: tabular-nums; }
.lba-me-name { display: flex; align-items: center; gap: 11px; min-width: 0; }
.lba-me-name > div { min-width: 0; display: flex; flex-direction: column; }
.lba-me-name b { font-size: 15px; font-weight: 900; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lba-me-name span { font-size: 12px; font-weight: 700; color: var(--muted); }
.lba-me-gap { font-size: 12px; font-weight: 800; color: var(--cream); text-align: left; white-space: nowrap; }
.lba-me-gap b { color: var(--gold-lt); font-variant-numeric: tabular-nums; }

.lba-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 16px; }
.lba-stat {
  padding: 14px 16px; border-radius: 16px; background: linear-gradient(160deg, rgba(232,190,110,.1), rgba(10,8,5,.6));
  border: 1px solid rgba(232,190,110,.18); display: flex; flex-direction: column; gap: 3px;
}
.lba-stat b { font-size: 24px; font-weight: 900; color: var(--gold-lt); font-variant-numeric: tabular-nums; }
.lba-stat span { font-size: 12px; font-weight: 700; color: var(--muted); }

.lba-podium { display: flex; align-items: flex-end; justify-content: center; gap: clamp(10px, 3vw, 26px); margin-bottom: 30px; }
.lba-pod {
  position: relative; flex: 1; max-width: 260px; display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 20px 14px 0; border-radius: 22px 22px 0 0;
  background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(10,8,5,.5)); border: 1px solid rgba(232,190,110,.16);
  animation: lbaRise .55s ease-out both;
}
@keyframes lbaRise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
.lba-pod.gold { border-color: rgba(232,190,110,.5); box-shadow: 0 0 60px rgba(232,190,110,.16); animation-delay: .06s; }
.lba-pod.silver { border-color: rgba(210,215,225,.28); }
.lba-pod.bronze { border-color: rgba(205,127,50,.32); }
.lba-pod-rank {
  position: absolute; top: 10px; right: 12px; width: 30px; height: 30px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 900;
  background: rgba(0,0,0,.45); border: 1px solid rgba(255,255,255,.14); color: var(--cream);
}
.lba-pod.gold .lba-pod-rank { background: linear-gradient(150deg, var(--gold-lt), var(--gold-dp)); color: var(--ink); border-color: rgba(255,255,255,.4); }
.lba-crown { position: absolute; top: -6px; left: 50%; transform: translateX(-50%); font-size: 34px; color: var(--gold); filter: drop-shadow(0 0 14px rgba(232,190,110,.6)); animation: lbaFloat 2.6s ease-in-out infinite; }
@keyframes lbaFloat { 0%,100% { transform: translate(-50%, 0); } 50% { transform: translate(-50%, -7px); } }
.lba-pod-avatar { position: relative; margin-bottom: 4px; }
.lba-halo { position: absolute; inset: -14px; border-radius: 50%; background: radial-gradient(circle, rgba(232,190,110,.35), transparent 68%); animation: lbaPulse 2.4s ease-in-out infinite; }
@keyframes lbaPulse { 0%,100% { opacity: .55; } 50% { opacity: 1; } }
.lba-pod-name { font-size: 17px; font-weight: 900; color: #fff; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lba-pod.gold .lba-pod-name { font-size: 21px; }
.lba-pod-score { font-size: 26px; font-weight: 900; color: var(--gold-lt); font-variant-numeric: tabular-nums; line-height: 1; }
.lba-pod.gold .lba-pod-score { font-size: 32px; }
.lba-pod-score em { font-size: 11px; font-weight: 800; font-style: normal; color: var(--muted); margin-right: 5px; }
.lba-pod-wins { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 800; color: var(--muted); }
.lba-pod-stand {
  width: 100%; margin-top: 12px; border-radius: 12px 12px 0 0; display: flex; align-items: flex-start; justify-content: center; padding-top: 10px;
  background: linear-gradient(180deg, rgba(232,190,110,.22), rgba(232,190,110,.04)); border: 1px solid rgba(232,190,110,.2); border-bottom: none;
}
.lba-pod.silver .lba-pod-stand { background: linear-gradient(180deg, rgba(210,215,225,.16), rgba(210,215,225,.03)); border-color: rgba(210,215,225,.18); }
.lba-pod.bronze .lba-pod-stand { background: linear-gradient(180deg, rgba(205,127,50,.18), rgba(205,127,50,.03)); border-color: rgba(205,127,50,.2); }
.lba-pod-stand span { font-size: 11px; font-weight: 900; letter-spacing: .1em; color: var(--gold); }

.lba-board { border-radius: 22px; overflow: hidden; background: linear-gradient(180deg, rgba(18,14,9,.86), rgba(10,8,5,.94)); border: 1px solid rgba(232,190,110,.18); box-shadow: 0 26px 60px rgba(0,0,0,.45); }
.lba-board-bar { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; padding: 16px 18px; border-bottom: 1px solid rgba(232,190,110,.14); }
.lba-board-title { display: flex; align-items: center; gap: 9px; font-size: 16px; font-weight: 900; color: var(--cream); }
.lba-board-title svg { color: var(--gold); font-size: 19px; }
.lba-count { font-size: 12px; font-weight: 900; color: var(--gold-lt); padding: 3px 10px; border-radius: 99px; background: rgba(232,190,110,.14); }
.lba-search { position: relative; display: flex; align-items: center; gap: 8px; margin-right: auto; padding: 0 12px; height: 40px; min-width: 240px; border-radius: 12px; background: rgba(0,0,0,.4); border: 1px solid rgba(232,190,110,.2); }
.lba-search svg { color: var(--muted); font-size: 16px; flex-shrink: 0; }
.lba-search input { flex: 1; height: 100%; background: none; border: none; outline: none; color: var(--cream); font-family: inherit; font-size: 14px; font-weight: 700; }
.lba-search input::placeholder { color: rgba(178,162,131,.6); font-weight: 600; }
.lba-clear { background: none; border: none; color: var(--muted); font-size: 20px; cursor: pointer; line-height: 1; padding: 0 2px; }
.lba-clear:hover { color: var(--cream); }

.lba-thead { display: grid; grid-template-columns: 64px minmax(0,1fr) 68px minmax(140px, 34%); gap: 12px; padding: 11px 18px; background: rgba(255,255,255,.03); border-bottom: 1px solid rgba(232,190,110,.12); }
.lba-thead span { font-size: 10px; font-weight: 900; letter-spacing: .14em; color: var(--muted); }
.lba-thead span:nth-child(3), .lba-thead span:nth-child(1) { text-align: center; }
.lba-board.per-game .lba-thead { grid-template-columns: 64px minmax(0,1fr) 62px 62px minmax(120px, 30%); }
.lba-board.per-game .lba-thead span:nth-child(4) { text-align: center; }

.lba-rows { max-height: 62vh; overflow-y: auto; }
.lba-row { display: grid; grid-template-columns: 64px minmax(0,1fr) 68px minmax(140px, 34%); gap: 12px; align-items: center; padding: 10px 18px; border-bottom: 1px solid rgba(255,255,255,.04); animation: lbaRise .4s ease-out both; transition: background .15s ease; }
.lba-row.five { grid-template-columns: 64px minmax(0,1fr) 62px 62px minmax(120px, 30%); }
.lba-row:hover { background: rgba(232,190,110,.06); }
.lba-row.me { background: linear-gradient(90deg, rgba(232,190,110,.14), transparent); border-right: 3px solid var(--gold); }
.lba-rank { text-align: center; font-size: 15px; font-weight: 900; color: var(--muted); font-variant-numeric: tabular-nums; }
.lba-player { display: flex; align-items: center; gap: 11px; min-width: 0; }
.lba-player b { font-size: 15px; font-weight: 900; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lba-tag { font-style: normal; font-size: 10px; font-weight: 900; color: var(--ink); background: var(--gold); padding: 2px 8px; border-radius: 99px; flex-shrink: 0; }
.lba-wins { text-align: center; font-size: 14px; font-weight: 900; color: var(--cream); font-variant-numeric: tabular-nums; }
.lba-pts { display: flex; align-items: center; gap: 10px; }
.lba-pts strong { font-size: 17px; font-weight: 900; color: var(--gold-lt); font-variant-numeric: tabular-nums; min-width: 54px; text-align: left; }
.lba-pts-bar { flex: 1; height: 7px; border-radius: 99px; background: rgba(255,255,255,.07); overflow: hidden; }
.lba-pts-bar i { display: block; height: 100%; border-radius: 99px; background: linear-gradient(90deg, var(--gold-dp), var(--gold-lt)); box-shadow: 0 0 12px rgba(232,190,110,.5); transition: width .5s ease; }
.lba-noresult { padding: 40px 18px; text-align: center; font-size: 15px; font-weight: 800; color: var(--muted); }
.lba-more { display: block; width: 100%; padding: 15px; background: rgba(232,190,110,.07); border: none; border-top: 1px solid rgba(232,190,110,.14); color: var(--gold-lt); font-family: inherit; font-size: 14px; font-weight: 900; cursor: pointer; transition: background .15s ease; }
.lba-more:hover { background: rgba(232,190,110,.16); }

.lba-empty { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 70px 20px; border-radius: 22px; background: rgba(10,8,5,.6); border: 1px dashed rgba(232,190,110,.28); }
.lba-empty svg { font-size: 54px; color: rgba(232,190,110,.4); }
.lba-empty b { font-size: 22px; font-weight: 900; font-style: italic; color: var(--cream); }
.lba-empty span { font-size: 14px; font-weight: 700; color: var(--muted); margin-bottom: 8px; }

.lba-skeleton { display: flex; flex-direction: column; gap: 10px; padding: 18px; border-radius: 22px; background: rgba(10,8,5,.6); border: 1px solid rgba(232,190,110,.14); }
.lba-sk-row { height: 56px; border-radius: 14px; background: linear-gradient(90deg, rgba(255,255,255,.04), rgba(232,190,110,.12), rgba(255,255,255,.04)); background-size: 220% 100%; animation: lbaShimmer 1.4s linear infinite; }
@keyframes lbaShimmer { from { background-position: 220% 0; } to { background-position: -20% 0; } }

@media (max-width: 720px) {
  .lba-thead, .lba-row { grid-template-columns: 46px minmax(0,1fr) 52px minmax(96px, 36%); gap: 8px; padding-left: 12px; padding-right: 12px; }
  .lba-board.per-game .lba-thead, .lba-row.five { grid-template-columns: 42px minmax(0,1fr) 44px 44px minmax(80px, 32%); }
  .lba-pod-name { font-size: 14px; }
  .lba-pod-score { font-size: 20px; }
  .lba-search { min-width: 100%; }
  .lba-me { grid-template-columns: 70px minmax(0,1fr); }
  .lba-me-gap { grid-column: 1 / -1; white-space: normal; text-align: right; }
}

/* ---- سمات الساحة (arena_status.global_mood) ---- */
.lba-root { position: relative; }
.lba-root > *:not(.lba-fx) { position: relative; z-index: 1; }
.lba-root::before {
  content: ''; position: fixed; inset: 0; z-index: 0; pointer-events: none;
  background: radial-gradient(120% 80% at 50% -10%, var(--wash, transparent), transparent 70%);
}
.lba-fx { position: fixed; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 2; opacity: .72; }

.lba-neon {
  --gold: #57d6ff; --gold-lt: #c8f4ff; --gold-dp: #14759c;
  --cream: #dff2ff; --muted: #7fa0b3; --ink: #031016; --ember: #2fb8ff;
  --wash: rgba(40,150,210,.22);
}
.lba-gold {
  --gold: #f6c453; --gold-lt: #ffeaa9; --gold-dp: #b9822a;
  --cream: #fff2d4; --muted: #c0a878; --ink: #140d02; --ember: #ffb347;
  --wash: rgba(210,150,40,.24);
}
.lba-stealth {
  --gold: #98a3ad; --gold-lt: #d9e0e6; --gold-dp: #4a525a;
  --cream: #ccd4db; --muted: #7a848d; --ink: #080b0e; --ember: #7fc9ff;
  --wash: rgba(120,140,160,.16);
}
.lba-stealth .lba-pod { border-color: rgba(190,205,220,.22); }
.lba-stealth .lba-pod.gold { box-shadow: 0 0 60px rgba(190,205,220,.14); }
.lba-stealth .lba-pod .lba-pod-stand {
  background: linear-gradient(180deg, rgba(190,205,220,.18), rgba(190,205,220,.03)); border-color: rgba(190,205,220,.2);
}
.lba-stealth .lba-halo { background: radial-gradient(circle, rgba(200,220,240,.26), transparent 68%); }
.lba-neon .lba-pod.gold { box-shadow: 0 0 60px rgba(87,214,255,.2); }
.lba-neon .lba-pod .lba-pod-stand {
  background: linear-gradient(180deg, rgba(87,214,255,.22), rgba(87,214,255,.04)); border-color: rgba(87,214,255,.24);
}

.lba-audio {
  position: fixed; left: 18px; bottom: 18px; z-index: 5; display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 16px; border-radius: 99px; cursor: pointer; font-family: inherit; font-size: 13px; font-weight: 900;
  color: var(--ink); background: linear-gradient(150deg, var(--gold-lt), var(--gold));
  border: 1px solid rgba(255,255,255,.3); box-shadow: 0 12px 30px rgba(0,0,0,.45);
}
.lba-audio svg { width: 1em; height: 1em; font-size: 15px; }

/* زر الرجوع العائم */
.lba-back {
  position: fixed; right: 16px; bottom: calc(16px + env(safe-area-inset-bottom)); z-index: 60;
  display: inline-flex; align-items: center; gap: 8px; min-height: 52px; padding: 0 22px; border-radius: 999px; cursor: pointer;
  font-family: inherit; font-size: 15px; font-weight: 900; color: var(--ink);
  background: linear-gradient(150deg, var(--gold-lt), var(--gold)); border: 1px solid rgba(255,255,255,.4);
  box-shadow: 0 14px 34px rgba(0,0,0,.5);
}
.lba-back svg { width: 20px; height: 20px; }
.lba-back:active { transform: scale(.96); }

@media (max-width: 640px) {
  .lba-root { padding: 18px 12px 96px; }
  .lba-head { gap: 12px; margin-bottom: 16px; }
  .lba-head-mark { width: 48px; height: 48px; border-radius: 16px; font-size: 24px; }
  .lba-head-text { min-width: 0; flex: 1 1 100%; order: 2; }
  .lba-title { font-size: 30px; }
  .lba-head-actions { order: 3; width: 100%; }
  .lba-head-actions .lba-btn { flex: 1; min-height: 48px; justify-content: center; font-size: 15px; }
  .lba-tabs { padding-bottom: 10px; }
  .lba-tab { padding: 11px 15px; }
  .lba-stats { grid-template-columns: 1fr 1fr; gap: 10px; }
  .lba-stat b { font-size: 20px; }
  .lba-podium { gap: 8px; }
  .lba-pod { padding: 14px 8px 0; }
  .lba-pod.gold .lba-pod-avatar > div { width: 88px !important; height: 88px !important; }
  .lba-pod.silver .lba-pod-avatar > div, .lba-pod.bronze .lba-pod-avatar > div { width: 68px !important; height: 68px !important; }
  .lba-pod-name { font-size: 13px; }
  .lba-pod.gold .lba-pod-name { font-size: 15px; }
  .lba-pod-score { font-size: 20px; }
  .lba-pod.gold .lba-pod-score { font-size: 24px; }
  .lba-pod-stand { margin-top: 10px; }
  .lba-board-bar { padding: 12px; }
  .lba-thead, .lba-row { grid-template-columns: 40px minmax(0,1fr) 44px minmax(72px,32%); gap: 8px; padding-left: 12px; padding-right: 12px; }
  .lba-board.per-game .lba-thead, .lba-row.five { grid-template-columns: 38px minmax(0,1fr) 40px 40px minmax(64px,30%); }
  .lba-pts strong { min-width: 42px; font-size: 15px; }
  .lba-player b { font-size: 13px; }
  .lba-me { grid-template-columns: 64px minmax(0,1fr); }
  .lba-back { right: 12px; left: 12px; justify-content: center; min-height: 56px; font-size: 16px; }
}
`;

export { LeaderboardArena };
export default LeaderboardArena;
