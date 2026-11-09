import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { chatService } from '../services/chatService';
import { Language, ChatMessage } from '../types';
import './ChatWidget.css';

interface ChatWidgetProps {
  lang: Language;
}

// Color palette from شات iCG1 (1).html
const PALETTE = ['#ff6b6b', '#4dd8ff', '#8aff6b', '#ffd24d', '#ff9a3c', '#c58bff', '#ff7ac6', '#5eead4'];

const fixColor = (color: string | undefined, username: string): string => {
  let c = color || '';
  if (!/^#?[0-9a-f]{6}$/i.test(c)) {
    const sum = [...username].reduce((a, x) => a + x.charCodeAt(0), 0);
    c = PALETTE[sum % PALETTE.length];
  }
  c = c.replace('#', '');
  let [r, g, b] = [0, 2, 4].map((i) => parseInt(c.substr(i, 2), 16));
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (luminance < 0.5) {
    const k = (0.5 - luminance) * 1.2 + 0.2;
    [r, g, b] = [r, g, b].map((v) => Math.round(v + (255 - v) * k));
  }
  return `rgb(${r}, ${g}, ${b})`;
};

// Badges definitions from شات iCG1 (1).html
const BADGES_CONFIG: Record<
  string,
  { c: string; f: string; t: string; icon?: string; text?: string }
> = {
  broadcaster: {
    c: 'linear-gradient(160deg,#fff0b8,#d9a441)',
    f: '#2b1a05',
    t: 'صاحب القناة',
    icon: '<path d="M2 18L3.500 7l4.500 4L12 4l4 7 4.500-4L22 18z"/><rect x="3" y="19" width="18" height="2.500" rx="1"/>'
  },
  moderator: {
    c: 'linear-gradient(160deg,#6ee7a0,#16a34a)',
    f: '#eafff2',
    t: 'مشرف',
    icon: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M8.500 12l2.500 2.500 4.500-5" fill="none" stroke="#06391c" stroke-width="2.200" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  vip: {
    c: 'linear-gradient(160deg,#f7b0ff,#c026d3)',
    f: '#fff',
    t: 'VIP',
    icon: '<path d="M6 3h12l4 6-10 12L2 9z"/>'
  },
  og: {
    c: 'linear-gradient(160deg,#ffc27a,#e0731c)',
    f: '#3a1a04',
    t: 'OG',
    text: 'OG'
  },
  founder: {
    c: 'linear-gradient(160deg,#c9a6ff,#7c3aed)',
    f: '#fff',
    t: 'مؤسس',
    icon: '<path d="M12 2l3 7 7 .6-5.300 4.800L18.200 22 12 18.300 5.800 22l1.500-7.600L2 9.600 9 9z"/>'
  },
  subscriber: {
    c: 'linear-gradient(160deg,#ffe29a,#f0a020)',
    f: '#4a2c00',
    t: 'مشترك',
    icon: '<path d="M12 2l3 7 7 .6-5.300 4.800L18.200 22 12 18.300 5.800 22l1.500-7.600L2 9.600 9 9z"/>'
  },
  sub_gifter: {
    c: 'linear-gradient(160deg,#ffe29a,#f0a020)',
    f: '#4a2c00',
    t: 'مُهدي اشتراكات',
    icon: '<path d="M12 2l3 7 7 .6-5.300 4.800L18.200 22 12 18.300 5.800 22l1.500-7.600L2 9.600 9 9z"/>'
  },
  verified: {
    c: 'linear-gradient(160deg,#8cc8ff,#2f7de1)',
    f: '#fff',
    t: 'موثّق',
    icon: '<circle cx="12" cy="12" r="10"/><path d="M7.500 12.500l3 3 6-7" fill="none" stroke="#0b3a7a" stroke-width="2.600" stroke-linecap="round" stroke-linejoin="round"/>'
  }
};

const BADGE_ORDER = ['broadcaster', 'moderator', 'vip', 'og', 'founder', 'subscriber', 'sub_gifter', 'verified'];

// Convert Arabic eastern numerals to western
const normalizeArabicDigits = (s: string) => s.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());

