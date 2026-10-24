
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { chatService } from '../services/chatService';
import { Language, ChatMessage } from '../types';
import { MessageSquare, RefreshCw, AlertCircle, Ban, Clock, Ghost, Crown, Shield, Star, Gift, Gem, Heart } from 'lucide-react';

interface ChatWidgetProps {
  lang: Language;
}

const BADGE_DEFS: Record<string, { icon: any; cls: string; title: string }> = {
  broadcaster: {
    icon: Crown,
    cls: 'bg-gradient-to-br from-amber-300 to-orange-600 text-white border-yellow-200/70 shadow-[0_0_8px_rgba(251,191,36,0.9)]',
    title: 'مالك القناة',
  },
  moderator: {
    icon: Shield,
    cls: 'bg-gradient-to-br from-emerald-300 to-green-700 text-white border-emerald-200/70 shadow-[0_0_8px_rgba(16,185,129,0.9)]',
    title: 'مشرف',
  },
  founder: {
    icon: Gem,
    cls: 'bg-gradient-to-br from-cyan-300 to-blue-700 text-white border-cyan-200/70 shadow-[0_0_8px_rgba(34,211,238,0.9)]',
    title: 'مؤسس القناة',
  },
  vip: {
    icon: Star,
    cls: 'bg-gradient-to-br from-fuchsia-400 to-purple-700 text-white border-fuchsia-200/70 shadow-[0_0_8px_rgba(217,70,239,0.9)]',
    title: 'VIP',
  },
  sub_gifter: {
    icon: Gift,
    cls: 'bg-gradient-to-br from-orange-300 to-rose-600 text-white border-orange-200/70 shadow-[0_0_8px_rgba(249,115,22,0.9)]',
    title: 'مهدي اشتراكات',
  },
};

const parseSubMonths = (text?: string): number => {
  if (!text) return 0;
  const m = text.match(/\((\d+)\s*months?\)/i) || text.match(/(\d+)\s*months?/i);
  return m ? parseInt(m[1], 10) : 0;
};

const SubBadge = ({ text }: { text?: string }) => {
  const months = parseSubMonths(text);
  return (
    <div
      title={months > 0 ? `مشترك (${months} شهر)` : 'مشترك'}
      className="h-4 px-1 rounded-[5px] bg-gradient-to-br from-rose-400 to-red-700 text-white border border-rose-200/70 shadow-[0_0_8px_rgba(244,63,94,0.9)] flex items-center gap-0.5 shrink-0"
    >
      <Heart size={8} fill="currentColor" />
      {months > 0 && <span className="text-[7px] font-black leading-none">{months}ش</span>}
    </div>
  );
};

const RoleBadge = ({ type }: { type: string }) => {
  const def = BADGE_DEFS[type];
  if (!def) return null;
  const Icon = def.icon;
  return (
    <div
      title={def.title}
      className={`w-4 h-4 rounded-[5px] flex items-center justify-center border shrink-0 ${def.cls}`}
    >
      <Icon size={9} strokeWidth={2.5} fill="currentColor" />
    </div>
  );
};

const AVATAR_GRADIENTS = [
  'from-red-500 to-rose-700',
  'from-blue-500 to-indigo-700',
  'from-emerald-500 to-teal-700',
  'from-amber-500 to-orange-700',
  'from-fuchsia-500 to-purple-700',
  'from-cyan-500 to-sky-700',
];

const hashString = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};

const Avatar = ({ user }: { user: ChatMessage['user'] }) => {
  const [broken, setBroken] = useState(false);
  const grad = AVATAR_GRADIENTS[hashString(user.username) % AVATAR_GRADIENTS.length];

  if (user.avatar && !broken) {
    return (
      <img
        src={user.avatar}
        alt=""
        onError={() => setBroken(true)}
        className="w-6 h-6 rounded-full object-cover border border-white/15 shrink-0"
        loading="lazy"
      />
    );
  }
  return (
    <div
      className={`w-6 h-6 rounded-full bg-gradient-to-br ${grad} border border-white/15 flex items-center justify-center text-[9px] font-black text-white shrink-0 shadow-[0_0_6px_rgba(255,255,255,0.15)]`}
    >
      {user.username.charAt(0).toUpperCase()}
    </div>
  );
};

