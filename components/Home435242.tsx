import React, { useEffect, useRef, useState, useMemo } from 'react';
import './Home435242.css';
import { BASE_ICONS, GAME_DETAILS } from './home435242Icons';
import { Search, X, Edit2, Save, LogOut, Loader2, Play, ShieldCheck } from 'lucide-react';
import { HelpOrb } from './tutorial/HelpOrb';

interface Home435242Props {
  games: any[];
  onSelectGame: (viewId: string) => void;
  onOpenTutorial?: (viewId: string) => void;
  onOpenLeaderboard: () => void;
  isAuthorized?: boolean;
  userRole?: 'admin' | 'user';
  isEditMode?: boolean;
  setIsEditMode?: (mode: boolean) => void;
  saveGamesOrder?: () => void;
  isSavingGames?: boolean;
  handleLogout?: () => void;
  onOpenAdmin?: () => void | Promise<void>;
}

// Exact games requested by user - any other games removed
const ALLOWED_HOT_IDS = ['MAHMAH_GAME', 'EMOJI_CODE'];

const ALLOWED_REGULAR_IDS = [
  'LETTER_GAME',       // حروف مع منصور
  'TIME_BOMB',         // قنبلة موقوتة
  'MAP_GUESSER',       // خمن الدولة
  'TYPING_RACE',       // سباق الكتابة
  'SAFE_CODE',         // فك الشفرة
  'TRUTH_OR_LIE',      // صادق أم كذاب
  'MUSICAL_CHAIRS',    // الكرسي الموسيقي
  'SPIN_WHEEL',        // الروليت
  'FLAG_QUIZ',         // الأعلام
  'HIGHER_LOWER',      // أعلى أم أقل
  'BLUR_GUESS',        // تخمين الصورة
  'CUP_SHUFFLE',       // تحدي الاكواب
  'DRAWING_CHALLENGE', // تحدي الرسم
  'GLASS_BRIDGE_V2',   // جسر الزجاج
];

const ALL_ALLOWED_IDS = [...ALLOWED_HOT_IDS, ...ALLOWED_REGULAR_IDS];