export const ChatWidget: React.FC<ChatWidgetProps> = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<{ connected: boolean; error: boolean; details: string }>({
    connected: false,
    error: false,
    details: 'جاري الاتصال…'
  });
  const [filter, setFilter] = useState<string>('all');
  const [fontSize, setFontSize] = useState<number>(15);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [msgRate, setMsgRate] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const listRef = useRef<HTMLDivElement | null>(null);
  const timestampsRef = useRef<number[]>([]);
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  const isNearBottom = useCallback(() => {
    const el = listRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    if (listRef.current) {
      listRef.current.scrollTo({
        top: listRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });
      setUnreadCount(0);
    }
  }, []);

  const connectToChat = useCallback(() => {
    setIsRefreshing(true);
    chatService.connect('icg1');
    setTimeout(() => setIsRefreshing(false), 800);
  }, []);

  useEffect(() => {
    connectToChat();

    const unbindMsg = chatService.onMessage((msg) => {
      const now = Date.now();
      timestampsRef.current.push(now);

      const stick = !isPausedRef.current && isNearBottom();

      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        const next = [...prev, msg];
        return next.length > 150 ? next.slice(-150) : next;
      });

      if (stick) {
        requestAnimationFrame(() => scrollToBottom(false));
      } else {
        setUnreadCount((prev) => prev + 1);
      }
    });

    const unbindDelete = chatService.onDeleteMessage((msgId) => {
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, deleted: true } : m)));
    });

    const unbindStatus = chatService.onStatusChange((connected, error, details) => {
      setStatus({ connected, error: !!error, details: details || (connected ? 'القناة متصلة' : 'جاري الاتصال…') });
    });

    // Rate calculation every 1.5s
    const rateInterval = setInterval(() => {
      const cutoff = Date.now() - 60000;
      timestampsRef.current = timestampsRef.current.filter((t) => t > cutoff);
      setMsgRate(timestampsRef.current.length);
    }, 1500);

    return () => {
      unbindMsg();
      unbindDelete();
      unbindStatus();
      clearInterval(rateInterval);
    };
  }, [connectToChat, isNearBottom, scrollToBottom]);

  const handleScroll = () => {
    if (isNearBottom() && unreadCount > 0) {
      setUnreadCount(0);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setUnreadCount(0);
  };

  const adjustFontSize = (delta: number) => {
    setFontSize((prev) => Math.max(12, Math.min(24, prev + delta)));
  };

  // Filter messages
  const filteredMessages = useMemo(() => {
    if (filter === 'all') return messages;
    return messages.filter((m) => {
      const types = (m.badges || []).map((b) => b.type.toLowerCase());
      if (filter === 'sub') return types.includes('subscriber') || types.includes('founder') || types.includes('sub_gifter');
      if (filter === 'mod') return types.includes('moderator');
      if (filter === 'vip') return types.includes('vip');
      if (filter === 'og') return types.includes('og');
      return true;
    });
  }, [filter, messages]);

  // Render individual badge in luxury style from شات iCG1 (1).html
  const renderBadge = (badgeType: string, key: string | number) => {
    if (badgeType === 'bot') {
      return (
        <span key={key} className="bot" title="بوت">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 8V4H8" />
            <rect x="4" y="8" width="16" height="12" rx="2" />
            <path d="M2 14h2M20 14h2M15 13v2M9 13v2" />
          </svg>
          BOT
        </span>
      );
    }
    const def = BADGES_CONFIG[badgeType];
    if (!def) return null;
    return (
      <span
        key={key}
        className="bg"
        style={{ background: def.c, color: def.f }}
        title={def.t}
      >
        {def.text || (
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" dangerouslySetInnerHTML={{ __html: def.icon || '' }} />
        )}
      </span>
    );
  };

  // Render message parsed content (Emotes, Numbers, Join, Mentions, Commands, Links)
  const renderMessageContent = (content: string) => {
    const text = content.trim();
    const normalizedDigits = normalizeArabicDigits(text);

    // Join word chip
    if (text === 'دخول') {
      return (
        <span className="chip join">
          <svg className="w-3.5 h-3.5 inline-block ml-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          دخول
        </span>
      );
    }

    // Number chip (1 to 3 digits)
    if (/^\d{1,3}$/.test(normalizedDigits)) {
      return <span className="chip num">{normalizedDigits}</span>;
    }

    // Tokenizer regex matching emotes, URLs, mentions, commands
    const regex = /\[emote:(\d+):([^\]]+)\]|(https?:\/\/[^\s]+)|(@[\w\u0600-\u06FF]+)|(![\w\u0600-\u06FF]+)/g;
    const parts: React.ReactNode[] = [];
    let lastIdx = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      if (match.index > lastIdx) {
        parts.push(content.slice(lastIdx, match.index));
      }

      if (match[1]) {
        // Kick Emote
        const emoteId = match[1];
        const emoteName = match[2];
        parts.push(
          <img
            key={`em-${match.index}`}
            className="em"
            alt={emoteName}
            src={`https://files.kick.com/emotes/${emoteId}/fullsize`}
            onError={(e) => {
              const span = document.createElement('span');
              span.className = 'cmd';
              span.textContent = `:${emoteName}:`;
              e.currentTarget.replaceWith(span);
            }}
          />
        );
      } else if (match[3]) {
        // Link
        const urlStr = match[3];
        let host = 'رابط';
        try {
          host = new URL(urlStr).hostname.replace(/^www\./, '');
        } catch (e) {}
        parts.push(
          <a
            key={`lnk-${match.index}`}
            href={urlStr}
            target="_blank"
            rel="noreferrer"
            className="lnk"
          >
            <svg className="w-3 h-3 inline-block ml-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
            </svg>
            {host}
          </a>
        );
      } else if (match[4]) {
        // Mention
        parts.push(
          <span key={`mn-${match.index}`} className="mn">
            {match[4]}
          </span>
        );
      } else if (match[5]) {
        // Command
        parts.push(
          <span key={`cmd-${match.index}`} className="cmd">
            {match[5]}
          </span>
        );
      }

      lastIdx = regex.lastIndex;
    }

    if (lastIdx < content.length) {
      parts.push(content.slice(lastIdx));
    }

    return parts.length > 0 ? parts : content;
  };

  const getStatusType = () => {
    if (status.connected) return 'connected';
    if (status.error) return 'offline';
    return 'connecting';
  };

  return (
    <div
      className="icg1-chat-widget"
      data-st={getStatusType()}
      style={{ ['--fs' as any]: `${fontSize}px` }}
    >
      {/* Background Watermark */}
      <div className="wm">
        <img src="/logo-435242.png" alt="" />
      </div>

      {/* HEADER */}
      <header className="hd">
        <div className="hi">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            <path d="M8 9h8M8 13h5" />
          </svg>
        </div>
        <div className="tt">
          <b>شات قناة iCG1</b>
          <span className="st">
            <i />
            <em style={{ fontStyle: 'normal' }}>
              {status.connected ? 'القناة متصلة' : status.error ? 'غير متصل' : 'جاري الاتصال…'}
            </em>
          </span>
        </div>
        <button
          className={`rf ${isRefreshing ? 'spin' : ''}`}
          onClick={connectToChat}
          title="إعادة الاتصال"
          aria-label="إعادة الاتصال"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </button>
      </header>

      {/* FILTERS BAR */}
      <nav className="fl" aria-label="تصفية الرسائل">
        <button
          type="button"
          className={filter === 'all' ? 'on' : ''}
          onClick={() => { setFilter('all'); scrollToBottom(); }}
        >
          الكل
        </button>
        <button
          type="button"
          className={filter === 'sub' ? 'on' : ''}
          onClick={() => { setFilter('sub'); scrollToBottom(); }}
        >
          {renderBadge('subscriber', 'sub-btn')}
          المشتركين
        </button>
        <button
          type="button"
          className={filter === 'mod' ? 'on' : ''}
          onClick={() => { setFilter('mod'); scrollToBottom(); }}
        >
          {renderBadge('moderator', 'mod-btn')}
          المشرفين
        </button>
        <button
          type="button"
          className={filter === 'vip' ? 'on' : ''}
          onClick={() => { setFilter('vip'); scrollToBottom(); }}
        >
          {renderBadge('vip', 'vip-btn')}
          VIP
        </button>
        <button
          type="button"
          className={filter === 'og' ? 'on' : ''}
          onClick={() => { setFilter('og'); scrollToBottom(); }}
        >
          {renderBadge('og', 'og-btn')}
          OG
        </button>
      </nav>

      {/* MESSAGES LIST */}
      <div
        className="list"
        ref={listRef}
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
      >
        {filteredMessages.map((msg) => {
          const username = msg.user?.username || 'مجهول';
          const userColor = fixColor(msg.user?.color, username);
          const rawBadges = (msg.badges || []).map((b) => b.type);
          const isBot = /^botrix$/i.test(username) || rawBadges.includes('bot');

          const badgesList = isBot
            ? ['bot']
            : BADGE_ORDER.filter((b) => rawBadges.includes(b));

          const isBroadcaster = rawBadges.includes('broadcaster');
          const initial = [...username][0]?.toUpperCase() || '؟';

          const timeStr = msg.timestamp
            ? new Date(msg.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
            : '';

          return (
            <div
              key={msg.id}
              className={`msg ${isBroadcaster ? 'cast' : ''} ${isBot ? 'isbot' : ''}`}
              style={{ ['--uc' as any]: isBot ? '#7cc4ff' : userColor }}
            >
              {/* Avatar circle with luxury glow */}
              <div className="av">
                {msg.user?.avatar ? (
                  <img
                    src={msg.user.avatar}
                    alt=""
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : null}
                <span>{initial}</span>
              </div>

              {/* Message Body */}
              <div className="bd">
                <div className="meta">
                  {badgesList.map((b, idx) => renderBadge(b, `${b}-${idx}`))}
                  <b className="un">{username}</b>
                  {timeStr && <time>{timeStr}</time>}
                </div>
                {msg.deleted ? (
                  <div className="text-zinc-500 italic text-xs py-1">
                    تم حذف هذه الرسالة بواسطة الإدارة
                  </div>
                ) : (
                  <div className="tx">{renderMessageContent(msg.content)}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* EMPTY STATE */}
      {filteredMessages.length === 0 && (
        <div className="empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 10h.01M15 10h.01M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.500L17 19l3 3V10a8 8 0 0 0-8-8z" />
          </svg>
          <span>في انتظار أول تعليق…</span>
        </div>
      )}

      {/* FLOATING UNREAD BUTTON */}
      <button
        type="button"
        className={`newb ${unreadCount > 0 ? 'on' : ''}`}
        onClick={() => scrollToBottom(true)}
      >
        <svg className="w-4 h-4 ml-1 inline-block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12l7 7 7-7" />
        </svg>
        رسائل جديدة {unreadCount}
      </button>

      {/* FOOTER CONTROLS */}
      <footer className="ft">
        <div className="rate">
          <svg className="w-3.5 h-3.5 inline-block ml-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2L4 14h7l-1 8 10-12h-7z" />
          </svg>
          {msgRate}
          <small>رسالة/د</small>
        </div>
        <span className="sp" />

        <button
          type="button"
          className="tb"
          onClick={() => adjustFontSize(-1)}
          title="تصغير الخط"
          aria-label="تصغير الخط"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
          </svg>
        </button>

        <button
          type="button"
          className="tb"
          onClick={() => adjustFontSize(1)}
          title="تكبير الخط"
          aria-label="تكبير الخط"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>

        <button
          type="button"
          className={`tb ${isPaused ? 'on' : ''}`}
          onClick={() => {
            const next = !isPaused;
            setIsPaused(next);
            if (!next) scrollToBottom(true);
          }}
          title={isPaused ? 'استئناف التمرير التلقائي' : 'إيقاف التمرير التلقائي'}
          aria-label="إيقاف التمرير التلقائي"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 5v14M16 5v14" />
          </svg>
        </button>

        <button
          type="button"
          className="tb"
          onClick={clearChat}
          title="مسح الشات"
          aria-label="مسح الشات"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
          </svg>
        </button>
      </footer>
    </div>
  );
};
