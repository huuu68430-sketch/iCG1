import React from 'react';
import { HelpOrb } from './HelpOrb';
import { GameTutorialModal } from './GameTutorialModal';
import { GAME_DETAILS } from '../home435242Icons';

interface Props {
  /** اللعبة المفتوحة الآن — يظهر فوقها زر «!» العائم */
  viewId: string;
  /** الشرح المعروض حالياً */
  openId: string | null;
  onOpen: (viewId: string) => void;
  onClose: () => void;
  onPlay: (viewId: string) => void;
}

/** زر «!» العائم داخل اللعبة + نافذة الشرح */
export const TutorialLayer: React.FC<Props> = ({ viewId, openId, onOpen, onClose, onPlay }) => (
  <>
    {!openId && <HelpOrb viewId={viewId} floating label={GAME_DETAILS[viewId]?.title} onOpen={onOpen} />}
    {openId && (
      <GameTutorialModal
        viewId={openId}
        onClose={onClose}
        onPlay={(v) => { onClose(); onPlay(v); }}
      />
    )}
  </>
);
