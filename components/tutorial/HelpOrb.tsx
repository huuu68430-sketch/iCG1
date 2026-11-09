import React from 'react';
import { hasTutorial } from '../../data/game_tutorials';
import './tutorial.css';

interface Props {
  viewId: string;
  onOpen: (viewId: string) => void;
  /** زر عائم داخل اللعبة بدل زر البطاقة */
  floating?: boolean;
  className?: string;
  label?: string;
  title?: string;
}

/** زر «!» الدائري: يفتح شرح اللعبة كفيديو قصير */
export const HelpOrb: React.FC<Props> = ({ viewId, onOpen, floating = false, className = '', label, title }) => {
  if (!hasTutorial(viewId)) return null;
  return (
    <span className={`tut-orb-wrap ${floating ? 'tut-orb-float' : ''} ${className}`.trim()}>
      <button
        type="button"
        className="tut-orb"
        aria-label={`شرح طريقة لعب ${label || 'هذه اللعبة'}`}
        title={title || 'كيف تلعب؟'}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onOpen(viewId);
        }}
      >
        <span>!</span>
      </button>
      <span className="tut-orb-tip">كيف تلعب {label || ''}</span>
    </span>
  );
};
