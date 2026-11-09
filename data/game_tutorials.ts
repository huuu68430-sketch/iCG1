import type { GameTutorial } from '../components/tutorial/types';
import { mafia } from './tutorials/mafia';
import { codenames } from './tutorials/codenames';
import { cupShuffle } from './tutorials/cupShuffle';
import { musicalChairs } from './tutorials/musicalChairs';
import { roulette } from './tutorials/roulette';
import { flagQuiz } from './tutorials/flagQuiz';
import { higherLower } from './tutorials/higherLower';
import { blurGuess } from './tutorials/blurGuess';
import { drawingChallenge } from './tutorials/drawingChallenge';
import { glassBridge } from './tutorials/glassBridge';
import { letterGame } from './tutorials/letterGame';
import { timeBomb } from './tutorials/timeBomb';
import { mapGuesser } from './tutorials/mapGuesser';
import { typingRace } from './tutorials/typingRace';
import { safeCode } from './tutorials/safeCode';
import { truthOrLie } from './tutorials/truthOrLie';

const ALL: GameTutorial[] = [
  mafia,
  codenames,
  cupShuffle,
  musicalChairs,
  roulette,
  flagQuiz,
  higherLower,
  blurGuess,
  drawingChallenge,
  glassBridge,
  letterGame,
  timeBomb,
  mapGuesser,
  typingRace,
  safeCode,
  truthOrLie,
];

export const GAME_TUTORIALS: Record<string, GameTutorial> = Object.fromEntries(
  ALL.map((t) => [t.viewId.toUpperCase(), t])
);

export const getTutorial = (viewId?: string): GameTutorial | undefined =>
  viewId ? GAME_TUTORIALS[viewId.toUpperCase()] : undefined;

export const hasTutorial = (viewId?: string): boolean => !!getTutorial(viewId);
