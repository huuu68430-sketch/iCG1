import React, { useEffect, useId, useState } from 'react';
import { frameArt, isFrameId } from '../data/frames';

interface FrameArtProps {
  frameId?: string | null;
  /** رابط صورة المستخدم (Kick / profiles.avatar_url) */
  src?: string;
  /** أول حروف الاسم عند غياب الصورة */
  initial?: string;
  className?: string;
  style?: React.CSSProperties;
  onAvatarError?: () => void;
  title?: string;
}

/**
 * إطار متحرك كامل: خلفية زرقاء + صورة المستخدم داخل دائرة + زخارف الإطار فوقها.
 * الرسم نفسه مستورد من public/frames-runtime.js حتى يكون مطابقاً لمعرض الإطارات.
 */
export const FrameArt: React.FC<FrameArtProps> = ({
  frameId,
  src,
  initial,
  className = '',
  style,
  onAvatarError,
  title,
}) => {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const id = (frameId || '').trim().toLowerCase();
  const [failed, setFailed] = useState(false);

  useEffect(() => { setFailed(false); }, [src]);

  if (!isFrameId(id)) return null;
  const art = frameArt(id);
  const label = (initial || (title || '?')).trim().slice(0, 3).toUpperCase() || '?';
  const bgId = `fbg${uid}`;
  const clipId = `fclip${uid}`;

  return (
    <svg
      viewBox="0 0 200 200"
      className={`icg1-fa ${className}`}
      style={style}
      role="img"
      aria-label={title || 'إطار العضو'}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id={bgId} cx=".4" cy=".35" r=".8">
          <stop offset="0" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#1e3a8a" />
        </radialGradient>
        <clipPath id={clipId}>
          <circle cx="100" cy="100" r="52" />
        </clipPath>
        <filter id="gl" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="bl" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>

      {/* الخلفية الزرقاء + صورة المستخدم */}
      <circle cx="100" cy="100" r="52" fill={`url(#${bgId})`} stroke="#ffffff55" strokeWidth="1.5" />
      {src && !failed ? (
        <image
          href={src}
          x="48"
          y="48"
          width="104"
          height="104"
          clipPath={`url(#${clipId})`}
          preserveAspectRatio="xMidYMid slice"
          onError={() => { setFailed(true); onAvatarError?.(); }}
        />
      ) : (
        <text
          x="100"
          y="101"
          fontSize="30"
          fontWeight="900"
          textAnchor="middle"
          dominantBaseline="central"
          fill="#fff"
          fontFamily="Cairo, Tajawal, sans-serif"
        >
          {label}
        </text>
      )}

      {/* زخارف الإطار من المعرض */}
      <g dangerouslySetInnerHTML={{ __html: art }} />
    </svg>
  );
};
