import React, { useState, useEffect, useRef } from 'react';
import { Language } from '../types';
import './liveTheater.css';

interface LiveTheaterProps {
  lang: Language;
  isLive: boolean;
  viewers: number;
  title: string;
  category: string;
  startedAt?: string;
  tags?: string[];
  channelSlug?: string;
  displayName?: string;
  giveaways?: boolean;
}

export const LiveTheater: React.FC<LiveTheaterProps> = ({
  lang,
  isLive,
  viewers,
  title,
  category,
  startedAt,
  tags = [],
  channelSlug = 'icg1',
  displayName = 'iCG1',
  giveaways = true,
}) => {
  const kickUrl = `https://kick.com/${channelSlug}`;
  const popoutChatUrl = `https://kick.com/popout/${channelSlug}/chat`;
  const playerUrl = `https://player.kick.com/${encodeURIComponent(channelSlug)}?autoplay=true&muted=true`;

  const [chatState, setChatState] = useState<'wait' | 'ok' | 'err'>('wait');
  const [chatKey, setChatKey] = useState(0);
  const [toastMsg, setToastMsg] = useState('');
  const [uptime, setUptime] = useState('00:00:00');
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const displayTitle = title || (lang === 'en' ? 'Live Stream' : 'بثنا اليوم ايش ؟');
  const displayCategory = category || 'Rocket League';

  // --- Uptime timer ---
  useEffect(() => {
    if (!isLive) {
      setUptime('00:00:00');
      return;
    }

    const startTs = startedAt ? Date.parse(startedAt) : Date.now() - 3600000;
    const update = () => {
      const sec = Math.max(0, Math.floor((Date.now() - startTs) / 1000));
      const h = String(Math.floor(sec / 3600)).padStart(2, '0');
      const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
      const s = String(sec % 60).padStart(2, '0');
      setUptime(`${h}:${m}:${s}`);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [isLive, startedAt]);

  // --- Chat load handler ---
  useEffect(() => {
    setChatState('wait');
    const timer = setTimeout(() => {
      setChatState((prev) => (prev === 'wait' ? 'err' : prev));
    }, 18000);

    return () => clearTimeout(timer);
  }, [chatKey]);

  const handleChatLoad = () => {
    setChatState('ok');
  };

  const handleRetryChat = () => {
    setChatState('wait');
    setChatKey((prev) => prev + 1);
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMsg('');
    }, 2400);
  };

  const handleShare = () => {
    const url = window.location.href.split('#')[0];
    if (navigator.share) {
      navigator.share({ title: document.title, url }).catch(() => {});
    } else if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(url)
        .then(() => showToast(lang === 'en' ? 'Link copied!' : 'تم نسخ الرابط بنجاح'))
        .catch(() => showToast(lang === 'en' ? 'Could not copy link' : 'تعذّر النسخ'));
    } else {
      showToast(lang === 'en' ? 'Could not copy link' : 'تعذّر النسخ');
    }
  };

  const chatStatusText =
    chatState === 'ok'
      ? lang === 'en' ? 'Connected' : 'متصل'
      : chatState === 'err'
      ? lang === 'en' ? 'Connection issue' : 'مشكلة اتصال'
      : lang === 'en' ? 'Connecting…' : 'جاري الاتصال…';

  return (
    <div className="lt-wrap">
      {/* --- Section Header (Matching Site Style) --- */}
      <div className="flex items-end gap-3 md:gap-4 mb-6 md:mb-9">
        <span className="font-gaming text-3xl sm:text-4xl md:text-6xl leading-none text-stroke-red select-none shrink-0" dir="ltr">
          02
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xl sm:text-2xl md:text-4xl font-black tracking-tight text-white">
              {lang === 'en' ? 'Live Theater' : 'مسرح البث المباشر'}
            </h2>
            <span className="hidden sm:inline text-[10px] font-bold tracking-[0.3em] text-white/30 uppercase" dir="ltr">
              LIVE THEATER
            </span>
          </div>
          <p className="text-[13px] md:text-sm text-white/50 mt-1 font-medium">
            {isLive && viewers > 0
              ? `${viewers.toLocaleString('en-US')} ${lang === 'en' ? 'viewers' : 'مشاهد'}`
              : lang === 'en'
              ? `${displayName} channel on Kick`
              : `قناة ${displayName} على Kick`}
          </p>
          <div className="mt-2.5 md:mt-3 h-px w-full bg-gradient-to-l from-[#FF2D2D]/60 via-white/10 to-transparent" />
        </div>
      </div>

      {/* --- Main Stage --- */}
      <section className="lt-stage" aria-label={lang === 'en' ? 'Live Theater' : 'مسرح البث المباشر'}>
        {/* Top Status Bar */}
        <div className="lt-bar">
          <div className="lt-grp">
            <span className={`lt-badge ${isLive ? 'on' : 'off'}`}>
              <b />
              <span>{isLive ? 'LIVE' : 'OFFLINE'}</span>
            </span>

            {isLive && viewers > 0 && (
              <span className="lt-pill">
                <svg className="lt-i" viewBox="0 0 24 24">
                  <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <span>{viewers.toLocaleString('en-US')}</span>
              </span>
            )}

            {isLive && (
              <span className="lt-pill">
                <svg className="lt-i" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
                <span className="lt-tm">{uptime}</span>
              </span>
            )}

            <span className="lt-cat">{displayCategory}</span>
          </div>

          <a className="lt-btn lt-ghost" href={kickUrl} target="_blank" rel="noopener noreferrer">
            Kick
            <svg className="lt-i" viewBox="0 0 24 24">
              <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
            </svg>
          </a>
        </div>

        {/* 2-Column Grid: Video Player + Chat Aside */}
        <div className="lt-grid">
          {/* Left: Video & Meta */}
          <div>
            <div className="lt-vid">
              <iframe
                src={playerUrl}
                title={lang === 'en' ? 'Kick Live Stream' : 'بث Kick المباشر'}
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
              />
            </div>

            <div className="lt-meta">
              <div>
                <h3>{displayTitle}</h3>
                <p>
                  <b>{displayCategory}</b> · <span>{displayName}</span>
                </p>
              </div>
              <div className="lt-acts">
                <button
                  className="lt-btn lt-sq"
                  type="button"
                  onClick={handleShare}
                  aria-label={lang === 'en' ? 'Share' : 'مشاركة'}
                >
                  <svg className="lt-i" viewBox="0 0 24 24">
                    <circle cx="18" cy="5" r="3" />
                    <circle cx="6" cy="12" r="3" />
                    <circle cx="18" cy="19" r="3" />
                    <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
                  </svg>
                </button>
                <a className="lt-btn lt-gold" href={kickUrl} target="_blank" rel="noopener noreferrer">
                  <svg className="lt-i" viewBox="0 0 24 24">
                    <path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none" />
                  </svg>
                  {lang === 'en' ? 'Watch on Kick' : 'شاهد البث'}
                </a>
              </div>
            </div>

            {/* Tags row */}
            <div className="lt-tags">
              <span className={`lt-chip gv ${!giveaways ? 'no' : ''}`}>
                {giveaways
                  ? lang === 'en' ? 'Giveaways Active' : 'الجوائز مفعلة'
                  : lang === 'en' ? 'Giveaways Off' : 'الجوائز متوقفة'}
              </span>

              {tags.length > 0 ? (
                tags.map((t, i) => (
                  <span key={i} className="lt-chip">
                    #{t}
                  </span>
                ))
              ) : (
                <>
                  <span className="lt-chip">#Gaming</span>
                  <span className="lt-chip">#{displayCategory}</span>
                </>
              )}
            </div>
          </div>

          {/* Right: Kick Chat */}
          <aside className="lt-chat" aria-label={lang === 'en' ? 'Live Chat' : 'شات البث'}>
            <div className="lt-ch">
              <div className="lt-ci">
                <svg className="lt-i" viewBox="0 0 24 24">
                  <path d="M21 12a8 8 0 0 1-11.7 7L4 20l1.1-4.6A8 8 0 1 1 21 12z" />
                </svg>
                <span className={`lt-dot ${chatState === 'ok' ? 'ok' : chatState === 'err' ? 'err' : ''}`} />
              </div>

              <div>
                <strong>{lang === 'en' ? 'Live Stream Chat' : 'شات البث المباشر'}</strong>
                <small>{chatStatusText}</small>
              </div>

              <button className="lt-btn lt-ghost" type="button" onClick={handleRetryChat}>
                <svg className="lt-i" viewBox="0 0 24 24">
                  <path d="M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4" />
                </svg>
                {lang === 'en' ? 'Retry' : 'إعادة المحاولة'}
              </button>
            </div>

            <div className="lt-cb">
              <iframe
                key={chatKey}
                id="kick-chat-iframe"
                title={lang === 'en' ? 'Kick Chat' : 'شات Kick'}
                src={popoutChatUrl}
                onLoad={handleChatLoad}
                onError={() => setChatState('err')}
                loading="eager"
              />

              {chatState === 'err' && (
                <div className="lt-ov">
                  <svg className="lt-i" style={{ width: 34, height: 34, color: '#d6b384' }} viewBox="0 0 24 24">
                    <path d="M21 12a8 8 0 0 1-11.7 7L4 20l1.1-4.6A8 8 0 1 1 21 12z" />
                  </svg>
                  <span>
                    {lang === 'en' ? (
                      <>
                        Could not load chat inside iframe.
                        <br />
                        Retry or open directly on Kick.
                      </>
                    ) : (
                      <>
                        تعذّر تحميل الشات هنا.
                        <br />
                        جرّب مرة ثانية أو افتحه مباشرة على Kick.
                      </>
                    )}
                  </span>
                  <div className="lt-grp" style={{ justifyContent: 'center' }}>
                    <button className="lt-btn lt-ghost" type="button" onClick={handleRetryChat}>
                      {lang === 'en' ? 'Retry' : 'إعادة المحاولة'}
                    </button>
                    <a className="lt-btn lt-ghost" href={popoutChatUrl} target="_blank" rel="noopener noreferrer">
                      {lang === 'en' ? 'Open Chat' : 'افتح الشات'}
                    </a>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </section>

      {/* Toast Notification */}
      <div className={`lt-toast ${toastMsg ? 's' : ''}`}>{toastMsg}</div>
    </div>
  );
};

export default LiveTheater;
