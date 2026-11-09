import React from 'react';
import { FrameArt } from '../FrameArt';
import { framesRuntimeReady, isFrameId } from '../../data/frames';
import type { TutPlayer } from './types';

interface Props {
  player: TutPlayer;
  /** حجم الصورة بالبكسل */
  px: number;
  /** الطبقة العلوية (رقم اللاعب/الدور) */
  badge?: string;
  badgeTone?: 'red' | 'green' | 'blue';
  name?: boolean;
  className?: string;
}

/**
 * أفاتار اللاعب التجريبي: صورة + إطار حقيقي من نفس إطارات المنصة.
 * عند غياب محرك الإطارات (معاينة معزولة) يرجع لحلقة ذهبية دوّارة.
 */
export const TutAvatar: React.FC<Props> = ({ player, px, badge, badgeTone, name = true, className = '' }) => {
  const useFrame = framesRuntimeReady() && isFrameId(player.frame);

  return (
    <div className={`pc ${className}`} style={{ width: px * 1.5 }}>
      <div className="pic" style={{ width: px, height: px }}>
        {useFrame ? (
          <FrameArt
            frameId={player.frame}
            src={player.avatar}
            initial={player.name.slice(0, 3)}
            title={player.name}
            className="w-full h-full max-w-none"
            style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,.7))' }}
          />
        ) : (
          <>
            <span className="ring" />
            <img className="face" src={player.avatar} alt="" referrerPolicy="no-referrer" />
            <span className="glint" />
          </>
        )}
      </div>
      {name && <span className="nm">{player.name}</span>}
      {player.tag && <span className={`tg ${player.tone === 'red' ? 'red' : player.tone === 'green' ? 'green' : ''}`}>{player.tag}</span>}
      {badge && <span className={`tg ${badgeTone || ''}`}>{badge}</span>}
    </div>
  );
};

/** صورة صغيرة فقط (للشات والصفوف) */
export const TutFace: React.FC<{ player: TutPlayer; px: number }> = ({ player, px }) => {
  const useFrame = framesRuntimeReady() && isFrameId(player.frame);
  return (
    <span className="pic" style={{ width: px, height: px, position: 'relative', display: 'inline-grid', placeItems: 'center' }}>
      {useFrame ? (
        <FrameArt
          frameId={player.frame}
          src={player.avatar}
          initial={player.name.slice(0, 3)}
          title={player.name}
          className="w-full h-full max-w-none"
        />
      ) : (
        <>
          <span className="ring" />
          <img
            src={player.avatar}
            alt=""
            referrerPolicy="no-referrer"
            style={{ position: 'relative', zIndex: 2, width: px * 0.76, height: px * 0.76, borderRadius: '50%', objectFit: 'cover' }}
          />
        </>
      )}
    </span>
  );
};
