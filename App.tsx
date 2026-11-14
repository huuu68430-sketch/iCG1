import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { GameBackButton } from './components/GameBackButton';
import { CategorySelect } from './components/CategorySelect';
import { GlobalAnnouncement } from './components/GlobalAnnouncement';
import { ViewState } from './types';
import { GlobalPasswordPage } from './components/GlobalPasswordPage';
import { PersonalSitePage } from './components/PersonalSitePage';
import { adminApi } from './services/adminCenter';
import { memberApi } from './services/memberApi';

/* كل شاشة ثقيلة تُحمَّل عند الطلب — الواجهة الأولى (الموقع الشخصي) ما عاد فيها أن تُحلِّل
   ثلاثين لعبة دفعة واحدة. Fallback شفاف: لا لمحة ولا تغيير في التصميم. */
const FawazirGame = React.lazy(() => import('./components/FawazirGame').then(m => ({ default: m.FawazirGame })));
const MusicalChairsGame = React.lazy(() => import('./components/MusicalChairsGame').then(m => ({ default: m.MusicalChairsGame })));
const MasaqilWar = React.lazy(() => import('./components/MasaqilWar').then(m => ({ default: m.MasaqilWar })));
const BlurGuess = React.lazy(() => import('./components/BlurGuess').then(m => ({ default: m.BlurGuess })));
const Roulette = React.lazy(() => import('./components/Roulette').then(m => ({ default: m.Roulette })));
const Raffle = React.lazy(() => import('./components/Raffle').then(m => ({ default: m.Raffle })));
const FlagQuiz = React.lazy(() => import('./components/FlagQuiz').then(m => ({ default: m.FlagQuiz })));
const TeamBattle = React.lazy(() => import('./components/TeamBattle').then(m => ({ default: m.TeamBattle })));
const TypingRace = React.lazy(() => import('./components/TypingRace').then(m => ({ default: m.TypingRace })));
const GridHunt = React.lazy(() => import('./components/GridHunt').then(m => ({ default: m.GridHunt })));
const CupShuffle = React.lazy(() => import('./components/CupShuffle').then(m => ({ default: m.CupShuffle })));
const TerritoryWar = React.lazy(() => import('./components/TerritoryWar').then(m => ({ default: m.TerritoryWar })));
const TruthOrLie = React.lazy(() => import('./components/TruthOrLie').then(m => ({ default: m.TruthOrLie })));
const DrawingChallenge = React.lazy(() => import('./components/DrawingChallenge').then(m => ({ default: m.DrawingChallenge })));
const FruitWar = React.lazy(() => import('./components/FruitWar').then(m => ({ default: m.FruitWar })));
const LogoRound = React.lazy(() => import('./components/LogoRound').then(m => ({ default: m.LogoRound })));
const ForbiddenWords = React.lazy(() => import('./components/ForbiddenWords').then(m => ({ default: m.ForbiddenWords })));
const VotingGame = React.lazy(() => import('./components/VotingGame').then(m => ({ default: m.VotingGame })));
const TimeBomb = React.lazy(() => import('./components/TimeBomb').then(m => ({ default: m.TimeBomb })));
const WordBuilder = React.lazy(() => import('./components/WordBuilder').then(m => ({ default: m.WordBuilder })));
const GlassBridgeV2 = React.lazy(() => import('./components/GlassBridgeV2').then(m => ({ default: m.GlassBridgeV2 })));
const FloorIsLava = React.lazy(() => import('./components/FloorIsLava').then(m => ({ default: m.FloorIsLava })));
const EmojiCode = React.lazy(() => import('./components/EmojiCode').then(m => ({ default: m.EmojiCode })));
const HigherLowerGame = React.lazy(() => import('./components/HigherLowerGame').then(m => ({ default: m.HigherLowerGame })));
const MafiaGame = React.lazy(() => import('./components/Mafia/MafiaGame').then(m => ({ default: m.MafiaGame })));
const LetterHexagonGame = React.lazy(() => import('./components/LetterHexagonGame').then(m => ({ default: m.LetterHexagonGame })));
const BuzzerPad = React.lazy(() => import('./components/BuzzerPad').then(m => ({ default: m.BuzzerPad })));
const SafeCode = React.lazy(() => import('./components/SafeCode').then(m => ({ default: m.SafeCode })));
const MapGuesser = React.lazy(() => import('./components/MapGuesser').then(m => ({ default: m.MapGuesser })));
const AdminControlCenter = React.lazy(() => import('./components/AdminControlCenter'));
const AdminLogin = React.lazy(() => import('./components/AdminLogin'));
const UserDashboard = React.lazy(() => import('./components/UserDashboard').then(m => ({ default: m.UserDashboard })));
const HostLoginPage = React.lazy(() => import('./components/HostLoginPage').then(m => ({ default: m.HostLoginPage })));
const Home435242 = React.lazy(() => import('./components/Home435242').then(m => ({ default: m.Home435242 })));
const TutorialLayer = React.lazy(() => import('./components/tutorial/TutorialLayer').then(m => ({ default: m.TutorialLayer })));
const LeaderboardArena = React.lazy(() => import('./components/LeaderboardArena').then(m => ({ default: m.LeaderboardArena })));
import {
  Trophy, Play, Lock, User, Swords, Image as ImageIcon,
  RotateCw, Gift, Flag, Users2, Keyboard, Gem, Coffee,
  PaintBucket, Sparkles, ShieldCheck, Zap, Armchair,
  Maximize2, MonitorOff, CheckCircle2, AlertTriangle,
  Crown, Medal, Loader2, RefreshCw, ChevronRight, Video, Search,
  Sword, Globe, Brain, Vote, Bomb, Type, Footprints, Flame, Smile,
  ArrowUp, ArrowDown, Edit2, Save, Eye, EyeOff, Maximize, Minimize, Layout as LayoutIcon, X, LogIn, LogOut
} from 'lucide-react';
import { getAssetUrl } from './utils/assets';
import { isCnRoomRoute, isShortRoomRoute, readCnRoomCode, readShortRoomCode } from './utils/gameLink';
import { chatService } from './services/chatService';
import { supabase, leaderboardService, gamesService } from './services/supabase';
import { OBSLinksModal } from './components/OBSLinksModal';
import TecshIcon from './components/TecsIcon';

