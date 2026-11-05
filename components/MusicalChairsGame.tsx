import React, { useEffect, useRef } from 'react';
import { chatService } from '../services/chatService';
import { awardPoints, awardPointsToMany } from '../services/points';

interface MusicalChairsGameProps {
  onHome?: () => void;
  isOBS?: boolean;
}

/**
 * الكراسي الموسيقية — نسخة «الكراسي الموسيقية .html» كاملة.
 * اللعبة تعمل داخل iframe (public/musical-chairs.html) وهذا الغلاف يربطها
 * بشات ICG1 الحقيقي: كل رسالة تُمرَّر فوراً مع الصورة، والإطارات المشتراة
 * يحلّها الإطار نفسه عبر Supabase، والنقاط تُرصَّد هنا عند الفوز.
 */
export const MusicalChairsGame: React.FC<MusicalChairsGameProps> = ({ onHome, isOBS }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const creditedTokens = useRef<Set<string>>(new Set());
  const onHomeRef = useRef(onHome);
  onHomeRef.current = onHome;
  const isOBSRef = useRef(isOBS);
  isOBSRef.current = isOBS;

  // رسائل الخروج والفوز من إطار اللعبة
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const d = e.data;
      if (!d || typeof d.type !== 'string') return;
      if (d.type === 'chairs-exit') {
        onHomeRef.current?.();
        return;
      }
      if (isOBSRef.current) return;
      if (d.type === 'chairs-round') {
        const token = String(d.token || '');
        if (!token || creditedTokens.current.has(token)) return;
        creditedTokens.current.add(token);
        const survivors = Array.isArray(d.players) ? d.players : [];
        if (survivors.length) {
          awardPointsToMany('MUSICAL_CHAIRS',
            survivors.map((p: any) => ({ username: String(p.user || ''), avatar: String(p.avatar || '') })),
            'round');
        }
      } else if (d.type === 'chairs-win') {
        const token = String(d.token || '');
        if (!token || creditedTokens.current.has(token)) return;
        creditedTokens.current.add(token);
        awardPoints('MUSICAL_CHAIRS', String(d.user || ''), String(d.avatar || ''), 'match');
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // جسر شات ICG1 الحقيقي إلى اللعبة (نفس نمط كود نيمز: تمرير فوري، الصور بالخلفية)
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

    iframeRef.current?.addEventListener('load', flush);

    return () => {
      unsub();
      Object.values(refreshTimers).forEach((t) => clearTimeout(t));
      iframeRef.current?.removeEventListener('load', flush);
    };
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '100vh', position: 'relative', background: '#080604' }}>
      <iframe
        ref={iframeRef}
        src="/musical-chairs.html"
        title="الكراسي الموسيقية"
        style={{ width: '100%', height: '100%', minHeight: '100vh', border: 'none', display: 'block' }}
        allow="fullscreen; clipboard-read; clipboard-write; autoplay"
      />
    </div>
  );
};

export default MusicalChairsGame;
