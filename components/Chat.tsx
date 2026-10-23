import React, { useState, useEffect, useRef } from 'react';
import { Language, ChatMessage } from '../types';
import { chatService } from '../services/chatService';
import { BRAND_LINKS, KICK_CHANNEL_SLUG } from '../brand';

interface ChatWidgetProps {
  lang: Language;
  isDemo?: boolean;
}

// --- Icons for Badges ---
const OwnerBadge = () => (
  <div className="flex items-center justify-center w-4 h-4 rounded-md bg-gradient-to-b from-[#ff6b6b] to-[#FF2D2D] text-black shrink-0 shadow-[0_0_10px_rgba(255,45,45,0.5)]" title="Broadcaster">
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
      <path d="M5 19h14v2H5v-2zm7-13l3.5 7h-7L12 6zM6 17h12l-3-6H9l-3 6z" />
      <path d="M12 2L2 19h20L12 2zm0 3.5L18.5 17H5.5L12 5.5z" />
    </svg>
  </div>
);

const ModBadge = () => (
  <div className="flex items-center justify-center w-4 h-4 rounded-md bg-[#1f2937] border border-emerald-400/60 text-emerald-300 shrink-0 shadow-[0_0_8px_rgba(52,211,153,0.35)]" title="Moderator">
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
      <path d="M18.828 2.343a3.001 3.001 0 00-4.243 0l-5.071 5.071-3.657-3.657a1 1 0 00-1.414 0l-1.414 1.414a1 1 0 000 1.414l3.657 3.657-5.071 5.071a1 1 0 000 1.414l2.828 2.828a1 1 0 001.414 0l5.071-5.071 3.657 3.657a1 1 0 001.414 0l1.414-1.414a1 1 0 000-1.414l-3.657-3.657 5.071-5.071a3.001 3.001 0 000-4.243zm-2.829 2.829a1 1 0 111.414-1.414 1 1 0 01-1.414 1.414z" />
    </svg>
  </div>
);

const VipBadge = () => (
  <div className="flex items-center justify-center w-4 h-4 rounded-md bg-gradient-to-b from-[#ff8ac2] to-[#F542A8] text-white shrink-0 shadow-[0_0_8px_rgba(245,66,168,0.45)]" title="VIP">
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
      <path d="M12 2L2 9l10 13 10-13-10-7z" />
    </svg>
  </div>
);

const INITIAL_MESSAGES: ChatMessage[] = [];

