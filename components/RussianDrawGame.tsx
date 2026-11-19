import React, { useEffect, useRef } from 'react';
import { chatService } from '../services/chatService';
import { awardPoints, awardPointsToMany } from '../services/points';

interface RussianDrawGameProps {
  onHome?: () => void;
  isOBS?: boolean;
}

/**
 * السحب الروسي — نسخة «iCG1 _ السحب الروسي.html» كاملة.
 * اللعبة تعمل داخل iframe وهذا الغلاف يربطها بشات iCG1 الحقيقي:
 * كل رسالة تُمرَّر فوراً مع الصورة، والإطارات المشتراة يحلّها الإطار
 * نفسه عبر Supabase، والنقاط تُرصَّد هنا عند الإقصاء والفوز.
 */
export const RussianDrawGame: React.FC<RussianDrawGameProps> = ({ onHome, isOBS }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const creditedTokens = useRef<Set<string>>(new Set());
  const onHomeRef = useRef(onHome);
  onHomeRef.current = onHome;
  const isOBSRef = useRef(isOBS);
  isOBSRef.current = isOBS;

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const d = e.data;
      if (!d || typeof d.type !== 'string') return;
      if (d.type === 'rr-exit') {
        onHomeRef.current?.();
        return;
      }
      if (isOBSRef.current) return;
      if (d.type === 'rr-round') {
        const token = String(d.token || '');
        if (!token || creditedTokens.current.has(token)) return;
        creditedTokens.current.add(token);
        const survivors = Array.isArray(d.players) ? d.players : [];
        if (survivors.length) {
          awardPointsToMany('RUSSIAN_ROULETTE',
            survivors.map((p: any) => ({ username: String(p.user || ''), avatar: String(p.avatar || '') })),
            'round');
        }
      } else if (d.type === 'rr-win') {
        const token = String(d.token || '');
        if (!token || creditedTokens.current.has(token)) return;
        creditedTokens.current.add(token);
        awardPoints('RUSSIAN_ROULETTE', String(d.user || ''), String(d.avatar || ''), 'match');
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // جسر شات iCG1 الحقيقي إلى اللعبة (نفس نمط الكراسي الموسيقية)
  useEffect(() => {
    chatService.connect('icg1');

    // روابط صور كيك موقّتة (~20 دقيقة) — تُحدَّث قبل انتهائها.
    const AVATAR_TTL = 8 * 60 * 1000;
    const avatarCache: Record<string, string> = {};
    const avatarAt: Record<string, number> = {};
    const names: Record<string, string> = {};
    const pendingAvatars = new Set<string>();
    const refreshTimers: Record<string, any> = {};
    const queue: any[] = [];

    const iframeReady = () => !!(iframeRef.current && iframeRef.current.contentWindow);
    const post = (payload: any) => {
      if (!iframeReady()) {
        queue.push(payload);
        if (queue.length > 60) queue.shift();
        return;
      }
      iframeRef.current!.contentWindow!.postMessage(payload, '*');
    };
    const flush = () => {
      while (queue.length && iframeReady()) {
        iframeRef.current!.contentWindow!.postMessage(queue.shift(), '*');
      }
    };

    function resolveAvatar(username: string, force = false) {
      const uname = username.toLowerCase();
      if (pendingAvatars.has(uname)) return;
      const fresh = avatarCache[uname] && Date.now() - (avatarAt[uname] || 0) < AVATAR_TTL;
      if (fresh && !force) return;
      pendingAvatars.add(uname);
      names[uname] = username;
      chatService
        .fetchKickAvatar(username)
        .then((found) => {
          if (!found) return;
          scheduleRefresh(uname);
          if (avatarCache[uname] === found) {
            avatarAt[uname] = Date.now();
            return;
          }
          avatarCache[uname] = found;
          avatarAt[uname] = Date.now();
          post({ type: 'avatar', user: names[uname] || username, avatar: found });
        })
        .catch(() => {})
        .finally(() => pendingAvatars.delete(uname));
    }

    function scheduleRefresh(uname: string) {
      clearTimeout(refreshTimers[uname]);
      refreshTimers[uname] = setTimeout(() => {
        if (names[uname]) resolveAvatar(names[uname], true);
      }, AVATAR_TTL + Math.floor(Math.random() * 60000));
    }

    const unsub = chatService.onMessage((msg) => {
      const uname = msg.user.username.toLowerCase();
      const cached = avatarCache[uname] || '';
      const avatar = msg.user.avatar || cached;

      if (msg.user.avatar && msg.user.avatar !== avatarCache[uname]) {
        avatarCache[uname] = msg.user.avatar;
        avatarAt[uname] = Date.now();
      }
      names[uname] = msg.user.username;

      post({
        type: 'chat',
        user: msg.user.username,
        text: msg.content,
        avatar,
        color: msg.user.color
      });

      if (!avatar || Date.now() - (avatarAt[uname] || 0) >= AVATAR_TTL) {
        resolveAvatar(msg.user.username, !avatar);
      }
    });

    const unsubStatus = chatService.onStatusChange((connected) => {
      post({ type: 'chat-status', connected });
    });
    post({ type: 'chat-status', connected: chatService.isLive() });

    iframeRef.current?.addEventListener('load', flush);

    return () => {
      unsub();
      unsubStatus();
      Object.values(refreshTimers).forEach((t) => clearTimeout(t));
      iframeRef.current?.removeEventListener('load', flush);
    };
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '100vh', position: 'relative', background: '#060403' }}>
      <iframe
        ref={iframeRef}
        src="/iCG1 _ السحب الروسي.html"
        title="السحب الروسي"
        style={{ width: '100%', height: '100%', minHeight: '100vh', border: 'none', display: 'block' }}
        allow="fullscreen; clipboard-read; clipboard-write; autoplay"
      />
    </div>
  );
};

export default RussianDrawGame;