export const Home435242: React.FC<Home435242Props> = ({
  games,
  onSelectGame,
  onOpenTutorial,
  onOpenLeaderboard,
  isAuthorized,
  userRole,
  isEditMode,
  setIsEditMode,
  saveGamesOrder,
  isSavingGames,
  handleLogout,
  onOpenAdmin
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [search, setSearch] = useState('');
  const [isAdminChecking, setIsAdminChecking] = useState(false);

  // الزر لا يمنح صلاحية: السيرفر يقرر بالجلسة، وإلا تفتح صفحة كلمة السر
  const openAdmin = async () => {
    if (!onOpenAdmin || isAdminChecking) return;
    setIsAdminChecking(true);
    try { await onOpenAdmin(); } finally { setIsAdminChecking(false); }
  };

  // Floating Gold Particle Animation from 435242.html
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = cv.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let W = (cv.width = window.innerWidth);
    let H = (cv.height = window.innerHeight);

    const handleResize = () => {
      if (!cv) return;
      W = cv.width = window.innerWidth;
      H = cv.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const particles = Array.from({ length: 40 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.6 + 0.4,
      v: Math.random() * 0.45 + 0.15,
      a: Math.random() * 0.5 + 0.2
    }));

    const render = () => {
      ctx.clearRect(0, 0, W, H);
      for (const p of particles) {
        p.y -= p.v;
        p.x += Math.sin(p.y / 60) * 0.3;
        if (p.y < -5) {
          p.y = H + 5;
          p.x = Math.random() * W;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(240, 196, 110, ${p.a})`;
        ctx.fill();
      }
      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
    };
  }, []);

  // Pointer position tracking on card hover
  const handlePointerMove = (e: React.PointerEvent<HTMLAnchorElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - rect.top}px`);
  };

  const getGameInfo = (viewId: string, rowTitle?: string) => {
    const detail = GAME_DETAILS[viewId];
    // اسم القاعدة أول: تعديل المشرف للّقب من مركز التحكم ينعكس مباشرة
    const title = String(rowTitle || '').trim() || detail?.title || viewId;
    const desc = detail?.desc || 'تحدي تفاعلي حماسي لمجتمع القناة.';
    const iconKey = detail?.iconKey || 'wheel';
    const svgContent = BASE_ICONS[iconKey] || BASE_ICONS['wheel'];
    return { title, desc, svgContent };
  };

  // الكتالوج من جدول games: الاسم والترتيب والظهور والحالة كلها من قاعدة البيانات.
  // ALLOWED_* تبقى حاجزاً مقصوداً: أي لعبة خارجها لا تظهر في الصفحة ولو وُجدت في الجدول.
  const catalog = useMemo(() => {
    const byId: Record<string, any> = {};
    (games || []).forEach((g: any) => { if (g?.view_id) byId[String(g.view_id)] = g; });
    return ALL_ALLOWED_IDS
      .map((viewId) => {
        const row = byId[viewId];
        const info = getGameInfo(viewId, row?.title);
        return {
          id: row?.id || viewId.toLowerCase(),
          view_id: viewId,
          ...info,
          position: Number(row?.position ?? 999),
          isPrimary: row ? !!row.is_primary : ALLOWED_HOT_IDS.includes(viewId),
          hidden: row ? row.is_visible === false : false,
          stopped: row ? row.is_active === false : false,
        };
      })
      .filter(g => !g.hidden)
      .sort((a, b) => a.position - b.position);
  }, [games]);

  // البحث يشمل الاسم والوصف ومعرف اللعبة (نفس السلوك السابق)
  const filteredGames = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter((g) => g.title.toLowerCase().includes(q)
        || g.desc.toLowerCase().includes(q)
        || g.view_id.toLowerCase().includes(q));
  }, [catalog, search]);

  const { hotGames, regularGames } = useMemo(() => {
    if (search.trim()) return { hotGames: [], regularGames: filteredGames };
    return {
      hotGames: catalog.filter(g => g.isPrimary),
      regularGames: catalog.filter(g => !g.isPrimary),
    };
  }, [catalog, filteredGames, search]);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="icg1-page-435242">
      <canvas id="fx" ref={canvasRef} aria-hidden="true" />

      {/* TOP STICKY NAVIGATION */}
      <header className="top-nav">
        <a className="brand" href="#top" onClick={(e) => { e.preventDefault(); scrollToSection('top'); }}>
          <img src="/logo-435242.png" alt="iCG1" />
          iCG1
        </a>
        <nav className="center-nav">
          <a href="#new" onClick={(e) => { e.preventDefault(); scrollToSection('new'); }}>ألعاب جديدة</a>
          <a href="#games" onClick={(e) => { e.preventDefault(); scrollToSection('games'); }}>كل الألعاب</a>
          <button type="button" onClick={onOpenLeaderboard}>لوحة الصدارة</button>
          {onOpenAdmin && (
            <button type="button" onClick={openAdmin} className="admin-nav" disabled={isAdminChecking}
              title="مركز تحكم الإدارة">
              {isAdminChecking ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
              <span>{isAdminChecking ? 'جارٍ التحقق…' : 'الإدارة'}</span>
            </button>
          )}
          {isAuthorized && handleLogout && (
            <button type="button" onClick={handleLogout} className="logout-nav">
              <LogOut size={16} />
              <span>خروج</span>
            </button>
          )}
        </nav>
        <a className="live" href="https://kick.com/icg1" target="_blank" rel="noreferrer">
          <i />
          الساحة مفتوحة
        </a>
      </header>

      {/* MAIN CONTAINER */}
      <main id="top">
        {/* HERO SECTION */}
        <section className="hero">
          <div className="emblem">
            <span className="r1" />
            <span className="r2" />
            <span className="cn a" />
            <span className="cn b" />
            <span className="cn c" />
            <span className="cn d" />
            <img src="/logo-435242.png" alt="شعار iCG1" />
          </div>

          <span className="chip">ساحة الألعاب الرسمية</span>
          <div className="wm">
            <h1>iCG1</h1>
          </div>
          <div className="king">King of Acceptance</div>
          <p className="lead">ألعاب تفاعلية مع الشات والستريمر. اختر لعبتك وابدأ التحدي.</p>

          <div className="cta">
            <a
              className="btn gold"
              href="#new"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('new');
              }}
            >
              ابدأ اللعب
            </a>
            <a
              className="btn dark"
              href="#games"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('games');
              }}
            >
              كل الألعاب
            </a>
          </div>

          <div className="stats">
            <div>
              <b>{catalog.length}</b>
              <span>لعبة</span>
            </div>
            <div>
              <b>{hotGames.length}</b>
              <span>ألعاب جديدة</span>
            </div>
          </div>
        </section>

        {/* ADMIN EDIT CONTROLS IF PERMITTED */}
        {isAuthorized && userRole === 'admin' && (
          <div className="flex items-center justify-center gap-3 my-6 z-20 relative">
            {!isEditMode ? (
              <button
                onClick={() => setIsEditMode && setIsEditMode(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl border border-white/20 text-white font-bold text-sm transition-all shadow-lg"
              >
                <Edit2 size={16} className="text-yellow-400" />
                <span>تعديل الألعاب</span>
              </button>
            ) : (
              <>
                <button
                  onClick={saveGamesOrder}
                  disabled={isSavingGames}
                  className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 rounded-xl border border-green-400 text-white font-bold text-sm shadow-lg transition-all"
                >
                  {isSavingGames ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  <span>حفظ الترتيب</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-5 py-2.5 bg-red-600/30 hover:bg-red-600/50 rounded-xl border border-red-500/40 text-red-300 font-bold text-sm transition-all"
                >
                  <LogOut size={16} />
                  <span>خروج</span>
                </button>
              </>
            )}
          </div>
        )}

        {/* SECTION: NEW / HOT GAMES */}
        {hotGames.length > 0 && !search && (
          <section className="sec" id="new">
            <div className="sh">
              <h2>ألعاب جديدة</h2>
            </div>
            <div className="grid hg" id="hot">
              {hotGames.map((game) => {
                const { title, desc, svgContent } = game;
                return (
                  <a
                    key={game.id || game.view_id}
                    className={`card hot${game.stopped ? ' off' : ''}`}
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (!game.stopped) onSelectGame(game.view_id);
                    }}
                    onPointerMove={handlePointerMove}
                  >
                    <span className="new">{game.stopped ? 'متوقفة' : 'جديد'}</span>
                    <HelpOrb
                      viewId={game.view_id}
                      className="tut-orb-card"
                      label={title}
                      onOpen={(v) => onOpenTutorial?.(v)}
                    />
                    <div className="plate">
                      <svg viewBox="0 0 64 64" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svgContent }} />
                    </div>
                    <div className="tx2">
                      <h3>{title}</h3>
                      <p>{desc}</p>
                      <span className="play">العب الآن</span>
                    </div>
                  </a>
                );
              })}
            </div>
          </section>
        )}

        {/* SECTION: ALL GAMES */}
        <section className="sec" id="games">
          <div className="sh">
            <h2>كل الألعاب</h2>
            <small id="count">{search ? filteredGames.length : regularGames.length} لعبة</small>
          </div>

          {/* Search Box */}
          <div className="search-wrap">
            <Search size={18} className="text-yellow-400/80 shrink-0 ml-2" />
            <input
              type="text"
              placeholder="ابحث عن لعبة بالاسم أو الوصف..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-gray-400 hover:text-white mr-1"
                aria-label="مسح البحث"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Regular Games Grid */}
          <div className="grid" id="all">
            {regularGames.map((game) => {
              const { title, desc, svgContent } = game;
              return (
                <a
                  key={game.id || game.view_id}
                  className={`card${game.stopped ? ' off' : ''}`}
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (!game.stopped) onSelectGame(game.view_id);
                  }}
                  onPointerMove={handlePointerMove}
                >
                  <HelpOrb
                    viewId={game.view_id}
                    className="tut-orb-card"
                    label={title}
                    onOpen={(v) => onOpenTutorial?.(v)}
                  />
                  <div className="plate">
                    <svg viewBox="0 0 64 64" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svgContent }} />
                  </div>
                  <h3>{title}</h3>
                  <p>{desc}</p>
                  <span className="play">{game.stopped ? 'توقفت مؤقتاً' : 'العب الآن'}</span>
                </a>
              );
            })}
          </div>

          {filteredGames.length === 0 && (
            <div className="text-center py-12 text-yellow-200/60 font-bold text-lg">
              لا توجد ألعاب تطابق بحثك حالياً.
            </div>
          )}
        </section>
      </main>

      {/* FOOTER */}
      <footer>
        <img src="/logo-435242.png" alt="iCG1" />
        <div>iCG1 2026 — جميع الحقوق محفوظة</div>
      </footer>
    </div>
  );
};
