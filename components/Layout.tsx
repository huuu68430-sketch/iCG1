
import React, { useState } from 'react';
import { ViewState } from '../types';
import { ChatWidget } from './ChatWidget';
import { GameBackButton } from './GameBackButton';
import {
  MessageSquare, X, Settings2,
  Maximize2, Minimize2, PanelRightClose,
  LayoutGrid, Video, Home, User
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  onOBSLinks?: () => void;
  onToggleOBSPreview?: () => void;
  obsPreviewActive?: boolean;
  obsPreviewSlot?: React.ReactNode;
  isAuthorized?: boolean;
  userRole?: 'admin' | 'user';
  /** الشرح مفتوح — الشريط الجانبي (التحكم + الشات) ينكمش ويرجع بعد ما يقفل */
  tutorialOpen?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentView, onChangeView, onOBSLinks, onToggleOBSPreview, obsPreviewActive, obsPreviewSlot, isAuthorized, userRole, tutorialOpen }) => {
  const [chatOpen, setChatOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth >= 1024;
  });
  const [sidebarWidth, setSidebarWidth] = useState(340); // Default Width

  const toggleChat = (open: boolean) => {
    setChatOpen(open);
    if (open && typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarWidth(Math.min(340, Math.round(window.innerWidth * 0.85)));
    }
  };

  const viewBg = (view: ViewState) => {
    if (view === 'HOME') return "url('/bg-435242.jpg')";
    const brandedViews = new Set(['ADMIN_LOGIN', 'ADMIN_PANEL', 'USER_DASHBOARD', 'LEADERBOARD', 'ABOUT', 'HOST_LOGIN', 'HOST_GATE']);
    return brandedViews.has(String(view)) ? "url('/icg1-arena-bg-v2.png')" : "url('/icg1-arena-bg.png')";
  };

  const handleResize = (amount: number) => {
    setSidebarWidth(prev => {
      const next = prev + amount;
      return Math.min(Math.max(next, 220), 480); // Limits: 220px to 480px
    });
  };

  const isHome = currentView === 'HOME' || (currentView as string) === 'ADMIN_LOGIN' || currentView === 'ABOUT';
  const nonGameViews = new Set(['HOME', 'ADMIN_LOGIN', 'ADMIN_PANEL', 'USER_DASHBOARD', 'LEADERBOARD', 'ABOUT', 'HOST_LOGIN', 'HOST_GATE']);
  const isGameView = !nonGameViews.has(String(currentView));

  // واجهات لا يجب أن يظهر فيها الشريط الجانبي (الشات/التحكم) إطلاقاً
  const noSidebarViews = new Set([
    'USER_DASHBOARD',
    'ADMIN_LOGIN',
    'HOST_GATE',
    'HOST_LOGIN',
    'USER_AUTH',
    'ABOUT',
    'EMOJI_CODE',
  ]);
  const showSidebar = !noSidebarViews.has(String(currentView));
  const isDashboard = String(currentView) === 'USER_DASHBOARD';

  return (
    <div className="icg1-shell app-shell flex bg-black overflow-hidden font-sans" data-game-active={isGameView} dir="rtl">

      {/* Sidebar Container (hidden for the dashboard, auth screens and self-contained games) */}
      {showSidebar && (
        <aside
          style={{ width: chatOpen && !tutorialOpen ? `${sidebarWidth}px` : '0px' }}
          className="icg1-sidebar fixed lg:static inset-y-0 right-0 lg:inset-auto z-[200] lg:z-50 h-full transition-all duration-500 ease-in-out border-l border-[#e8be6e]/30 flex-shrink-0 flex flex-col bg-[#080604] shadow-[-15px_0_50px_rgba(0,0,0,0.85)] relative overflow-hidden"
        >
          {/* --- GOLD LUXURY COMMAND BAR (ABOVE CHAT) --- */}
          <div className="icg1-controlbar h-9 shrink-0 bg-gradient-to-l from-[#e8be6e]/20 via-[#0e0a05] to-[#080604] border-b border-[#e8be6e]/30 flex items-center justify-between px-2.5 z-30">
            <div className="flex items-center gap-1.5">
              <div className="p-1 bg-gradient-to-br from-[#f9e0a4] to-[#a97a30] rounded-md shadow-[0_0_12px_rgba(232,190,110,0.4)] border border-[#e8be6e]/50">
                <LayoutGrid size={11} className="text-[#1a1006]" />
              </div>
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-[#fbeccb] uppercase tracking-[0.2em] leading-none">التحكم</span>
                <span className="text-[6px] font-bold text-[#e8be6e]/70 uppercase tracking-widest">iCG1 Control</span>
              </div>
            </div>

            <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-lg border border-[#e8be6e]/20">
              <button
                onClick={() => handleResize(-20)}
                title="تصغير"
                className="p-1 hover:bg-[#e8be6e]/15 text-[#a89878] hover:text-[#fbeccb] transition-all rounded active:scale-90"
              >
                <Minimize2 size={9} />
              </button>
              <div className="w-px h-2.5 bg-[#e8be6e]/20"></div>
              <button
                onClick={() => handleResize(20)}
                title="تكبير"
                className="p-1 hover:bg-[#e8be6e]/15 text-[#a89878] hover:text-[#fbeccb] transition-all rounded active:scale-90"
              >
                <Maximize2 size={9} />
              </button>
              <div className="w-px h-2.5 bg-[#e8be6e]/20"></div>
              <button
                onClick={() => toggleChat(false)}
                title="إخفاء الشات"
                className="p-1 bg-[#e8be6e]/15 hover:bg-[#e8be6e] text-[#e8be6e] hover:text-[#1a1006] transition-all rounded active:scale-90"
              >
                <PanelRightClose size={9} className="rotate-180" />
              </button>
            </div>

            {isAuthorized && (
              <div className="flex items-center gap-1">
                {userRole === 'user' && (
                  <button
                    onClick={() => onChangeView('USER_DASHBOARD' as any)}
                    className="p-1 bg-white/5 hover:bg-[#e8be6e]/20 text-[#a89878] hover:text-[#fbeccb] transition-all rounded border border-[#e8be6e]/20 active:scale-95"
                    title="ملفي الشخصي"
                  >
                    <User size={10} />
                  </button>
                )}
                <button
                  onClick={() => onChangeView(userRole === 'user' ? 'USER_DASHBOARD' as any : 'HOME')}
                  className="p-1 bg-gradient-to-br from-[#f9e0a4] to-[#a97a30] text-[#1a1006] hover:brightness-110 transition-all rounded border border-[#e8be6e]/40 active:scale-95 shadow-[0_0_8px_rgba(232,190,110,0.3)]"
                  title={userRole === 'user' ? "لوحة القيادة" : "الرئيسية"}
                >
                  <Home size={10} />
                </button>
              </div>
            )}
          </div>

          {/* Top Section: Chat Content */}
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <ChatWidget lang="ar" />
          </div>

          {/* OBS Preview Section - Integrated into Sidebar */}
          {obsPreviewActive && obsPreviewSlot && (
            <div className="h-[80px] shrink-0 border-t border-white/10 bg-black relative group overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-3 bg-emerald-600/20 px-2 flex items-center z-10 border-b border-white/5">
                <div className="flex items-center gap-1">
                  <div className="w-1 h-1 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-[6px] font-black text-white italic tracking-tighter uppercase">OBS</span>
                </div>
              </div>
              <div className="w-full h-full pt-3 relative overflow-hidden flex items-center justify-center">
                <div className="scale-[0.1] origin-center" style={{ width: '1920px', height: '1080px' }}>
                  {obsPreviewSlot}
                </div>
                <div className="absolute inset-0 z-20"></div>
              </div>
              <div className="absolute inset-0 pointer-events-none border border-emerald-500/20"></div>
            </div>
          )}

          {/* Bottom Section: Game Controls */}
          {!isHome && !nonGameViews.has(String(currentView)) && currentView !== 'MAHMAH_GAME' && currentView !== 'EMOJI_CODE' && (
            <div className="flex-[1.6] min-h-0 border-t border-white/5 bg-gradient-to-b from-black/70 via-red-950/5 to-black/80 backdrop-blur-3xl flex flex-col relative overflow-hidden">
              {/* Top glow line */}
              <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-red-500/40 to-transparent"></div>
              {/* Red accent top-left glow */}
              <div className="absolute -top-10 -left-10 w-20 h-20 bg-red-600/10 blur-3xl rounded-full"></div>

              {/* Header */}
              <div className="relative px-2.5 py-2 border-b border-white/5 flex items-center justify-between bg-black/50">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <div className="p-1 bg-gradient-to-br from-red-600 to-red-900 rounded shadow-[0_0_15px_rgba(255,0,0,0.4)] border border-white/10">
                      <Settings2 size={10} className="text-white animate-spin-slow" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_6px_rgba(34,197,94,0.8)]"></div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-white/90 uppercase tracking-[0.15em] leading-tight">إعدادات الميدان</span>
                    <span className="text-[6px] font-bold text-red-500/60 uppercase tracking-[0.3em]">Arena Controls</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1 h-1 bg-red-500 rounded-full animate-pulse shadow-[0_0_4px_red]"></div>
                  <span className="text-[6px] font-black text-red-500/40 uppercase tracking-[0.2em]">مباشر</span>
                </div>
              </div>

              {/* Portal container */}
              <div id="game-sidebar-portal" className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar p-2 space-y-2">
              </div>

              {/* Bottom glow */}
              <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-red-600/30 to-transparent"></div>
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-1 bg-red-600/20 blur-xl rounded-full"></div>
            </div>
          )}
        </aside>
      )}

      {/* Mobile drawer backdrop */}
      {showSidebar && chatOpen && !tutorialOpen && (
        <div className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => toggleChat(false)} />
      )}

      {/* Main Game Area */}
      <main className="icg1-main flex-1 relative flex flex-col h-full overflow-hidden bg-black">
        {/* Global Background Layer — الداشبورد له خلفيته الكاملة الخاصة */}
        {!isDashboard && (
          <div
            className={`absolute inset-0 z-0 pointer-events-none transition-all duration-1000 bg-center bg-cover ${currentView === 'HOME' ? 'opacity-100' : currentView === 'ABOUT' ? 'opacity-0' : 'opacity-60'}`}
            style={{
              backgroundImage: viewBg(currentView),
            }}
          ></div>
        )}



        {/* Content Container */}
        {/* Added pr-[350px] padding for top area to prevent overlap if elements try to align right */}
        <div className="flex-1 w-full h-full relative z-10 overflow-y-auto overflow-x-hidden flex flex-col items-center pb-[env(safe-area-inset-bottom)]">
          {children}
        </div>

        {/* رجوع ظاهر دائماً داخل ساحة اللعبة — الشريط الجانبي يكون مقفولاً على الجوال */}
        {isGameView && (
          <GameBackButton onHome={() => onChangeView(userRole === 'user' ? 'USER_DASHBOARD' as any : 'HOME')} />
        )}
      </main>

      {/* Re-Open Chat Button (Visible only when chat is closed) */}
      {showSidebar && !chatOpen && (
        <button
          onClick={() => toggleChat(true)}
          className="fixed bottom-20 right-3 z-[100] p-3 bg-gradient-to-br from-[#f9e0a4] to-[#b88a3e] text-[#1a1006] rounded-2xl shadow-[0_0_25px_rgba(232,190,110,0.5)] hover:scale-110 active:scale-95 transition-all border border-[#e8be6e]/60 animate-in slide-in-from-left-20 duration-500"
          aria-label="فتح شات iCG1"
          title="شات iCG1"
        >
          <MessageSquare size={18} strokeWidth={2.5} className="drop-shadow-[0_0_4px_rgba(0,0,0,0.5)]" />
        </button>
      )}
    </div>
  );
};