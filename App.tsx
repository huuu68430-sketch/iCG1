import React, { useState, useEffect, useRef } from 'react';
import { Layout } from './components/Layout';
import { CategorySelect } from './components/CategorySelect';
import { FawazirGame } from './components/FawazirGame';
import { MusicalChairsGame } from './components/MusicalChairsGame';
import { MasaqilWar } from './components/MasaqilWar';
import { BlurGuess } from './components/BlurGuess';
import { SpinWheel } from './components/SpinWheel';
import { Raffle } from './components/Raffle';
import { FlagQuiz } from './components/FlagQuiz';
import { TeamBattle } from './components/TeamBattle';
import { TypingRace } from './components/TypingRace';
import { GridHunt } from './components/GridHunt';
import { CupShuffle } from './components/CupShuffle';
import { TerritoryWar } from './components/TerritoryWar';
import { TruthOrLie } from './components/TruthOrLie';

import { DrawingChallenge } from './components/DrawingChallenge';
import { FruitWar } from './components/FruitWar';
import { LogoRound } from './components/LogoRound';
import { ForbiddenWords } from './components/ForbiddenWords';
import { VotingGame } from './components/VotingGame';
import { TimeBomb } from './components/TimeBomb';
import { WordBuilder } from './components/WordBuilder';
import { GlassBridgeV2 } from './components/GlassBridgeV2';
import { FloorIsLava } from './components/FloorIsLava';
import { EmojiCode } from './components/EmojiCode';
import { HigherLowerGame } from './components/HigherLowerGame';
import { MahmahGame } from './components/MahmahGame/MahmahGame';
import { LetterHexagonGame } from './components/LetterHexagonGame';
import { BuzzerPad } from './components/BuzzerPad';
import { SafeCode } from './components/SafeCode';
import { MapGuesser } from './components/MapGuesser';
import { AboutPage } from './components/AboutPage';
import { AdminDashboard } from './components/AdminDashboard';
import { GlobalAnnouncement } from './components/GlobalAnnouncement';
import { ViewState } from './types';
import { GlobalPasswordPage } from './components/GlobalPasswordPage';
import { UserDashboard } from './components/UserDashboard';
import { HostLoginPage } from './components/HostLoginPage';
import {
  Trophy, Play, Lock, User, Swords, Image as ImageIcon,
  RotateCw, Gift, Flag, Users2, Keyboard, Gem, Coffee,
  PaintBucket, Sparkles, ShieldCheck, Zap, Armchair,
  Maximize2, MonitorOff, CheckCircle2, AlertTriangle,
  Crown, Medal, Loader2, RefreshCw, ChevronRight, Video,
  Sword, Globe, Brain, Vote, Bomb, Type, Footprints, Flame, Smile,
  ArrowUp, ArrowDown, Edit2, Save, Eye, EyeOff, Maximize, Minimize, Layout as LayoutIcon, X, LogIn, LogOut
} from 'lucide-react';
import { getAssetUrl } from './utils/assets';
import { chatService } from './services/chatService';
import { supabase, leaderboardService, gamesService } from './services/supabase';
import { OBSLinksModal } from './components/OBSLinksModal';
import { ProAvatar } from './components/ProAvatar';
import TecshIcon from './components/TecsIcon';
import { IabsLogo } from './components/IabsLogo';

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
    if (typeof window === 'undefined') return { obs: false, view: 'ABOUT' as ViewState };
    const params = new URLSearchParams(window.location.search);
    const studioToken = !!(process.env.OBS_STUDIO_TOKEN && params.get('t') === process.env.OBS_STUDIO_TOKEN);
    return {
      obs: params.get('obs') === 'true' || studioToken,
      view: studioToken ? 'DRAWING_CHALLENGE' : (params.get('view') as ViewState) || 'ABOUT'
    };
  };

  const initialParams = getInitialParams();
  const [hostRoute, setHostRoute] = useState<boolean>(() => isHostRoute());
  const [hostUnlocked, setHostUnlocked] = useState<boolean>(() => !!readSession('host_access_granted'));
  const [currentView, setCurrentView] = useState<ViewState | 'ADMIN_LOGIN' | 'ADMIN_PANEL' | 'HOST_GATE'>(() => {
    if (isHostRoute()) return 'HOST_GATE';
    if (initialParams.view !== 'ABOUT' && initialParams.view !== 'HOME') return initialParams.view;
    try {
      const stored = localStorage.getItem('site_access_granted');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.valid && parsed.role === 'user') return 'USER_DASHBOARD';
      }
    } catch (e) { }
    return initialParams.view;
  });
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(!initialParams.obs);
  const [isOBSMode, setIsOBSMode] = useState(initialParams.obs);
  const [showOBSModal, setShowOBSModal] = useState(false);
  const [showObsPreview, setShowObsPreview] = useState(false);

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
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');


  const [activeAnnouncement, setActiveAnnouncement] = useState<string | null>(null);

  // Games Management State
  const [games, setGames] = useState<any[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSavingGames, setIsSavingGames] = useState(false);

  const loadGames = async () => {
    const { data } = await gamesService.getAllGames();
    if (data && data.length > 0) {
      setGames(data.filter((g: any) => !HIDDEN_GAME_VIEW_IDS.includes(g.view_id)));
    }
  };

  useEffect(() => {
    loadGames();
  }, []);

  // ===== رابط صفحة الاستضافة المستقل: #/host =====
  useEffect(() => {
    const sync = () => {
      const active = isHostRoute();
      setHostRoute(active);
      if (active) {
        setHostUnlocked(!!readSession('host_access_granted'));
        setCurrentView('HOST_GATE');
      } else if (currentView === 'HOST_GATE' || currentView === 'HOST_LOGIN') {
        setCurrentView('ABOUT');
      }
    };
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, [currentView]);

  // لا يمكن الوصول لصفحة الاستضافة إلا عبر رابطها الخاص
  useEffect(() => {
    if ((currentView === 'HOST_LOGIN' || currentView === 'HOST_GATE') && !hostRoute) {
      setCurrentView('ABOUT');
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
    } else {
      document.body.classList.remove('obs-mode');
    }
  }, [isOBSMode]);

  // Global Chat Connection
  useEffect(() => {
    const channel = 'iabs'; // Forced to iabs
    console.log(`[App] Initializing Chat Connection for: ${channel}`);

    chatService.connect(channel);

    // Cleanup is not strictly necessary here as we want it persistent, 
    // but good practice if App unmounts (rare)
    return () => {
      // We don't disconnect here to keep it alive for OBS/GAMES
      // unless we really want a clean exit.
    };
  }, []);

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

// Security Check for Admin Panel
useEffect(() => {
    if (currentView === 'ADMIN_PANEL') {
      const adminAuth = readSession('site_access_granted');
      if (!adminAuth || adminAuth.role !== 'admin') {
        setUserRole('user');
        setCurrentView('ADMIN_LOGIN');
      }
    }
  }, [currentView]);

  // PROTECTION: Prevent regular users from accessing the HOME page
  useEffect(() => {
    if (isAuthorized && userRole === 'user' && currentView === 'HOME') {
      console.log("[Security] Redirecting user from HOME to DASHBOARD");
      setCurrentView('USER_DASHBOARD');
    }
  }, [isAuthorized, userRole, currentView]);

  const handleCategorySelect = (id: string) => {
    setSelectedCategory(id);
    setCurrentView('FAWAZIR_GAME');
  };

  const handleAdminLogin = async () => {
    const isValid = await leaderboardService.verifyAdminPassword(adminPasswordInput);
    if (isValid) {
      setCurrentView('ADMIN_PANEL');
      setAdminPasswordInput('');
      setLoginError('');
    } else {
      setLoginError('كلمة المرور غير صحيحة');
    }
  };



  const handleGoHome = () => {
    if (userRole === 'user') {
      setCurrentView('USER_DASHBOARD');
    } else {
      setCurrentView('HOME');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('site_access_granted');
    localStorage.removeItem('admin_access_granted');
    localStorage.removeItem('iabs_user');
    setIsAuthorized(false);
    setUserRole('admin');
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
          className={`group relative flex items-center justify-center gap-2 md:gap-3 overflow-hidden border transition-all duration-300 active:scale-95 text-white font-black italic
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



  const renderContent = (obsMode: boolean = false) => {
    switch (currentView) {
      case 'ADMIN_PANEL': {
        const adminOk = userRole === 'admin' && !!readSession('site_access_granted');
        if (!adminOk) {
          window.location.hash = '';
          setCurrentView('ABOUT');
          return null;
        }
        return <AdminDashboard onLogout={handleGoHome} />;
      }
      case 'ADMIN_LOGIN': return (
        <GlobalPasswordPage
          onSuccess={() => setCurrentView('ADMIN_PANEL')}
          storageKey="admin_access_granted"
          title="بوابة الإدارة"
          subtitle="SYSTEM ADMINISTRATION"
          newTitle="التحقق الإداري"
          returningTitle="دخول المشرف"
        />
      );
      case 'FAWAZIR_SELECT': return <CategorySelect onSelect={handleCategorySelect} onBack={handleGoHome} />;
      case 'FAWAZIR_GAME': return <FawazirGame category={selectedCategory || 'ramadan'} onFinish={() => setCurrentView('LEADERBOARD')} onHome={handleGoHome} isOBS={obsMode} />;
      case 'MUSICAL_CHAIRS': return <MusicalChairsGame onHome={handleGoHome} isOBS={obsMode} />;
      case 'MASAQIL_WAR': return <MasaqilWar channelConnected={true} onHome={handleGoHome} isOBS={obsMode} />;
      case 'BLUR_GUESS': return <BlurGuess channelConnected={true} onHome={handleGoHome} isOBS={obsMode} />;
      case 'SPIN_WHEEL': return <SpinWheel channelConnected={true} onHome={handleGoHome} isOBS={obsMode} />;
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
      case 'MAHMAH_GAME': return <MahmahGame onBack={handleGoHome} />;
      case 'LETTER_GAME': return <LetterHexagonGame onHome={handleGoHome} isOBS={obsMode} onToggleOBSPreview={() => setShowObsPreview(!showObsPreview)} obsPreviewActive={showObsPreview} />;
      case 'BUZZER_PAD': return <BuzzerPad />;
      case 'SAFE_CODE': return <SafeCode onHome={() => setCurrentView('HOME')} isOBS={isOBSMode} />;
      case 'MAP_GUESSER': return <MapGuesser onHome={() => setCurrentView('HOME')} isOBS={isOBSMode} />;
      case 'HARDEES_MEMORY': return null;
      case 'ABOUT': return <AboutPage onBack={handleGoHome} />;

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
              setCurrentView('USER_DASHBOARD');
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
        <div className="flex-1 w-full max-w-7xl mx-auto flex flex-col p-2 md:p-6 animate-in slide-in-from-bottom-20 duration-1000">
          <UserDashboard
            onLogout={handleLogout}
            userData={(() => {
              const stored = localStorage.getItem('iabs_user');
              return stored ? JSON.parse(stored) : { id: '', display_name: 'Guest', kick_username: 'guest' };
            })()}
          />
        </div>
      );

      case 'LEADERBOARD': return (
        <div className="animate-in fade-in zoom-in duration-500 max-w-5xl mx-auto w-full pt-6 px-4 h-full flex flex-col items-center">
          <div className="text-center mb-6">
            <h2 className="text-4xl md:text-5xl font-black italic red-neon-text tracking-tighter mb-2">أساطير الساحة</h2>
            <div className="flex items-center justify-center gap-3 text-white/40 uppercase tracking-[0.3em] text-[10px] font-bold">
              <div className="h-px w-8 bg-white/20" />
              TOP SURVIVORS
              <div className="h-px w-8 bg-white/20" />
            </div>
          </div>

          <div className="w-full space-y-6">
            {!isLoadingLeaderboard && leaderboardData.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end mb-8">
                {leaderboardData[1] && (
                  <div className="order-2 md:order-1 h-[200px] glass-card rounded-[2rem] p-6 border border-slate-400/30 flex flex-col items-center justify-center relative hover:scale-105 transition-all group overflow-hidden bg-gradient-to-t from-slate-900/80 to-transparent">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Medal size={50} className="text-slate-400" /></div>
                    <div className="mb-3 relative">
                      <ProAvatar url={leaderboardData[1].avatar_url} username={leaderboardData[1].username} frameUrl={leaderboardData[1].active_frame_url} size="w-16 h-16" className="shadow-xl" />
                      <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-slate-400 text-black flex items-center justify-center font-black text-sm border-2 border-black z-[110] shadow">2</div>
                    </div>
                    <div className="text-lg font-black text-white mb-1">{leaderboardData[1].username}</div>
                    <div className="flex gap-3 text-xs"><span className="text-slate-400 font-bold">{leaderboardData[1].score || 0} نقطة</span><span className="text-white/20">|</span><span className="text-slate-400 font-bold">{leaderboardData[1].wins || 0} فوز</span></div>
                  </div>
                )}

                {leaderboardData[0] && (
                  <div className="order-1 md:order-2 h-[240px] glass-card rounded-[2.5rem] p-6 border-2 border-yellow-500/50 flex flex-col items-center justify-center relative hover:scale-110 transition-all group overflow-hidden bg-gradient-to-t from-yellow-900/40 via-yellow-950/20 to-transparent shadow-[0_0_50px_rgba(234,179,8,0.15)]">
                    <div className="absolute -top-8 animate-float opacity-30"><Crown size={80} className="text-yellow-500 blur-sm" /></div>
                    <div className="mb-4 relative z-10">
                      <div className="absolute -inset-3 bg-yellow-500/20 blur-xl rounded-full animate-pulse" />
                      <ProAvatar url={leaderboardData[0].avatar_url} username={leaderboardData[0].username} frameUrl={leaderboardData[0].active_frame_url} size="w-20 h-20" className="shadow-[0_0_20px_rgba(234,179,8,0.3)]" />
                      <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-yellow-500 text-black flex items-center justify-center font-black text-lg border-2 border-black animate-bounce z-[110] shadow">1</div>
                    </div>
                    <div className="text-2xl font-black text-white italic mb-2 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">{leaderboardData[0].username}</div>
                    <div className="flex gap-4 relative z-10 bg-black/40 px-4 py-1.5 rounded-full border border-yellow-500/20">
                      <span className="text-yellow-500 font-black text-sm">{leaderboardData[0].score || 0} نقطة</span>
                      <span className="text-white/20">|</span>
                      <span className="text-yellow-500 font-black text-sm">{leaderboardData[0].wins || 0} فوز</span>
                    </div>
                  </div>
                )}

                {leaderboardData[2] && (
                  <div className="order-3 h-[170px] glass-card rounded-[2rem] p-6 border border-orange-700/30 flex flex-col items-center justify-center relative hover:scale-105 transition-all group overflow-hidden bg-gradient-to-t from-orange-950/40 to-transparent">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Medal size={40} className="text-orange-700" /></div>
                    <div className="mb-3 relative">
                      <ProAvatar url={leaderboardData[2].avatar_url} username={leaderboardData[2].username} frameUrl={leaderboardData[2].active_frame_url} size="w-14 h-14" className="shadow" />
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-orange-700 text-white flex items-center justify-center font-black text-xs border-2 border-black z-[110] shadow">3</div>
                    </div>
                    <div className="text-base font-black text-white mb-1">{leaderboardData[2].username}</div>
                    <div className="flex gap-3 text-xs"><span className="text-orange-700 font-bold">{leaderboardData[2].score || 0} نقطة</span><span className="text-white/20">|</span><span className="text-orange-700 font-bold">{leaderboardData[2].wins || 0} فوز</span></div>
                  </div>
                )}
              </div>
            )}

            <div className="glass-card rounded-[2rem] border border-white/5 overflow-hidden shadow-xl bg-black/40 backdrop-blur-xl flex-1 mb-6">
              {isLoadingLeaderboard ? (
                <div className="flex flex-col items-center justify-center h-[200px] gap-4">
                  <Loader2 className="animate-spin text-iabs-red" size={40} />
                  <div className="text-sm text-gray-400 font-bold animate-pulse italic tracking-widest">GATHERING LEGENDS...</div>
                </div>
              ) : (
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-right">
                    <thead className="bg-white/5 border-b border-white/5">
                      <tr className="text-gray-400 font-black uppercase text-[9px] tracking-[0.2em]">
                        <th className="p-4 text-center w-16">الرتبة</th>
                        <th className="p-4 text-right">المتسابق</th>
                        <th className="p-4 text-center">مرات الفوز</th>
                        <th className="p-4 text-left">مجموع النقاط</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {leaderboardData.slice(3).map((user, index) => (
                        <tr key={user.id} className="hover:bg-white/10 transition-all group animate-in slide-in-from-right duration-500" style={{ animationDelay: `${index * 50} ms` }}>
                          <td className="p-3 text-center"><div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center font-black text-xs text-gray-500 group-hover:text-white group-hover:bg-iabs-red/20 transition-all border border-white/5">{index + 4}</div></td>
                          <td className="p-3"><div className="flex items-center gap-3"><ProAvatar url={user.avatar_url} username={user.username} frameUrl={user.active_frame_url} /><span className="font-black text-base text-white group-hover:text-iabs-red transition-all tracking-tight">{user.username}</span></div></td>
                          <td className="p-3 text-center"><div className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/5 border border-white/5 font-black text-sm text-gray-300 group-hover:text-white transition-all font-mono">{user.wins || 0}</div></td>
                          <td className="p-3 text-left"><div className="font-black text-xl text-kick-green font-mono tracking-tighter drop-shadow-[0_0_10px_rgba(83,252,24,0.3)] group-hover:scale-110 transition-transform origin-left">{user.score || 0}</div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {leaderboardData.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 space-y-4 opacity-20">
                      <Trophy size={60} strokeWidth={1} />
                      <div className="text-lg font-black italic">ARENA IS EMPTY</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 mt-4 mb-8">
            <button onClick={handleGoHome} className="group px-8 py-3 bg-white/5 hover:bg-white/10 rounded-[1.5rem] text-white font-black text-sm transition-all border border-white/10 hover:border-white/30 flex items-center gap-3">
              <ChevronRight size={16} className="group-hover:translate-x-2 transition-transform" /> العودة للرئيسية
            </button>
            <button onClick={loadLeaderboard} className="p-3 bg-iabs-red/10 text-iabs-red rounded-[1.5rem] border border-iabs-red/20 hover:bg-iabs-red hover:text-white transition-all">
              <RefreshCw size={18} className={isLoadingLeaderboard ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      );

      case 'HOME':
      default:
        return (
          <div className="flex-1 flex flex-col items-center w-full max-w-5xl mx-auto px-2 pt-6 pb-3 animate-in fade-in duration-700">
            {/* Hero Section */}
            <div className="w-full relative flex flex-col items-center mt-4 mb-4">
              {/* Glow orbs */}
              <div className="absolute top-12 w-56 h-56 bg-red-600/15 blur-[100px] rounded-full animate-pulse"></div>
              <div className="absolute top-20 -right-10 w-32 h-32 bg-yellow-500/10 blur-[80px] rounded-full animate-pulse" style={{animationDelay:'1s'}}></div>
              <div className="absolute top-20 -left-10 w-32 h-32 bg-purple-600/10 blur-[80px] rounded-full animate-pulse" style={{animationDelay:'2s'}}></div>

              {/* iABS — علامة 5 طبقات (نفس تصميم الدليل).
                  بدون preserve-3d/perspective: في سياق ثلاثي الأبعاد
                  تُرتَّب الطبقات حسب العمق فتختفي الحروف تحت اللمعة. */}
              <div className="relative w-full flex justify-center">
                <div className="absolute inset-x-0 top-1/2 h-40 bg-red-600/15 blur-[100px] rounded-full animate-pulse -translate-y-1/2"></div>
                <div className="relative">
                  <IabsLogo size="lg" />
                </div>
              </div>

              {/* Subtitle */}
              <div className="relative text-center mt-3" style={{transform:'rotateX(2deg) translateZ(10px)', perspective:'800px'}}>
                <div className="flex flex-col items-center gap-2">
                  <div className="h-px w-64 bg-gradient-to-r from-transparent via-red-500/60 to-transparent"></div>
                  <h2 className="text-xl md:text-2xl font-black text-white/90 px-4 text-center leading-relaxed tracking-wide"
                    style={{textShadow:'0 2px 15px rgba(0,0,0,0.8), 0 0 30px rgba(255,0,0,0.15)'}}>
                    أكبر منصة ألعاب تفاعلية للبثوث المباشرة
                  </h2>
                </div>
              </div>
            </div>

            {/* Games Section */}
            <div className="w-full flex flex-col items-center mb-4 space-y-3 px-1" style={{perspective:'1200px'}}>
              {(() => {
                const primaryVisible = games.filter(g => g.is_primary && (g.is_visible !== false || isEditMode));

                if (primaryVisible.length === 2) {
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
                      {primaryVisible.map((game, idx) => (
                        <div key={game.id}
                          className="animate-in slide-in-from-bottom duration-700"
                          style={{
                            animationDelay: `${idx * 150}ms`,
                            transform: `rotateX(${2 - idx * 4}deg) rotateY(${idx === 0 ? '-2' : '2'}deg) translateZ(${20 - idx * 10}px)`,
                            transformStyle: 'preserve-3d',
                            perspective: '800px'
                          }}>
                          <PremiumGameButton
                            title={game.view_id === 'HARDEES_MEMORY' ? '' : game.title}
                            icon={ICON_MAP[game.icon_name] || Sparkles}
                              imageUrl={game.view_id === 'LETTER_GAME' ? '/photo/image76.png' : game.view_id === 'HIGHER_LOWER' ? '/photo/content.png' : game.view_id === 'HARDEES_MEMORY' ? '/908765436789.png' : undefined}
                              imageScale={game.view_id === 'HIGHER_LOWER' ? 'scale-[2.5]' : game.view_id === 'HARDEES_MEMORY' ? 'scale-[3.5] translate-x-[25%]' : 'scale-[1.2]'}
                              imageContainerClass={game.view_id === 'HIGHER_LOWER' ? 'w-7 h-7 translate-x-2' : game.view_id === 'HARDEES_MEMORY' ? 'w-8 h-8' : undefined}
                              isPrimary
                            onClick={() => setCurrentView(game.view_id)}
                            index={idx}
                            total={games.length}
                            isEditMode={isEditMode}
                            isVisible={game.is_visible !== false}
                            onMoveUp={() => moveGame(games.indexOf(game), 'up')}
                            onMoveDown={() => moveGame(games.indexOf(game), 'down')}
                            onToggleVisibility={() => toggleGameVisibility(game.id)}
                            onToggleSize={() => toggleGameSize(game.id)}
                          />
                        </div>
                      ))}
                    </div>
                  );
                }

                return (
                  <>
                    <div className="w-full flex justify-center max-w-lg">
                      {primaryVisible.slice(0, 1).map((game) => (
                        <div key={game.id} className="w-full flex justify-center"
                          style={{
                            transform: 'rotateX(3deg) translateZ(30px)',
                            transformStyle: 'preserve-3d',
                            perspective: '800px'
                          }}>
                          <PremiumGameButton
                            title={game.view_id === 'HARDEES_MEMORY' ? '' : game.title}
                            icon={ICON_MAP[game.icon_name] || Sparkles}
                              imageUrl={game.view_id === 'LETTER_GAME' ? '/photo/image76.png' : game.view_id === 'HIGHER_LOWER' ? '/photo/content.png' : game.view_id === 'HARDEES_MEMORY' ? '/908765436789.png' : undefined}
                              imageScale={game.view_id === 'HIGHER_LOWER' ? 'scale-[2.5]' : game.view_id === 'HARDEES_MEMORY' ? 'scale-[3.5] translate-x-[25%]' : 'scale-[1.2]'}
                              imageContainerClass={game.view_id === 'HIGHER_LOWER' ? 'w-7 h-7 translate-x-2' : game.view_id === 'HARDEES_MEMORY' ? 'w-8 h-8' : undefined}
                              isPrimary
                            onClick={() => setCurrentView(game.view_id)}
                            index={0}
                            total={games.length}
                            isEditMode={isEditMode}
                            isVisible={game.is_visible !== false}
                            onMoveUp={() => moveGame(games.indexOf(game), 'up')}
                            onMoveDown={() => moveGame(games.indexOf(game), 'down')}
                            onToggleVisibility={() => toggleGameVisibility(game.id)}
                            onToggleSize={() => toggleGameSize(game.id)}
                          />
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-lg">
                      {primaryVisible.slice(1, 3).map((game, idx) => (
                        <div key={game.id} className="w-full"
                          style={{
                            transform: `rotateX(${2 - idx * 3}deg) rotateY(${idx === 0 ? '-1' : '1'}deg)`,
                            transformStyle: 'preserve-3d',
                            perspective: '600px'
                          }}>
                          <PremiumGameButton
                            title={game.view_id === 'HARDEES_MEMORY' ? '' : game.title}
                            icon={ICON_MAP[game.icon_name] || Sparkles}
                              imageUrl={game.view_id === 'LETTER_GAME' ? '/photo/image76.png' : game.view_id === 'HIGHER_LOWER' ? '/photo/content.png' : game.view_id === 'HARDEES_MEMORY' ? '/908765436789.png' : undefined}
                              imageScale={game.view_id === 'HIGHER_LOWER' ? 'scale-[2.5]' : game.view_id === 'HARDEES_MEMORY' ? 'scale-[3.5] translate-x-[25%]' : 'scale-[1.2]'}
                              imageContainerClass={game.view_id === 'HIGHER_LOWER' ? 'w-7 h-7 translate-x-2' : game.view_id === 'HARDEES_MEMORY' ? 'w-8 h-8' : undefined}
                              isPrimary
                            onClick={() => setCurrentView(game.view_id)}
                            index={idx + 1}
                            total={games.length}
                            isEditMode={isEditMode}
                            isVisible={game.is_visible !== false}
                            onMoveUp={() => moveGame(games.indexOf(game), 'up')}
                            onMoveDown={() => moveGame(games.indexOf(game), 'down')}
                            onToggleVisibility={() => toggleGameVisibility(game.id)}
                            onToggleSize={() => toggleGameSize(game.id)}
                          />
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-lg">
                      {primaryVisible.slice(3).map((game, idx) => (
                        <div key={game.id} className="w-full"
                          style={{
                            transform: `rotateX(${1 - idx * 2}deg) rotateY(${idx % 2 === 0 ? '-1' : '1'}deg)`,
                            transformStyle: 'preserve-3d',
                            perspective: '600px'
                          }}>
                          <PremiumGameButton
                            title={game.view_id === 'HARDEES_MEMORY' ? '' : game.title}
                            icon={ICON_MAP[game.icon_name] || Sparkles}
                              imageUrl={game.view_id === 'LETTER_GAME' ? '/photo/image76.png' : game.view_id === 'HIGHER_LOWER' ? '/photo/content.png' : game.view_id === 'HARDEES_MEMORY' ? '/908765436789.png' : undefined}
                              imageScale={game.view_id === 'HIGHER_LOWER' ? 'scale-[2.5]' : game.view_id === 'HARDEES_MEMORY' ? 'scale-[3.5] translate-x-[25%]' : 'scale-[1.2]'}
                              imageContainerClass={game.view_id === 'HIGHER_LOWER' ? 'w-7 h-7 translate-x-2' : game.view_id === 'HARDEES_MEMORY' ? 'w-8 h-8' : undefined}
                              isPrimary
                            onClick={() => setCurrentView(game.view_id)}
                            index={idx + 3}
                            total={games.length}
                            isEditMode={isEditMode}
                            isVisible={game.is_visible !== false}
                            onMoveUp={() => moveGame(games.indexOf(game), 'up')}
                            onMoveDown={() => moveGame(games.indexOf(game), 'down')}
                            onToggleVisibility={() => toggleGameVisibility(game.id)}
                            onToggleSize={() => toggleGameSize(game.id)}
                          />
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>

            {/* More Games Section */}
            <div className="w-full max-w-5xl space-y-3 mb-6">
              <div className="flex items-center gap-4 px-2">
                <div className="h-px flex-1 bg-gradient-to-l from-transparent via-red-500/30 to-transparent"></div>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-red-500 rounded-full animate-pulse"></div>
                  <h2 className="text-white/50 font-black text-[9px] uppercase tracking-[1em] italic">المزيد من الألعاب</h2>
                  <div className="w-1 h-1 bg-red-500 rounded-full animate-pulse" style={{animationDelay:'0.5s'}}></div>
                </div>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-red-500/30 to-transparent"></div>
              </div>

              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 px-1"
                style={{perspective:'1000px'}}>
                {games.filter(g => !g.is_primary).map((game, idx) => (
                  <div key={game.id}
                    className="animate-in slide-in-from-bottom duration-500"
                    style={{
                      animationDelay: `${idx * 80}ms`,
                      transform: `rotateY(${idx % 2 === 0 ? '2' : '-2'}deg)`,
                      transformStyle: 'preserve-3d',
                      perspective: '500px'
                    }}>
                    <PremiumGameButton
                      title={game.view_id === 'HARDEES_MEMORY' ? '' : game.title}
                      icon={ICON_MAP[game.icon_name] || Sparkles}
                      imageUrl={game.view_id === 'LETTER_GAME' ? '/photo/image76.png' : game.view_id === 'HIGHER_LOWER' ? '/photo/content.png' : game.view_id === 'HARDEES_MEMORY' ? '/908765436789.png' : undefined}
                      imageScale={game.view_id === 'HIGHER_LOWER' ? 'scale-[2.5]' : game.view_id === 'HARDEES_MEMORY' ? 'scale-[3.5] translate-x-[25%]' : 'scale-[1.3]'}
                      imageContainerClass={game.view_id === 'HIGHER_LOWER' ? 'w-7 h-7 translate-x-2' : game.view_id === 'HARDEES_MEMORY' ? 'w-8 h-8' : undefined}
                      onClick={() => setCurrentView(game.view_id)}
                      isComingSoon={game.is_coming_soon}
                      comingSoonText={game.coming_soon_text}
                      hasOBS={game.has_obs}
                      index={idx + games.filter(g => g.is_primary).length}
                      total={games.length}
                      isEditMode={isEditMode}
                      isVisible={game.is_visible !== false}
                      onMoveUp={() => moveGame(games.indexOf(game), 'up')}
                      onMoveDown={() => moveGame(games.indexOf(game), 'down')}
                      onToggleVisibility={() => toggleGameVisibility(game.id)}
                      onToggleSize={() => toggleGameSize(game.id)}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Section */}
            <div className="w-full flex flex-wrap items-center justify-center gap-4 mt-1 pb-6">
              {/* Leaderboard Button */}
              <button onClick={() => setCurrentView('LEADERBOARD')}
                className="group relative flex items-center gap-4 px-8 py-4 bg-gradient-to-b from-yellow-600/20 to-yellow-700/10 border border-yellow-500/20 hover:border-yellow-400/50 rounded-2xl transition-all duration-500 hover:scale-105 active:scale-95 overflow-hidden"
                style={{transform:'rotateX(2deg) translateZ(15px)', transformStyle:'preserve-3d', perspective:'500px'}}>
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/0 via-yellow-500/10 to-yellow-500/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000 skew-x-[-20deg]"></div>
                <div className="absolute -inset-2 bg-yellow-500/10 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                <Trophy size={28} className="text-yellow-500 group-hover:animate-bounce drop-shadow-[0_0_15px_rgba(255,215,0,0.6)] transition-transform" />
                <div className="flex flex-col items-start">
                  <span className="text-white font-black text-base tracking-wider">لوحة الصدارة</span>
                  <span className="text-yellow-500/50 font-bold text-[9px] uppercase tracking-[0.3em]">Leaderboard</span>
                </div>
              </button>

              {/* Admin Button */}
              {readSession('site_access_granted')?.role === 'admin' && (
                <button onClick={() => {
                  const adminAuth = readSession('site_access_granted');
                  if (adminAuth) {
                    setCurrentView('ADMIN_PANEL');
                  } else {
                    setCurrentView('ADMIN_LOGIN');
                  }
                }}
                  className="group relative flex items-center gap-4 px-8 py-4 bg-gradient-to-b from-blue-600/20 to-blue-700/10 border border-blue-500/20 hover:border-blue-400/50 rounded-2xl transition-all duration-500 hover:scale-105 active:scale-95 overflow-hidden"
                  style={{transform:'rotateX(2deg) translateZ(15px)', transformStyle:'preserve-3d', perspective:'500px'}}>
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/10 to-blue-500/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000 skew-x-[-20deg]"></div>
                  <ShieldCheck size={28} className="text-blue-500 group-hover:rotate-12 transition-transform drop-shadow-[0_0_15px_rgba(59,130,246,0.6)]" />
                  <div className="flex flex-col items-start">
                    <span className="text-white font-black text-base tracking-wider">لوحة الإدارة</span>
                    <span className="text-blue-500/50 font-bold text-[9px] uppercase tracking-[0.3em]">Admin Panel</span>
                  </div>
                </button>
              )}

              {/* Host Login Button */}
              <button onClick={openHostPage}
                className="group relative flex items-center gap-4 px-8 py-4 bg-gradient-to-b from-emerald-600/20 to-emerald-700/10 border border-emerald-500/20 hover:border-emerald-400/50 rounded-2xl transition-all duration-500 hover:scale-105 active:scale-95 overflow-hidden"
                style={{transform:'rotateX(2deg) translateZ(15px)', transformStyle:'preserve-3d', perspective:'500px'}}>
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/10 to-emerald-500/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000 skew-x-[-20deg]"></div>
                <div className="absolute -inset-2 bg-emerald-500/10 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                <User size={28} className="text-emerald-500 group-hover:scale-110 transition-transform drop-shadow-[0_0_15px_rgba(16,185,129,0.6)]" />
                <div className="flex flex-col items-start">
                  <span className="text-white font-black text-base tracking-wider">دخول المستضيف</span>
                  <span className="text-emerald-500/50 font-bold text-[9px] uppercase tracking-[0.3em]">Host Login</span>
                </div>
              </button>

              {/* Leaderboard nav */}
              {userRole !== 'admin' && (
                <button onClick={() => setCurrentView('LEADERBOARD')}
                  className="flex items-center gap-2 px-5 py-3 text-white/30 hover:text-yellow-500/70 font-black text-sm tracking-[0.2em] uppercase transition-all hover:scale-105 border border-white/5 hover:border-yellow-500/20 rounded-xl italic">
                  <Trophy size={18} />
                  لوحة الصدارة
                </button>
              )}

              <button onClick={() => setCurrentView('ABOUT')}
                className="group relative flex items-center gap-4 px-8 py-4 bg-gradient-to-b from-purple-600/20 to-purple-700/10 border border-purple-500/20 hover:border-purple-400/50 rounded-2xl transition-all duration-500 hover:scale-105 active:scale-95 overflow-hidden"
                style={{transform:'rotateX(2deg) translateZ(15px)', transformStyle:'preserve-3d', perspective:'500px'}}>
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-purple-500/10 to-purple-500/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000 skew-x-[-20deg]"></div>
                <Sparkles size={28} className="text-purple-500 group-hover:rotate-12 transition-transform drop-shadow-[0_0_15px_rgba(147,51,234,0.6)]" />
                <div className="flex flex-col items-start">
                  <span className="text-white font-black text-base tracking-wider">عن المنصة</span>
                  <span className="text-purple-500/50 font-bold text-[9px] uppercase tracking-[0.3em]">About iABS</span>
                </div>
              </button>

              {!isEditMode && userRole === 'admin' && (
                <button onClick={() => setIsEditMode(true)}
                  className="flex items-center gap-2 px-5 py-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-white/70 hover:text-white font-black text-sm italic tracking-tighter transition-all hover:scale-105 active:scale-95 group">
                  <Edit2 size={16} className="text-red-500 group-hover:rotate-12 transition-transform" />
                  <span>تعديل الألعاب</span>
                </button>
              )}

              {isEditMode && (
                <>
                  <button onClick={saveGamesOrder} disabled={isSavingGames}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-b from-green-600 to-green-800 rounded-xl border border-green-400/30 text-white font-black text-sm italic shadow-[0_0_25px_rgba(22,163,74,0.3)] hover:scale-105 transition-all active:scale-95">
                    {isSavingGames ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    <span>حفظ الترتيب</span>
                  </button>
                  <button onClick={handleLogout}
                    className="flex items-center gap-2 px-5 py-3 bg-red-600/10 hover:bg-red-600/30 rounded-xl border border-red-500/20 text-red-400 hover:text-white font-black text-sm italic transition-all active:scale-95">
                    <LogOut size={16} />
                    <span>خروج</span>
                  </button>
                </>
              )}
            </div>
          </div>
        );
    }
  };


  if (isOBSMode) {
    return (
      <div className="fixed inset-0 bg-transparent overflow-hidden flex items-center justify-center z-[99999]">
        {renderContent(true)}
      </div>
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
    >
      <OBSLinksModal isOpen={showOBSModal} onClose={() => setShowOBSModal(false)} />
      
      {/* بوابة الموقع العامة — لا تظهر إطلاقاً داخل رابط الاستضافة */}
      {!isAuthorized && currentView !== 'ABOUT' && !hostRoute && (
        <GlobalPasswordPage onSuccess={(role) => {
          setUserRole(role);
          setIsAuthorized(true);
          setCurrentView('HOME');
        }} />
      )}

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

      </Layout>
  );
};

export default App;

