
import React, { useState } from 'react';
import { ViewState } from '../types';
import { ChatWidget } from './ChatWidget';
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
}

export const Layout: React.FC<LayoutProps> = ({ children, currentView, onChangeView, onOBSLinks, onToggleOBSPreview, obsPreviewActive, obsPreviewSlot, isAuthorized, userRole }) => {
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
    return "url('/icg1-arena-bg.png')";
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

  return (
    <div className="icg1-shell app-shell flex bg-black overflow-hidden font-sans" data-game-active={isGameView} dir="rtl">

      {/* Sidebar Container */}
      {isAuthorized && currentView !== 'USER_DASHBOARD' && currentView !== 'ABOUT' && (
        <aside
          style={{ width: chatOpen ? `${sidebarWidth}px` : '0px' }}
          className="icg1-sidebar fixed lg:static inset-y-0 right-0 lg:inset-auto z-[200] lg:z-50 h-full transition-all duration-500 ease-in-out border-l border-white/5 flex-shrink-0 flex flex-col bg-[#050505] shadow-[20px_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden"
        >
          {/* --- MODERN COMMAND BAR (ABOVE CHAT) --- */}
          <div className="icg1-controlbar h-9 shrink-0 bg-gradient-to-l from-red-600/10 via-black to-black border-b border-white/5 flex items-center justify-between px-2 z-30">
            <div className="flex items-center gap-1.5">
              <div className="p-1 bg-gradient-to-br from-red-600 to-red-900 rounded-md shadow-[0_0_15px_rgba(255,0,0,0.3)] border border-white/20">
                <LayoutGrid size={10} className="text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.8)]" />
              </div>
              <div className="flex flex-col">
                <span className="text-[7px] font-black text-white/80 uppercase tracking-[0.2em] italic leading-none">التحكم</span>
                <span className="text-[5px] font-bold text-red-500/60 uppercase tracking-widest">Control</span>
              </div>
            </div>

            <div className="flex items-center gap-0.5 bg-white/5 p-0.5 rounded-lg border border-white/10">
              <button
                onClick={() => handleResize(-20)}
                title="تصغير"
                className="p-1 hover:bg-white/10 text-gray-400 hover:text-white transition-all rounded active:scale-90"
              >
                <Minimize2 size={8} />
              </button>
              <div className="w-px h-2.5 bg-white/10"></div>
              <button
                onClick={() => handleResize(20)}
                title="تكبير"
                className="p-1 hover:bg-white/10 text-gray-400 hover:text-white transition-all rounded active:scale-90"
              >
                <Maximize2 size={8} />
              </button>
              <div className="w-px h-2.5 bg-white/10"></div>
              <button
                onClick={() => toggleChat(false)}
                title="إخفاء"
                className="p-1 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white transition-all rounded active:scale-90"
              >
                <PanelRightClose size={8} className="rotate-180" />
              </button>
            </div>

            {isAuthorized && (
              <div className="flex items-center gap-0.5">
                {userRole === 'user' && (
                  <button
                    onClick={() => onChangeView('USER_DASHBOARD' as any)}
                    className="p-1 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all rounded border border-white/10 active:scale-95"
                    title="ملفي الشخصي"
                  >
                    <User size={10} />
                  </button>
                )}
                <button
                  onClick={() => onChangeView(userRole === 'user' ? 'USER_DASHBOARD' as any : 'HOME')}
                  className="p-1 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white transition-all rounded border border-red-600/30 active:scale-95"
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
          {!isHome && currentView !== 'MAHMAH_GAME' && (
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
      {isAuthorized && chatOpen && currentView !== 'USER_DASHBOARD' && currentView !== 'ABOUT' && (
        <div className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => toggleChat(false)} />
      )}

      {/* Main Game Area */}
      <main className="icg1-main flex-1 relative flex flex-col h-full overflow-hidden bg-black">
        {/* Global Background Layer */}
        <div
          className="absolute inset-0 z-0 pointer-events-none opacity-60 transition-all duration-1000 bg-center bg-contain"
          style={{
            backgroundImage: viewBg(currentView),
            backgroundSize: 'cover'
          }}
        ></div>

        {/* Streamer Facecam Frame - Only for Admin/Streamer, NOT for regular users */}
        {isAuthorized && userRole === 'admin' && currentView !== 'ABOUT' && (
          <div className="absolute top-8 left-8 w-[400px] h-[225px] pointer-events-none z-[100] hidden lg:block">
            {/* Bottom Line (fades to left) */}
            <div className="absolute bottom-0 left-0 w-full h-[3px] bg-gradient-to-l from-red-500 via-red-600 to-transparent shadow-[0_0_20px_rgba(239,68,68,0.6)]"></div>
            {/* Right Line (fades to top) */}
            <div className="absolute bottom-0 right-0 w-[3px] h-full bg-gradient-to-t from-red-500 via-red-600 to-transparent shadow-[0_0_20px_rgba(239,68,68,0.6)]"></div>
            
            {/* Corner Glow Accent (bottom-right) */}
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.9)] animate-pulse"></div>
            <div className="absolute -bottom-4 -right-4 w-10 h-10 bg-red-500/20 blur-xl rounded-full"></div>
            
            {/* Label */}
            <div className="absolute bottom-4 right-4 flex items-center gap-2 opacity-50">
              <span className="text-white font-black text-[9px] tracking-[0.3em] uppercase italic">Facecam</span>
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_5px_red]"></div>
            </div>
          </div>
        )}

        {/* Content Container */}
        {/* Added pr-[350px] padding for top area to prevent overlap if elements try to align right */}
        <div className="flex-1 w-full h-full relative z-10 overflow-y-auto overflow-x-hidden flex flex-col items-center pb-[env(safe-area-inset-bottom)]">
          {children}
        </div>
      </main>

      {/* Re-Open Chat Button (Visible only when chat is closed) */}
      {isAuthorized && !chatOpen && currentView !== 'USER_DASHBOARD' && currentView !== 'ABOUT' && (
        <button
          onClick={() => toggleChat(true)}
          className="fixed bottom-20 right-3 z-[100] p-2.5 bg-red-600 text-white rounded-xl shadow-[0_0_30px_rgba(255,0,0,0.5)] hover:scale-110 active:scale-95 transition-all border border-white/20 animate-in slide-in-from-left-20 duration-500"
        >
          <MessageSquare size={16} strokeWidth={2.5} className="drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
        </button>
      )}
    </div>
  );
};