export const ChatWidget: React.FC<ChatWidgetProps> = ({ lang }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState({ connected: false, error: false, details: '' });
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const connect = () => {
    chatService.connect('icg1');
  };

  useEffect(() => {
    connect();

    const unbindMsg = chatService.onMessage((msg) => {
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        // Limit to 100 messages, then keep last 20
        if (prev.length >= 100) {
          return [...prev.slice(-20), msg];
        }
        return [...prev, msg];
      });
    });

    const unbindDelete = chatService.onDeleteMessage((msgId) => {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, deleted: true } : m));
    });

    const unbindStatus = chatService.onStatusChange((connected, error, details) => {
      setStatus({ connected, error, details: details || '' });
    });

    return () => {
      unbindMsg();
      unbindDelete();
      unbindStatus();
    };
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: messages.length > 50 ? 'auto' : 'smooth' // performance optimization
      });
    }
  }, [messages]);

  const renderBadges = useMemo(() => (msg: ChatMessage) => {
    const badges = msg.badges || [];
    const seen = new Set<string>();
    const nodes: React.ReactNode[] = [];

    const types = badges.map(b => b.type);
    // Ensure priority order for the main role badge
    const priority = ['broadcaster', 'moderator', 'founder', 'vip', 'sub_gifter', 'subscriber'];
    const ordered = [...priority.filter(t => types.includes(t)), ...types.filter(t => !priority.includes(t))];

    for (const type of ordered) {
      if (seen.has(type)) continue;
      seen.add(type);
      const badge = badges.find(b => b.type === type);
      if (type === 'subscriber') {
        nodes.push(<SubBadge key={`sub-${nodes.length}`} text={badge?.text} />);
      } else {
        nodes.push(<RoleBadge key={`${type}-${nodes.length}`} type={type} />);
      }
    }
    return nodes;
  }, []);

  const t = {
    title: lang === 'ar' ? 'شات قناة iCG1' : 'iCG1 Live Chat',
    connecting: lang === 'ar' ? 'جاري الاتصال...' : 'Connecting...',
    connected: lang === 'ar' ? 'القناة متصلة' : 'Channel connected',
    error: lang === 'ar' ? 'انقطع الاتصال' : 'Connection Lost',
    retry: lang === 'ar' ? 'إعادة المحاولة' : 'Retry',
    deleted: lang === 'ar' ? 'تم حذف هذه الرسالة بواسطة الإدارة' : 'This message was removed by moderator',
    placeholder: lang === 'ar' ? 'بانتظار رسائل قناة iCG1...' : 'Waiting for iCG1 chat messages...'
  };

  return (
    <div className="icg1-chat flex flex-col h-full w-full bg-[#050505]/90 backdrop-blur-2xl relative border-l border-white/5">

      {/* Header */}
      <div className="icg1-chat-header h-14 shrink-0 bg-gradient-to-r from-red-600/10 to-transparent border-b border-white/5 flex items-center justify-between px-3 z-20">
        <div className="flex items-center gap-2">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-500 shadow-lg ${status.connected ? 'bg-gradient-to-br from-red-600 to-rose-800 shadow-[0_0_15px_rgba(255,0,0,0.5)]' : 'bg-zinc-800'}`}>
            <MessageSquare size={18} className="text-white" />
          </div>
          <div className="flex flex-col">
            <a href="https://kick.com/icg1" target="_blank" rel="noreferrer" className="icg1-chat-title text-white font-black text-[11px] uppercase tracking-tighter italic">{t.title}</a>
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${status.connected ? 'bg-red-500 animate-pulse shadow-[0_0_5px_red]' : 'bg-zinc-600'}`}></span>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{status.connected ? t.connected : t.connecting}</span>
            </div>
          </div>
        </div>
        <button onClick={connect} className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-all">
          <RefreshCw size={16} className={!status.connected && !status.error ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Messages Container */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-1 custom-scrollbar"
      >
        {messages.length === 0 && status.connected && (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-20">
            <Ghost size={40} className="mb-3 text-red-600" />
            <p className="text-[10px] font-black text-white uppercase tracking-[0.3em]">{t.placeholder}</p>
          </div>
        )}

        {status.error && (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 space-y-3">
            <AlertCircle size={24} className="text-red-500" />
            <p className="text-[10px] font-black text-white uppercase tracking-wider">{t.error}</p>
            <button onClick={connect} className="px-4 py-2 bg-red-600 text-[9px] font-black italic rounded-lg hover:bg-red-500 transition-all uppercase">{t.retry}</button>
          </div>
        )}

        {messages.map((msg) => (
            <div key={msg.id} className="animate-in slide-in-from-right-2 duration-300 group px-1 py-1 rounded-lg hover:bg-white/[0.03] transition-colors">
              <div className="flex items-start gap-2">
                <Avatar user={msg.user} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                    <span
                      className="font-black text-[11px] italic tracking-tight truncate drop-shadow-sm max-w-[120px]"
                      style={{ color: msg.user.color || '#ff0000' }}
                    >
                      {msg.user.username}
                    </span>
                    <div className="flex items-center gap-0.5">
                      {renderBadges(msg)}
                    </div>
                    <span className="text-[8px] text-gray-700 font-mono items-center gap-1 hidden group-hover:flex">
                      <Clock size={8} /> {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {msg.deleted ? (
                    <div className="flex items-center gap-1.5 text-zinc-600 italic bg-white/[0.02] p-1 rounded-lg border border-white/5">
                      <Ban size={10} />
                      <span className="text-[9px] font-bold">{t.deleted}</span>
                    </div>
                  ) : (
                    <div className="text-[11px] text-gray-200 font-bold leading-tight break-words whitespace-pre-wrap -tracking-tight drop-shadow-sm">
                      {parseMessageContent(msg.content)}
                    </div>
                  )}
                </div>
              </div>
            </div>
        ))}
      </div>



      {/* Bottom Glow */}
      <div className="h-8 bg-gradient-to-t from-black to-transparent shrink-0"></div>
    </div>
  );
};

const parseMessageContent = (content: string) => {
  const emoteRegex = /\[emote:(\d+):([\w\s\-]+)\]/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = emoteRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.substring(lastIndex, match.index));
    }

    const emoteId = match[1];
    const emoteName = match[2];
    parts.push(
      <img
        key={`${emoteId}-${match.index}`}
        src={`https://files.kick.com/emotes/${emoteId}/fullsize`}
        alt={emoteName}
        className="inline-block w-6 h-6 align-middle mx-0.5 hover:scale-110 transition-transform"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    );

    lastIndex = emoteRegex.lastIndex;
  }

  if (lastIndex < content.length) {
    parts.push(content.substring(lastIndex));
  }

  return parts.length > 0 ? parts : content;
};
