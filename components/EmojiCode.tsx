import React, { useEffect, useMemo, useRef, useState } from 'react';
import { chatService } from '../services/chatService';
import { awardPoints, awardPointsToMany } from '../services/points';
import { readCnRoomCode } from '../utils/gameLink';
import { readMember, resolveMemberFrame } from '../services/memberIdentity';
import { GlobalPasswordPage } from './GlobalPasswordPage';

interface EmojiCodeProps {
  onHome?: () => void;
  isOBS?: boolean;
}

export const EmojiCode: React.FC<EmojiCodeProps> = ({ onHome, isOBS }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const creditedMatches = useRef<Set<string>>(new Set());

  /* رابط /cn=CODE = هاتف لاعب أو ليدر: نفس اللعبة بدون واجهة الهوست */
  const cnRoom = useMemo(() => (isOBS ? '' : readCnRoomCode()), [isOBS]);
  const joinMode = !!cnRoom;
  const [tick, setTick] = useState(0);
  const member = useMemo(() => readMember(), [tick]);
  const [frame, setFrame] = useState({ frameId: '', frameUrl: '' });
  const [liveAvatar, setLiveAvatar] = useState('');

  const me = useMemo(() => (member ? {
    handle: member.handle,
    name: member.name,
    avatar: liveAvatar || member.avatar,
    frameId: frame.frameId,
    frameUrl: frame.frameUrl,
  } : null), [member, frame, liveAvatar]);

  const src = joinMode ? `/codenames.html?r=${encodeURIComponent(cnRoom)}` : '/codenames.html';

  useEffect(() => {
    if (!joinMode) return;
    if (member) {
      let alive = true;
      resolveMemberFrame(member.handle).then(f => { if (alive) setFrame(f); });
      const pull = () => chatService.fetchKickAvatar(member.handle)
        .then(u => { if (alive && u) setLiveAvatar(u); })
        .catch(() => {});
      pull();
      const id = setInterval(pull, 60000);
      return () => { clearInterval(id); alive = false; };
    }
    const id = setInterval(() => { if (readMember()) setTick(t => t + 1); }, 2000);
    return () => clearInterval(id);
  }, [joinMode, member]);

  /* الهوية تُرسل حتى تصل — لكن التكرار كل ثانيتين كان يُعيد رسم شاشة الليدر ويغلق الكيبورد
     أثناء الكتابة. اللعبة الآن ترد بإيصال (icg:cn:acked) فنَتوقّف عن الإعادة حتى تتغيّر الهوية. */
  const ackRef = useRef('');
  useEffect(() => {
    if (!joinMode || !me) return;
    const sig = `${src}|${me.handle}`;
    const send = () => {
      const win = iframeRef.current?.contentWindow;
      if (!win) return;
      win.postMessage({ source: 'icg-shell', type: 'icg:cn:me', me }, window.location.origin);
    };
    if (ackRef.current !== sig) send();
    const id = setInterval(() => { if (ackRef.current !== sig) send(); }, 2000);
    const onAck = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data;
      if (d && d.source === 'icg-cn' && d.type === 'icg:cn:acked') ackRef.current = sig;
    };
    window.addEventListener('message', onAck);
    return () => { clearInterval(id); window.removeEventListener('message', onAck); };
  }, [joinMode, me, src]);

  /* خروج جوال اللاعب (/cn=CODE) وزر خروج الهوست — كلاهما يرجع للرئيسية دون لمس حالة الغرفة */
  useEffect(() => {
    if (!onHome) return;
    const handler = (e: MessageEvent) => {
      if (e.data && e.data.type === 'codenames-exit') {
        onHome();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onHome]);

  // الرابح يُحسب داخل إطار codenames — يرسل لنا قائمة الفريق الفائز هنا لنرصّدها.
  // في وضع الانضمام الرابح يُرصَّد من شاشة الهوست، فلا نحسبه مرتين.
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const d = e.data;
      if (!d || d.type !== 'codenames-win' || isOBS || joinMode) return;
      const token = String(d.token || '');
      if (!token || creditedMatches.current.has(token)) return;
      creditedMatches.current.add(token);
      const winners = Array.isArray(d.winners) ? d.winners : [];
      if (!winners.length) return;
      awardPointsToMany('EMOJI_CODE', winners, 'round');
      awardPoints('EMOJI_CODE', d.mvp || winners[0].username, winners[0].avatar || '', 'match');
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [isOBS, joinMode]);

  // Bridge real Kick chat (ICG1) into the game iframe.
  // IMPORTANT: forward every message instantly. Avatar lookups used to be
  // awaited here, which delayed chat parsing (join words, card numbers) by up
  // to several seconds per message. Now avatars are resolved in the background
  // and patched into the game afterwards.
  useEffect(() => {
    if (joinMode) return;
    chatService.connect('icg1');

    // Kick avatar URLs are signed S3 links that expire (~20 min), so never
    // cache them forever: refresh them well before they go stale.
    const AVATAR_TTL = 8 * 60 * 1000;
    const avatarCache: Record<string, string> = {};
    const avatarAt: Record<string, number> = {};
    const names: Record<string, string> = {};
    const pendingAvatars = new Set<string>();
    const refreshTimers: Record<string, any> = {};
    const queue: any[] = [];

    const iframeReady = () => {
      const iframe = iframeRef.current;
      return !!(iframe && iframe.contentWindow);
    };
    const post = (payload: any) => {
      if (!iframeReady()) {
        // Keep the latest lines so a slow iframe never loses joins/votes.
        queue.push(payload);
        if (queue.length > 40) queue.shift();
        return;
      }
      iframeRef.current!.contentWindow!.postMessage(payload, '*');
    };

    const flush = () => {
      if (!iframeReady()) return;
      while (queue.length) {
        const payload = queue.shift();
        iframeRef.current!.contentWindow!.postMessage(payload, '*');
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
    };

    function scheduleRefresh(uname: string) {
      clearTimeout(refreshTimers[uname]);
      // Stagger per-player refresh so a huge lobby never fires all at once.
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

      // Send the chat line immediately — never wait for network avatar calls.
      post({
        type: 'chat',
        user: msg.user.username,
        text: msg.content,
        avatar,
        color: msg.user.color
      });

      // Resolve missing/stale avatars in the background and patch them later.
      if (!avatar || Date.now() - (avatarAt[uname] || 0) >= AVATAR_TTL) {
        resolveAvatar(msg.user.username, !avatar);
      }
    });

    // Flush anything queued while the iframe was still loading.
    (iframeRef.current as any)?.addEventListener('load', flush);

    return () => {
      unsub();
      Object.values(refreshTimers).forEach((t) => clearTimeout(t));
      (iframeRef.current as any)?.removeEventListener('load', flush);
    };
  }, [joinMode]);

  if (joinMode) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#03081a', direction: 'rtl' }}>
        <iframe
          key={src}
          ref={iframeRef}
          src={src}
          title="كود نيمز"
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
          allow="clipboard-write"
        />
        {!me && (
          <div style={{ position: 'absolute', inset: 0, overflow: 'auto', background: '#07060b' }}>
            <GlobalPasswordPage
              onSuccess={() => setTick(t => t + 1)}
              title="دخول الأعضاء"
              subtitle="KICK ACCOUNT REQUIRED"
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '100vh', position: 'relative', background: '#050f2b' }}>
      <iframe
        ref={iframeRef}
        src={src}
        title="كود نيمز"
        style={{ width: '100%', height: '100%', minHeight: '100vh', border: 'none', display: 'block' }}
        allow="fullscreen; clipboard-read; clipboard-write"
      />
    </div>
  );
};

export default EmojiCode;