const ICON_MAP: Record<string, any> = {
  Sparkles, Armchair, TecshIcon, ImageIcon, Zap, Gift, Flag, Users2, Keyboard, Swords, Coffee, PaintBucket, AlertTriangle, Video, Sword, Globe, Brain, Vote, Bomb, Type, Footprints, Flame, Smile
};

// Games that should never show up in any list
const HIDDEN_GAME_VIEW_IDS: string[] = ['HARDEES_MEMORY'];

const HOST_ROUTE = '#/host';
const isHostRoute = () =>
  typeof window !== 'undefined' &&
  (window.location.hash.replace(/^#\/?/, '').toLowerCase() === 'host' ||
    new URLSearchParams(window.location.search).get('view') === 'host');

const readSession = (key: string): any | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.valid || !parsed?.token || !parsed?.pinHash || !parsed?.issuedAt) return null;
    if (Date.now() > (parsed.expiresAt || 0)) return null;
    return parsed;
  } catch (e) {
    return null;
  }
};


const App: React.FC = () => {
  // Initialize from URL params to prevent flicker
  const getInitialParams = () => {
    if (typeof window === 'undefined') return { obs: false, view: 'ABOUT' as ViewState, lb: '' };
    const params = new URLSearchParams(window.location.search);
    const studioToken = !!(process.env.OBS_STUDIO_TOKEN && params.get('t') === process.env.OBS_STUDIO_TOKEN);
    const room = params.get('r') || readShortRoomCode();
    const cnRoom = readCnRoomCode();
    const boardGame = (params.get('lb') || '').trim().toUpperCase();
    return {
      obs: params.get('obs') === 'true' || studioToken,
      room,
      cnRoom,
      lb: boardGame,
      view: studioToken
        ? 'DRAWING_CHALLENGE'
        : cnRoom
          ? ('EMOJI_CODE' as ViewState)
          : room
            ? ('MAHMAH_GAME' as ViewState)
            : (params.get('view') as ViewState) || 'ABOUT'
    };
  };

  const initialParams = getInitialParams();
  const [hostRoute, setHostRoute] = useState<boolean>(() => isHostRoute());
  const [hostUnlocked, setHostUnlocked] = useState<boolean>(() => !!readSession('host_access_granted'));
  const [currentView, setCurrentView] = useState<ViewState | 'ADMIN_LOGIN' | 'ADMIN_PANEL' | 'HOST_GATE'>(() => {
    if (isCnRoomRoute()) return 'EMOJI_CODE';
    if (isShortRoomRoute()) return 'MAHMAH_GAME';
    const pathView = window.location.pathname.replace(/^\//, '').replace(/-/g, '_').toUpperCase();
    if (pathView && pathView !== 'HOME' && pathView !== '') return pathView as any;
    if (isHostRoute()) return 'HOST_GATE';
    if (initialParams.view !== 'ABOUT' && initialParams.view !== 'HOME') return initialParams.view;
    // الصفحة الشخصية /about هي الرئيسية للجميع (مسجلًا وضيفًا) —
    // الجلسة (isAuthorized) تُستعاد منتهًا في useState أدناه، فلا حاجة لأي بوابة هنا.
    return initialParams.view;
  });
  const navigate = useNavigate();
  const pushedPath = useRef<string>('');
  useEffect(() => {
    // الروابط المختصرة (/m=CODE و /cn=CODE) تبقى كما هي حتى لا تنكسر عند التحديث
    if ((currentView === 'MAHMAH_GAME' && isShortRoomRoute()) || (currentView === 'EMOJI_CODE' && isCnRoomRoute())) return;
    const path = '/' + String(currentView).toLowerCase().replace(/_/g, '-');
    // نحافظ على باراميترات رابط اللعبة (?r=CODE&m=player) حتى لا تضيع عند التحديث
    const search = window.location.search || '';
    if (window.location.pathname !== path) {
      pushedPath.current = path;
      navigate(path + search, { replace: true });
    }
  }, [currentView, navigate]);

  // زر الرجوع في المتصفح: بدون هذه المزامنة يبقى الرأي القديم في الذاكرة ويُعيد
  // كتابة نفس الرابط، فيبدو أن الرجوع لا يعمل.
  useEffect(() => {
    const syncFromUrl = () => {
      if (isHostRoute() || isShortRoomRoute() || isCnRoomRoute()) return;
      const path = window.location.pathname;
      if (path === pushedPath.current) return;
      const mapped = path.replace(/^\//, '').replace(/-/g, '_').toUpperCase();
      if (!mapped || mapped === 'HOME') { setCurrentView('HOME'); return; }
      setCurrentView(prev => (prev === (mapped as any) ? prev : (mapped as any)));
    };
    window.addEventListener('popstate', syncFromUrl);
    return () => window.removeEventListener('popstate', syncFromUrl);
  }, []);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(!initialParams.obs);
  const [isOBSMode, setIsOBSMode] = useState(initialParams.obs);
  const [showOBSModal, setShowOBSModal] = useState(false);
  const [showObsPreview, setShowObsPreview] = useState(false);
  const [tutView, setTutView] = useState<string | null>(null);

  // Authorization State - bypass for OBS
  const [isAuthorized, setIsAuthorized] = useState<boolean>(() => {
    if (initialParams.obs) return true;
    return !!readSession('site_access_granted');
  });
  const [userRole, setUserRole] = useState<'admin' | 'user'>(() => {
    const adminSession = readSession('site_access_granted');
    if (adminSession?.role === 'admin') return 'admin';
    if (adminSession?.role === 'user') return 'user';
    return 'user'; // ⚠️ لا أحد أدمن افتراضياً — الدخولالأدمن بالكلمة السر فقط
  });

  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);
  const [adminStaff, setAdminStaff] = useState<{ staff_name: string; role: string } | null>(null);
  const [adminChecked, setAdminChecked] = useState(false);

  /* باب «الإدارة»: لا يظهر لأي عضو — فقط لمن كتب كلمة سر الإدارة فعلاً في هذا المتصفح:
     جلسة موقع بدور أدمن، أو جلسة مشرف تحقّق منها السيرفر (نتيجة واحدة لكل تبويب).
     التخزين المحلي لا يمنح صلاحية — اللوحة نفسها ما زالت تُفتح بالسيرفر وحده. */
  const [adminDoor, setAdminDoor] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    if (readSession('site_access_granted')?.role === 'admin') return true;
    return sessionStorage.getItem('icg1_admin_session') === '1';
  });


  const [activeAnnouncement, setActiveAnnouncement] = useState<string | null>(null);

  // Games Management State
  const [games, setGames] = useState<any[]>([]);
  const [gameSearch, setGameSearch] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSavingGames, setIsSavingGames] = useState(false);

  const loadGames = async () => {
    const { data } = await gamesService.getAllGames();
    if (data && data.length > 0) {
      setGames(data.filter((g: any) => !HIDDEN_GAME_VIEW_IDS.includes(g.view_id)));
    }
  };

  // الواجهة الأولى (الموقع الشخصي) ما لها حاجة بقناة الشات ولا بقائمة الألعاب:
  // التأجيل يمنع Parse/Render منافس لتحميل واجهة الضيف، ويبقى كل شيء كما هو بعد أول نقرة.
  const needsLiveBus = isOBSMode || hostRoute || currentView !== 'ABOUT';

  useEffect(() => {
    if (needsLiveBus) loadGames();
  }, [needsLiveBus]);

  // تعديل الألعاب في مركز التحكم (اسم/ترتيب/إخفاء/إيقاف) يظهر فوراً بدون إعادة تحميل
  useEffect(() => {
    if (!needsLiveBus) return;
    let retry: any;
    let isActive = true;

    const connectGames = () => {
      if (!isActive) return;
      const channel = supabase
        .channel('games_catalog')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, () => loadGames())
        .subscribe((status: string) => {
          if (status === 'CHANNEL_ERROR' && isActive) {
            retry = setTimeout(connectGames, 3000);
          }
        });
      return channel;
    };

    const channel = connectGames();

    return () => {
      isActive = false;
      clearTimeout(retry);
      if (channel) supabase.removeChannel(channel);
    };
  }, [needsLiveBus]);

  // ===== رابط صفحة الاستضافة المستقل: #/host =====
  useEffect(() => {
    const sync = () => {
      const active = isHostRoute();
      setHostRoute(active);
      if (active) {
        setHostUnlocked(!!readSession('host_access_granted'));
        setCurrentView('HOST_GATE');
      } else if (currentView === 'HOST_GATE' || currentView === 'HOST_LOGIN') {
        setCurrentView('HOME');
      }
    };
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, [currentView]);

  // لا يمكن الوصول لصفحة الاستضافة إلا عبر رابطها الخاص
  useEffect(() => {
    if ((currentView === 'HOST_LOGIN' || currentView === 'HOST_GATE') && !hostRoute) {
      setCurrentView('HOME');
    }
  }, [currentView, hostRoute]);

  const openHostPage = () => {
    window.location.hash = 'host';
    setHostRoute(true);
    setCurrentView('HOST_GATE');
  };

  const moveGame = (index: number, direction: 'up' | 'down') => {
    const newGames = [...games];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newGames.length) return;

    [newGames[index], newGames[targetIndex]] = [newGames[targetIndex], newGames[index]];

    // Update positions
    const updatedGames = newGames.map((g, i) => ({ ...g, position: i + 1 }));
    setGames(updatedGames);
  };

  const saveGamesOrder = async () => {
    setIsSavingGames(true);
    const gamesToSave = games.map(g => ({
      id: g.id,
      title: g.title,
      view_id: g.view_id,
      icon_name: g.icon_name,
      position: g.position,
      is_primary: !!g.is_primary,
      is_visible: g.is_visible !== false,
      has_obs: !!g.has_obs,
      is_coming_soon: !!g.is_coming_soon,
      coming_soon_text: g.coming_soon_text || 'قريباً'
    }));

    if (gamesToSave.some(g => !g.id)) {
      console.error("Missing ID in some games:", gamesToSave);
      alert("خطأ: بعض الألعاب تفتقد للمعرف (ID). يرجى تحديث الصفحة.");
      setIsSavingGames(false);
      return;
    }

    const { error } = await gamesService.updateAllPositions(gamesToSave);
    if (!error) {
      console.log("Save successful!");
      await loadGames();
      setIsEditMode(false);
    } else {
      console.error("Save error:", error);
      alert("حدث خطأ أثناء الحفظ: " + (error as any).message);
    }
    setIsSavingGames(false);
  };

  const toggleGameVisibility = (id: string) => {
    setGames(prev => prev.map(g =>
      g.id === id ? { ...g, is_visible: !g.is_visible } : g
    ));
  };

  const toggleGameSize = (id: string) => {
    setGames(prev => prev.map(g =>
      g.id === id ? { ...g, is_primary: !g.is_primary } : g
    ));
  };





  const playNotificationSound = () => {
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audio.volume = 0.6;
      audio.play().catch(e => console.warn("Sound play blocked:", e));
    } catch (e) {
      console.warn("Audio failed:", e);
    }
  };

  useEffect(() => {
    if (isOBSMode) {
      document.body.classList.add('obs-mode');
      document.documentElement.classList.add('obs-mode');
    } else {
      document.body.classList.remove('obs-mode');
      document.documentElement.classList.remove('obs-mode');
    }
  }, [isOBSMode]);

  // Restore server-side session (Kick OAuth) on mount
  // جلسة الأدمن المحلية لا تُستبدل بحساب عضو: بدون هذا الحارس يُعيد /api/me
  // تصنيف الأدمن كـ«مستخدم» بعد تسجيل الخروج أو بعد إعادة التحميل.
  useEffect(() => {
    if (readSession('site_access_granted')?.role === 'admin') return;
    let alive = true;
    fetch('/api/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!alive || !data?.user) return;
        if (readSession('site_access_granted')?.role === 'admin') return;
        const u = data.user;
        localStorage.setItem('iabs_user', JSON.stringify({
          id: u.id,
          display_name: u.display_name || u.kick_username,
          kick_username: u.kick_username,
          avatar: u.avatar || '',
          points: u.points || 0,
        }));
        setIsAuthorized(true);
        setUserRole(prev => (prev === 'admin' ? 'admin' : 'user'));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // Global Chat Connection
  useEffect(() => {
    if (!needsLiveBus) return;
    const channel = 'icg1';
    console.log(`[App] Initializing Chat Connection for: ${channel}`);

    chatService.connect(channel);

    // Cleanup is not strictly necessary here as we want it persistent, 
    // but good practice if App unmounts (rare)
    return () => {
      // We don't disconnect here to keep it alive for OBS/GAMES
      // unless we really want a clean exit.
    };
  }, [needsLiveBus]);

  useEffect(() => {
    let retryTimer: any;
    let isActive = true;

    const connectAnnouncements = () => {
      if (!isActive) return;
      const channel = supabase
        .channel('announcements_realtime')
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'announcements' },
          (payload) => {
            console.log('SURPRISE! New announcement:', payload.new.content);
            setActiveAnnouncement(payload.new.content);
            playNotificationSound();
          }
        )
        .subscribe((status) => {
          console.log('Announcement subscription status:', status);
          if (status === 'CHANNEL_ERROR' && isActive) {
            console.warn('[App] Announcements channel error, reconnecting in 3s...');
            retryTimer = setTimeout(connectAnnouncements, 3000);
          }
        });

      return channel;
    };

    const channel = connectAnnouncements();

    return () => {
      isActive = false;
      clearTimeout(retryTimer);
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const loadLeaderboard = (silent: boolean = false) => {
    if (!silent) setIsLoadingLeaderboard(true);
    leaderboardService.getAllRankedPlayers().then(data => {
      setLeaderboardData(data);
      if (!silent) setIsLoadingLeaderboard(false);
    }).catch(() => {
      if (!silent) setIsLoadingLeaderboard(false);
    });
  };

  useEffect(() => {
    if (currentView === 'LEADERBOARD') {
      loadLeaderboard();
    }
  }, [currentView]);

  useEffect(() => {
    if (currentView === 'LEADERBOARD') {
      let retryTimer: any;
      let isActive = true;

      const connectLeaderboard = () => {
        if (!isActive) return;
        const channel = supabase.channel('leaderboard_updates')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'leaderboard' }, () => loadLeaderboard(true))
          .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => loadLeaderboard(true))
          .subscribe((status) => {
            if (status === 'CHANNEL_ERROR' && isActive) {
              console.warn('[App] Leaderboard channel error, reconnecting in 3s...');
              retryTimer = setTimeout(connectLeaderboard, 3000);
            }
          });
        return channel;
      };

      const channel = connectLeaderboard();

      return () => {
        isActive = false;
        clearTimeout(retryTimer);
        if (channel) supabase.removeChannel(channel);
      };
    }
  }, [currentView]);

// بوابة الإدارة: الجلسة يُتحقق منها في السيرفر — التخزين المحلي لا يمنح صلاحيات
useEffect(() => {
    if (currentView !== 'ADMIN_PANEL' || adminChecked) return;
    let alive = true;
    adminApi.me().then(r => {
        if (!alive) return;
        setAdminChecked(true);
        if (r.ok && r.staff) {
          setAdminStaff(r.staff);
          sessionStorage.setItem('icg1_admin_session', '1');
          setAdminDoor(true);
        } else {
          sessionStorage.removeItem('icg1_admin_session');
          setCurrentView('ADMIN_LOGIN');
        }
    });
    return () => { alive = false; };
}, [currentView, adminChecked]);

  /* باب «الإدارة» في صفحة الألعاب: تحقق واحد لكل تبويب. بلا كوكي إدارية لا يُلمس
     قاعدة البيانات إطلاقاً (السيرفر يرفض قبل أي استعلام)، فلا كلفة على الزوّار.
     الطلب محفوظ في ref: إعادة تركيب StrictMode لا تُلغيه ولا تكرّره. */
  const adminProbe = useRef<Promise<boolean> | null>(null);
  useEffect(() => {
    if (adminDoor) return;
    if (!adminProbe.current) adminProbe.current = adminApi.me().then(r => !!r.ok).catch(() => false);
    let alive = true;
    adminProbe.current.then(ok => {
      if (!alive || !ok) return;
      sessionStorage.setItem('icg1_admin_session', '1');
      setAdminDoor(true);
    });
    return () => { alive = false; };
  }, [adminDoor]);

  // الصفحة الشخصية (/about) هي الرئيسية للموقع كاملًا للجميع:
  // «ادخل العب الآن» يدخل مباشرة إلى شبكة الألعاب (HOME) وحسابه معه.
  // لا توجيه تلقائي هنا.

  const handleCategorySelect = (id: string) => {
    setSelectedCategory(id);
    setCurrentView('FAWAZIR_GAME');
  };

  const handleAdminLogout = async () => {
    await adminApi.logout();
    setAdminStaff(null);
    setAdminChecked(false);
    sessionStorage.removeItem('icg1_admin_session');
    adminProbe.current = null;
    setAdminDoor(false);
    // الخروج يُرجِع لصفحة الألعاب مباشرة: لا سبب لإبقاء من غادر اللوحة أمام بوابة فارغة.
    setCurrentView('HOME');
  };

  // زر «الإدارة» في صفحة الألعاب: الجلسة الصالحة تُدخل اللوحة مباشرة، وغير ذلك صفحة الكلمة السر.
  // الصلاحية يقررها السيرفر بالكوكي HttpOnly — لا شيء في المتصفح يمنحها.
  const handleOpenAdmin = async () => {
    const r = await adminApi.me();
    if (r.ok && r.staff) {
      setAdminStaff({ staff_name: r.staff.staff_name, role: r.staff.role });
      setAdminChecked(true);
      sessionStorage.setItem('icg1_admin_session', '1');
      setAdminDoor(true);
      setCurrentView('ADMIN_PANEL');
    } else {
      setAdminStaff(null);
      setAdminChecked(false);
      setCurrentView('ADMIN_LOGIN');
    }
  };



  const handleGoHome = () => {
    if (userRole === 'user') {
      setCurrentView('USER_DASHBOARD');
    } else {
      setCurrentView('HOME');
    }
  };

  /* المتجر بقي داخل لوحة العضو (?tab=store) — لا زر له في شريط صفحة الألعاب */

  /* الخروج الحقيقي: كوكي الجلسة HttpOnly لا يُمسح بمسح التخزين المحلي — لو بقي
     فإن /api/me يُعيد تسجيله عضواً ويُلغي دخول الأدمن. لذا نُلغي الجلسة في
     السيرفر (كيك + جلسة المتجر) أولًا، ثم ننظّف الحالة المحلية ونُعيد التحميل. */
  const handleLogout = async () => {
    let csrf = '';
    try {
      const m = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
      if (m) csrf = decodeURIComponent(m[1]);
    } catch { /* لا كوكي — نكتفي بالمسح المحلي */ }

    const revoke = async () => {
      await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include',
        headers: csrf ? { 'x-csrf-token': csrf } : {},
      }).catch(() => { });
      await memberApi.end();
      // جلسة مركز التحكم تُلغاء هي الأخرى: خروج العضو لا يترك باب الإدارة مفتوحاً في المتصفح
      await adminApi.logout();
    };
    // زر الخروج لا ينتظر السيرفر إلى ما لا نهاية: 2.5 ثانية ثم نتابع
    await Promise.race([revoke(), new Promise(resolve => setTimeout(resolve, 2500))]);

    localStorage.removeItem('site_access_granted');
    localStorage.removeItem('iabs_user');
    sessionStorage.removeItem('icg1_admin_session');
    setIsAuthorized(false);
    setUserRole('user');
    setAdminDoor(false);
    setCurrentView('HOME');
    window.location.reload(); // Refresh to ensure clean state
  };

  const PremiumGameButton = ({
    title, icon: Icon, imageUrl, imageScale = "scale-[1.2]", imageContainerClass, onClick, isPrimary = false, isComingSoon = false,
    comingSoonText = "قريباً", hasOBS = false, index, total,
    onMoveUp, onMoveDown, isEditMode, isVisible = true, onToggleVisibility, onToggleSize
  }: any) => {
    const scale = isEditMode ? 1 : 1;
    
    // Force mahmah button to be larger and more beautiful
    const isMahmah = title === 'محمح';
    const forcePrimary = isMahmah || isPrimary;

    return (
      <div className={`relative group/btn-container transition-all duration-500 ${!isVisible && !isEditMode ? 'hidden' : ''}`} style={{ transform: `scale(${scale})` }}>
        <button
          onClick={isComingSoon ? undefined : onClick}
          disabled={isComingSoon || isEditMode}
          className={`icg-game-button group relative flex items-center justify-center gap-2 md:gap-3 overflow-hidden border transition-all duration-300 active:scale-95 text-white font-black italic
            ${isEditMode ? "border-white/40 ring-4 ring-white/10 scale-95 opacity-80" : "border-white/10"}
            ${!isVisible && isEditMode ? "opacity-40 grayscale" : ""}
            ${isComingSoon ? "bg-zinc-900 cursor-not-allowed grayscale pointer-events-none" : "bg-iabs-red shadow-[0_10px_30px_rgba(255,0,0,0.25)]"}
            ${isMahmah
              ? "px-12 py-6 text-xl md:text-2xl rounded-[2rem] hover:scale-105 w-full lg:max-w-2xl shadow-[0_15px_40px_rgba(255,0,0,0.4)] bg-iabs-red"
              : forcePrimary
              ? "px-6 py-4 text-base md:text-xl rounded-[1.5rem] hover:scale-105 w-full lg:max-w-md shadow-[0_15px_40px_rgba(255,0,0,0.4)] bg-iabs-red"
              : "px-3 py-2 text-xs md:text-sm rounded-[1rem] hover:scale-105 w-full bg-iabs-red"
            }`}
        >
          <div className="absolute inset-0 bg-white/30 translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-1000 skew-x-[-35deg] pointer-events-none z-20"></div>
          <div className="absolute top-0 left-0 w-full h-[45%] bg-gradient-to-b from-white/30 to-transparent pointer-events-none z-10"></div>

          {hasOBS && (
            <div className="absolute top-0 left-0 z-50 flex items-center gap-1 bg-black/60 backdrop-blur-md px-0.5 py-0 rounded-br-lg border-b border-r border-white/20 shadow-lg group-hover:bg-red-600/80 transition-colors">
              <Video size={6} className="text-white drop-shadow-sm" />
              <span className="text-[6px] font-black text-white uppercase tracking-tighter">OBS</span>
            </div>
          )}

          <div className="relative z-30 flex-shrink-0 transition-all duration-500 transform group-hover:scale-110 group-hover:rotate-6 flex items-center justify-center">
            <div className={`relative ${imageContainerClass ? imageContainerClass : (isPrimary ? 'w-7 h-7' : 'w-6 h-6')} flex items-center justify-center ${isComingSoon ? 'opacity-30' : ''}`}>
              {imageUrl ? (
                <div className="w-full h-full flex items-center justify-center">
                  <img src={imageUrl} alt={title} className={`w-full h-full object-contain drop-shadow-sm ${imageScale}`} />
                </div>
              ) : (
                <Icon size={isPrimary ? 26 : 16} color="#FFFFFF" strokeWidth={2.5} className="drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
              )}
            </div>
          </div>

          <span className={`relative z-30 whitespace-nowrap text-white font-black italic tracking-tighter uppercase leading-none bg-transparent ${isComingSoon ? 'opacity-30' : ''}`}>
            {title}
          </span>

          {isComingSoon && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-[2px]">
              <div className="bg-yellow-500 text-black px-4 py-1 rounded-full font-black text-xs md:text-sm -rotate-12 shadow-[0_0_15px_rgba(234,179,8,0.5)] animate-pulse">
                {comingSoonText}
              </div>
            </div>
          )}

          {!isVisible && isEditMode && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 border border-dashed border-white/20 rounded-inherit">
              <EyeOff size={18} className="text-white/50" />
            </div>
          )}
        </button>

        {isEditMode && (
          <>
            <div className="absolute -top-2 -right-2 flex flex-col gap-1 z-[60]">
              <button onClick={(e) => { e.stopPropagation(); onMoveUp(); }} className="bg-zinc-800 hover:bg-zinc-700 p-1 rounded-full border border-white/20 text-white shadow-lg"><ArrowUp size={12} /></button>
              <button onClick={(e) => { e.stopPropagation(); onMoveDown(); }} className="bg-zinc-800 hover:bg-zinc-700 p-1 rounded-full border border-white/20 text-white shadow-lg"><ArrowDown size={12} /></button>
            </div>
            <div className="absolute -top-2 -left-2 flex flex-col gap-1 z-[60]">
              <button onClick={(e) => { e.stopPropagation(); onToggleVisibility(); }} className={`${isVisible ? 'bg-blue-600 hover:bg-blue-500' : 'bg-zinc-600 hover:bg-zinc-500'} p-1 rounded-full border border-white/20 text-white shadow-lg transition-colors`}>{isVisible ? <Eye size={11} /> : <EyeOff size={11} />}</button>
              <button onClick={(e) => { e.stopPropagation(); onToggleSize(); }} className="bg-zinc-800 hover:bg-zinc-700 p-1 rounded-full border border-white/20 text-white shadow-lg">{isPrimary ? <Minimize size={11} /> : <Maximize size={11} />}</button>
            </div>
          </>
        )}
      </div>
    );
  };



  const renderView = (obsMode: boolean = false) => {
    switch (currentView) {
      case 'ADMIN_PANEL': {
        if (!adminChecked || !adminStaff) {
          return (
            <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: '#e9c27a', fontSize: 14 }}>
              جارٍ التحقق من صلاحية الدخول…
            </div>
          );
        }
        return <AdminControlCenter staffName={adminStaff.staff_name} onLogout={handleAdminLogout} />;
      }
      case 'ADMIN_LOGIN': return (
        <AdminLogin onBack={() => setCurrentView('HOME')} onSuccess={(staffName, role) => {
          setAdminStaff({ staff_name: staffName, role });
          setAdminChecked(true);
          sessionStorage.setItem('icg1_admin_session', '1');
          setAdminDoor(true);
          setCurrentView('ADMIN_PANEL');
        }} />
      );
      case 'FAWAZIR_SELECT': return <CategorySelect onSelect={handleCategorySelect} onBack={handleGoHome} />;
      case 'FAWAZIR_GAME': return <FawazirGame category={selectedCategory || 'ramadan'} onFinish={() => setCurrentView('LEADERBOARD')} onHome={handleGoHome} isOBS={obsMode} />;
      case 'MUSICAL_CHAIRS': return <MusicalChairsGame onHome={handleGoHome} isOBS={obsMode} />;
      case 'MASAQIL_WAR': return <MasaqilWar channelConnected={true} onHome={handleGoHome} isOBS={obsMode} />;
      case 'BLUR_GUESS': return <BlurGuess channelConnected={true} onHome={handleGoHome} isOBS={obsMode} />;
      case 'SPIN_WHEEL': return <Roulette channelConnected={true} onHome={handleGoHome} isOBS={obsMode} />;
      case 'RAFFLE': return <Raffle channelConnected={true} onHome={handleGoHome} isOBS={obsMode} />;
      case 'FLAG_QUIZ': return <FlagQuiz channelConnected={true} onHome={handleGoHome} isOBS={obsMode} />;
      case 'TEAM_BATTLE': return <TeamBattle channelConnected={true} onHome={handleGoHome} isOBS={obsMode} />;
      case 'TYPING_RACE': return <TypingRace channelConnected={true} onHome={handleGoHome} isOBS={obsMode} />;
      case 'GRID_HUNT': return <GridHunt channelConnected={true} onHome={handleGoHome} isOBS={obsMode} />;
      case 'CUP_SHUFFLE': return <CupShuffle channelConnected={true} onHome={handleGoHome} isOBS={obsMode} />;
      case 'TERRITORY_WAR': return <TerritoryWar channelConnected={true} onHome={handleGoHome} isOBS={obsMode} />;
      case 'TRUTH_OR_LIE': return <TruthOrLie channelConnected={true} onHome={handleGoHome} isOBS={obsMode} />;

      case 'DRAWING_CHALLENGE': return <DrawingChallenge onHome={handleGoHome} isOBS={obsMode} />;
      case 'FRUIT_WAR': return <FruitWar onHome={handleGoHome} isOBS={obsMode} />;
      case 'LOGO_ROUND': return <LogoRound onHome={handleGoHome} isOBS={obsMode} />;
      case 'FORBIDDEN_WORDS': return <ForbiddenWords onHome={handleGoHome} isOBS={obsMode} />;
      case 'VOTING_GAME': return <VotingGame onHome={handleGoHome} isOBS={obsMode} />;
      case 'TIME_BOMB': return <TimeBomb onHome={handleGoHome} isOBS={obsMode} />;
      case 'WORD_BUILDER': return <WordBuilder onHome={handleGoHome} isOBS={obsMode} />;
      case 'GLASS_BRIDGE_V2': return <GlassBridgeV2 onHome={handleGoHome} isOBS={obsMode} />;
      case 'FLOOR_IS_LAVA': return <FloorIsLava onHome={handleGoHome} isOBS={obsMode} />;
      case 'EMOJI_CODE': return <EmojiCode onHome={handleGoHome} isOBS={obsMode} />;
      case 'HIGHER_LOWER': return <HigherLowerGame onHome={handleGoHome} isOBS={obsMode} />;
      case 'MAHMAH_GAME': return <MafiaGame onHome={handleGoHome} />;
      case 'LETTER_GAME': return <LetterHexagonGame onHome={handleGoHome} isOBS={obsMode} onToggleOBSPreview={() => setShowObsPreview(!showObsPreview)} obsPreviewActive={showObsPreview} />;
      case 'BUZZER_PAD': return <BuzzerPad />;
      case 'SAFE_CODE': return <SafeCode onHome={() => setCurrentView('HOME')} isOBS={isOBSMode} />;
      case 'MAP_GUESSER': return <MapGuesser onHome={() => setCurrentView('HOME')} isOBS={isOBSMode} />;
      case 'HARDEES_MEMORY': return null;
      case 'ABOUT': return (
        <PersonalSitePage
          onPlayNow={() => setCurrentView('HOME')}
          onOpenLeaderboard={() => setCurrentView('LEADERBOARD')}
        />
      );

      case 'HOST_GATE': return (
        <GlobalPasswordPage
          onSuccess={() => {
            setHostUnlocked(true);
            setCurrentView('HOST_LOGIN');
          }}
          storageKey="host_access_granted"
          configKey="host_password"
          fallbackConfigKey="admin_password"
          adminOnly
          title="دخول المستضيف"
          subtitle="HOST ACCESS — RESTRICTED"
          newTitle="أدخل كلمة السر"
          returningTitle="دخول المستضيف"
        />
      );

      case 'HOST_LOGIN': return (
        <div className="flex-1 w-full flex items-center justify-center p-4 md:p-8">
          <HostLoginPage
            onSuccess={(hostData) => {
              localStorage.setItem('iabs_user', JSON.stringify({
                id: '',
                display_name: hostData.name,
                kick_username: hostData.kickUsername,
                avatar: hostData.avatar || ''
              }));
              localStorage.setItem('site_access_granted', JSON.stringify({ valid: true, role: 'user' }));
              setUserRole('user');
              setIsAuthorized(true);
              setCurrentView('HOME');
            }}
            onBack={() => {
              window.location.hash = '';
              setHostRoute(false);
              setCurrentView('ABOUT');
            }}
          />
        </div>
      );

      case 'USER_DASHBOARD': return (
        <div className="flex-1 w-full min-h-full flex flex-col animate-in slide-in-from-bottom-20 duration-1000">
          <UserDashboard
            onLogout={handleLogout}
            onHome={() => setCurrentView('HOME')}
            userData={(() => {
              const stored = localStorage.getItem('iabs_user');
              return stored ? JSON.parse(stored) : { id: '', display_name: 'Guest', kick_username: 'guest' };
            })()}
          />
        </div>
      );

      case 'LEADERBOARD': return (
        <LeaderboardArena
          data={leaderboardData}
          loading={isLoadingLeaderboard}
          onRefresh={() => loadLeaderboard()}
          onHome={() => setCurrentView('ABOUT' as any)}
          games={games}
          initialGame={initialParams.lb || undefined}
          me={(() => {
            try {
              const stored = localStorage.getItem('iabs_user');
              return stored ? (JSON.parse(stored).kick_username || '') : '';
            } catch { return ''; }
          })()}
        />
      );

      case 'HOME':
      default: {
        return (
          <Home435242
            games={games}
            onSelectGame={(viewId) => setCurrentView(viewId as any)}
            onOpenTutorial={setTutView}
            onOpenLeaderboard={() => setCurrentView('LEADERBOARD')}
            isAuthorized={isAuthorized}
            userRole={userRole}
            isEditMode={isEditMode}
            setIsEditMode={setIsEditMode}
            saveGamesOrder={saveGamesOrder}
            isSavingGames={isSavingGames}
            handleLogout={handleLogout}
            onOpenAdmin={adminDoor || userRole === 'admin' ? handleOpenAdmin : undefined}
          />
        );
      }
    }
  };

  /* حدود Suspense الشفافة: الشاشة التالية تُحلَّل فقط عند فتحها */
  const renderContent = (obsMode: boolean = false) => (
    <React.Suspense fallback={null}>{renderView(obsMode)}</React.Suspense>
  );

  /* شرح الألعاب: زر «!» العائم + الفيديو — لا يظهر أبداً في بث OBS */
  const tutorialLayer = (
    <React.Suspense fallback={null}>
      <TutorialLayer
        viewId={currentView}
        openId={tutView}
        onOpen={setTutView}
        onClose={() => setTutView(null)}
        onPlay={(v) => setCurrentView(v as ViewState)}
      />
    </React.Suspense>
  );


  if (isOBSMode) {
    return (
      <div className="fixed inset-0 bg-transparent overflow-hidden flex items-center justify-center z-[99999]">
        {renderContent(true)}
      </div>
    );
  }

  // لعبة المافيا تُعرض بملء الشاشة (تصميم المسرح) بدون واجهة الموقع الجانبية
  if (isAuthorized && currentView === 'MAHMAH_GAME') {
    /* جوال اللاعب فيه زر «خروج» خاص به داخل الشاشة — الزر العام كان يطغى على شريط القرار السفلي */
    const mafiaPhone = isShortRoomRoute() || ['p', 'player'].includes((new URLSearchParams(window.location.search).get('m') || '').toLowerCase());
    return (
      <div className="fixed inset-0 overflow-auto bg-black">
        {renderContent(false)}
        {/* شريط أدوات المسرح يختفي بعد لحظات — فلا يبقى المشاهد بلا طريق للعودة */}
        {!mafiaPhone && <GameBackButton fixed onHome={handleGoHome} />}
        {tutorialLayer}
      </div>
    );
  }

  // هاتف لاعب/ليدر كود نيمز: صفحة كاملة بدون واجهة الموقع (زر «خروج» داخل الشاشة نفسها)
  if (isAuthorized && currentView === 'EMOJI_CODE' && isCnRoomRoute()) {
    return (
      <div className="fixed inset-0 overflow-auto bg-[#03081a]">
        {renderContent(false)}
      </div>
    );
  }

  // بوابة الإدارة: مسارَان خارج واجهة الموقع وخارج بوابة الموقع. كلمة سر الإدارة وحدها
  // تفتح اللوحة، وكل صلاحية في السيرفر (كوكي HttpOnly + جلسة تُلغى) — فلا خطر من ظهور الصفحة.
  const adminRoute = currentView === 'ADMIN_LOGIN' || currentView === 'ADMIN_PANEL';
  if (adminRoute) {
    return (
      <div className="fixed inset-0 overflow-auto bg-[#070504]">
        {renderContent(false)}
      </div>
    );
  }

  if (!isAuthorized && currentView !== 'ABOUT' && !hostRoute) {
    return (
      <GlobalPasswordPage
        onSuccess={(role) => {
          setUserRole(role);
          setIsAuthorized(true);
          const roomLink = new URLSearchParams(window.location.search).get('r') || readShortRoomCode();
          /* رابط غرفة أو لعبة معيّنة يسبق كل شيء: العضو يدخل جولته مباشرة */
          if (readCnRoomCode()) { setCurrentView('EMOJI_CODE'); return; }
          if (roomLink) { setCurrentView('MAHMAH_GAME'); return; }
          /* صاحب الإدارة ⇒ لوحة التحكم (والتحقّق في السيرفر — لا في التخزين المحلي) */
          if (role === 'admin') { setCurrentView('ADMIN_PANEL'); return; }
          /* العضو ⇒ صفحته الخاصة (لوحة العضو)، لا ساحة الألعاب.
             (?view=لعبة محددة يبقى — رابط مباشر إلى لعبة) */
          const explicit = (initialParams.view !== 'ABOUT' && initialParams.view !== 'HOME')
            ? initialParams.view
            : null;
          setCurrentView(explicit || 'USER_DASHBOARD');
        }}
      />
    );
  }

  return (
    <Layout
      currentView={currentView as ViewState}
      onChangeView={(v) => setCurrentView(v)}
      onOBSLinks={() => setShowOBSModal(true)}
      onToggleOBSPreview={() => setShowObsPreview(!showObsPreview)}
      obsPreviewActive={showObsPreview}
      obsPreviewSlot={renderContent(true)}
      isAuthorized={isAuthorized}
      userRole={userRole}
      tutorialOpen={!!tutView}
    >
      <OBSLinksModal isOpen={showOBSModal} onClose={() => setShowOBSModal(false)} />

      {(isAuthorized || currentView === 'ABOUT' || hostRoute) && (
        <div className="relative w-full h-full flex flex-col items-center">
          {renderContent(false)}
        </div>
      )}

      {activeAnnouncement && (
        <GlobalAnnouncement
          message={activeAnnouncement}
          onClose={() => setActiveAnnouncement(null)}
        />
      )}

      {tutorialLayer}

      </Layout>
  );
};

export default App;