export const ChatWidget: React.FC<ChatWidgetProps> = ({ lang, isDemo }) => {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [statusText, setStatusText] = useState('');
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  const t = {
    title: lang === 'en' ? 'Live Chat' : 'شات البث المباشر',
    online: lang === 'en' ? 'LIVE NOW' : 'مباشر الآن',
    connecting: lang === 'en' ? 'Connecting...' : 'جارِ الاتصال...',
    connected: lang === 'en' ? 'Live' : 'متصل',
    error: lang === 'en' ? 'Connection Issue' : 'مشكلة اتصال',
    retry: lang === 'en' ? 'Retry' : 'إعادة المحاولة',
    empty: lang === 'en' ? 'Chat is warming up… be the first to hype!' : 'الشات يسخن… كن أول من يولع الأجواء!',
    join: lang === 'en' ? 'Join chat on Kick' : 'شارك في الشات على Kick',
    scrollDown: lang === 'en' ? 'New messages' : 'رسائل جديدة',
  };

  const [showJump, setShowJump] = useState(false);

  useEffect(() => {
    // 1. Listen for new messages
    const unbindMessage = chatService.onMessage((msg) => {
      setMessages(prev => {
        const newArr = [...prev, msg];
        return newArr.slice(-75);
      });
    });

    // 2. Listen for deleted messages
    const unbindDelete = chatService.onDeleteMessage((msgId) => {
      setMessages(prev => prev.filter(m => m.id !== msgId));
    });

    // 3. Listen for status changes
    const unbindStatus = chatService.onStatusChange((connected, error, details) => {
      setIsConnected(connected);
      setConnectionError(error);
      setStatusText(details || '');
    });

    // 4. Connect to the configured Kick channel
    chatService.connect(KICK_CHANNEL_SLUG);

    // 5. Cleanup
    return () => {
      unbindMessage();
      unbindDelete();
      unbindStatus();
      chatService.disconnect();
    };
  }, []);

  // Auto-scroll — locked inside the box only, instant (no smooth freeze on flood)
  const handleScroll = () => {
    const el = chatContainerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    stickToBottomRef.current = nearBottom;
    setShowJump(!nearBottom && messages.length > 3);
  };

  useEffect(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    if (stickToBottomRef.current || messages.length <= 5) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const jumpToBottom = () => {
    const el = chatContainerRef.current;
    if (!el) return;
    stickToBottomRef.current = true;
    setShowJump(false);
    el.scrollTop = el.scrollHeight;
  };

  const getBadge = (role: string) => {
    switch (role) {
      case 'owner': return <OwnerBadge />;
      case 'moderator': return <ModBadge />;
      case 'vip': return <VipBadge />;
      default: return null;
    }
  };

  const renderMessage = (content: string) => {
    if (!content) return null;

    // Regex to match Kick emotes: [emote:ID:NAME]
    const emoteRegex = /\[emote:(\d+):([\w\s\-]+)\]/gi;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = emoteRegex.exec(content)) !== null) {
      // Add text before the emote
      if (match.index > lastIndex) {
        parts.push(content.substring(lastIndex, match.index));
      }

      const emoteId = match[1];
      const emoteName = match[2];
      const emoteUrl = `https://files.kick.com/emotes/${emoteId}/fullsize`;

      parts.push(
        <img
          key={`${match.index}-${emoteId}`}
          src={emoteUrl}
          alt={emoteName}
          title={emoteName}
          loading="lazy"
          className="inline-block w-7 h-7 md:w-8 md:h-8 mx-0.5 -mt-1 align-middle object-contain"
        />
      );

      lastIndex = emoteRegex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }

    return parts.length > 0 ? parts : content;
  };

  return (
    <div className="flex flex-col h-full max-h-full min-h-0 w-full bg-[#0b0d0f] overflow-hidden relative isolate">
      {/* top red energy line */}
      <div className="absolute top-0 inset-x-8 h-[2px] rounded-full bg-gradient-to-l from-transparent via-[#FF2D2D] to-transparent shadow-[0_0_12px_#FF2D2D] z-30 pointer-events-none" />
      {/* ambient glow */}
      <div className="absolute -top-16 -end-16 w-48 h-48 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255,45,45,0.11) 0%, transparent 68%)' }} />
      <div className="absolute -bottom-20 -start-16 w-48 h-48 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(83,252,24,0.06) 0%, transparent 68%)' }} />

      {/* --- Premium Header --- */}
      <div className="shrink-0 z-20 bg-gradient-to-b from-white/[0.07] to-white/[0.02] border-b border-white/[0.07] backdrop-blur-md">
        <div className="flex items-center gap-3 px-4 pt-3.5 pb-3">
          <div className="relative shrink-0">
            <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-b from-[#ff4d4d] to-[#c41e1e] text-black shadow-[0_0_20px_rgba(255,45,45,0.45)]">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <span className={`absolute -bottom-0.5 -end-0.5 w-3 h-3 rounded-full border-2 border-[#0b0d0f] ${isConnected ? 'bg-[#53FC18] live-dot' : connectionError ? 'bg-red-500' : 'bg-yellow-400 animate-pulse'}`} />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`text-white font-black tracking-tight text-[15px] ${lang === 'ar' ? 'font-arabic' : ''}`}>{t.title}</span>
              {isConnected && (
                <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-[3px] rounded-full bg-[#53FC18]/15 border border-[#53FC18]/40 text-[#53FC18] tracking-[0.14em]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#53FC18] animate-pulse" />{t.online}
                </span>
              )}
            </div>
            <span className="text-[11px] text-white/40 font-bold">
              {isConnected ? `${messages.length} • ${t.connected}` : connectionError ? t.error : (statusText || t.connecting)}
            </span>
          </div>
          {connectionError ? (
            <button
              onClick={() => chatService.connect(KICK_CHANNEL_SLUG)}
              className="shrink-0 px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-white/70 hover:text-white transition-colors text-xs font-black flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              {t.retry}
            </button>
          ) : (
            <a
              href={`${BRAND_LINKS.kick}/chatroom`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 w-9 h-9 rounded-xl bg-white/[0.05] border border-white/10 text-white/50 hover:text-white hover:border-[#FF2D2D]/50 hover:bg-[#FF2D2D]/10 transition-all flex items-center justify-center"
              title="Kick"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            </a>
          )}
        </div>
      </div>

      {/* --- Chat List (fixed height, internal scroll only, beautiful bar) --- */}
      <div className="relative flex-1 min-h-0 flex flex-col">
        <div
          ref={chatContainerRef}
          onScroll={handleScroll}
          className="theater-scroll flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-3 space-y-2 [overflow-anchor:none]"
        >
          {messages.length === 0 ? (
            <div className="h-full min-h-[280px] flex flex-col items-center justify-center text-center gap-3 px-6">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center">
                <svg className="w-7 h-7 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className={`text-[13px] font-bold text-white/40 leading-relaxed ${lang === 'ar' ? 'font-arabic' : ''}`}>{t.empty}</p>
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF2D2D]/70 animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF2D2D]/70 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF2D2D]/70 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="chat-msg group flex items-start gap-2 py-2 px-2.5 rounded-2xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.06] hover:border-[#FF2D2D]/25 transition-colors min-w-0 overflow-hidden">
                {(msg.role === 'owner' || msg.role === 'moderator' || msg.role === 'vip') && (
                  <div className="mt-0.5 shrink-0">
                    {getBadge(msg.role)}
                  </div>
                )}
                <div className="min-w-0 flex-1 leading-relaxed text-[13px] md:text-[13.5px] break-words [overflow-wrap:anywhere]">
                  <span
                    className="font-black hover:underline cursor-pointer me-1.5 break-all"
                    style={{ color: msg.user.color || '#fff' }}
                  >
                    {msg.user.username}
                  </span>
                  <span className={`text-white/75 font-medium ${lang === 'ar' ? 'font-arabic' : ''}`}>
                    {renderMessage(msg.content)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* jump to latest */}
        {showJump && (
          <button
            onClick={jumpToBottom}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 inline-flex items-center gap-1.5 text-[11px] font-black px-3.5 py-2 rounded-full bg-[#FF2D2D] text-black shadow-[0_8px_24px_rgba(255,45,45,0.5)] hover:brightness-110 active:scale-95 transition-all animate-fade-in-up"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
            {t.scrollDown}
          </button>
        )}

        {/* fade masks */}
        <div className="absolute top-0 inset-x-0 h-6 bg-gradient-to-b from-[#0b0d0f] to-transparent pointer-events-none" />
        <div className="absolute bottom-0 inset-x-0 h-6 bg-gradient-to-t from-[#0b0d0f] to-transparent pointer-events-none" />
      </div>

      {/* --- Beautiful bottom action bar --- */}
      <div className="shrink-0 z-20 p-3 bg-gradient-to-t from-black/60 to-transparent border-t border-white/[0.06]">
        <a
          href={BRAND_LINKS.kick}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-gradient-to-b from-[#ff4d4d] to-[#e01f1f] text-black font-black text-[13px] shadow-[0_10px_28px_-8px_rgba(255,45,45,0.7)] hover:brightness-110 hover:-translate-y-px active:translate-y-0 active:scale-[0.99] transition-all overflow-hidden"
        >
          <span className="absolute inset-0 bg-gradient-to-l from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
          <span className={lang === 'ar' ? 'font-arabic' : ''}>{t.join}</span>
        </a>
      </div>
    </div>
  );
};
