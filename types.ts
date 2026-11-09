
export interface ChatUser {
  id: string;
  username: string;
  color?: string;
  avatar?: string;
  isBot?: boolean;
  role?: 'owner' | 'moderator' | 'vip' | 'subscriber' | 'founder' | 'gifter' | 'user';
  badges?: ChatBadge[];
}

export interface ChatBadge {
  type: string;
  text?: string;
}

export interface ChatMessage {
  id: string;
  user: ChatUser;
  content: string;
  role: 'owner' | 'moderator' | 'vip' | 'subscriber' | 'founder' | 'gifter' | 'user';
  badges?: ChatBadge[];
  timestamp: number;
  deleted?: boolean;
}

export type Language = 'ar' | 'en';

export type ViewState =
  | 'HOME'
  | 'HOST_LOGIN'
  | 'USER_DASHBOARD'
  | 'FAWAZIR_SELECT'
  | 'FAWAZIR_GAME'
  | 'MUSICAL_CHAIRS'
  | 'MASAQIL_WAR'
  | 'LEADERBOARD'
  | 'BLUR_GUESS'
  | 'SPIN_WHEEL'
  | 'RAFFLE'
  | 'FLAG_QUIZ'
  | 'TEAM_BATTLE'
  | 'TYPING_RACE'
  | 'GRID_HUNT'
  | 'CUP_SHUFFLE'
  | 'TERRITORY_WAR'
  | 'TRUTH_OR_LIE'
  | 'DRAWING_CHALLENGE'
  | 'FRUIT_WAR'
  | 'LOGO_ROUND'
  | 'FORBIDDEN_WORDS'
  | 'VOTING_GAME'
  | 'BOSS_RAID'
  | 'RUSSIAN_ROULETTE'
  | 'ZOMBIE_ESCAPE'
  | 'GLASS_BRIDGE'
  | 'SECRET_AUCTION'
  | 'WORD_BOMB'
  | 'TIME_BOMB'
  | 'WORD_BUILDER'
  | 'GLASS_BRIDGE_V2'
  | 'FLOOR_IS_LAVA'
  | 'EMOJI_CODE'
  | 'LETTER_GAME'
  | 'HIGHER_LOWER'
  | 'MAHMAH_GAME'
  | 'BUZZER_PAD'
  | 'ABOUT'
  | 'USER_AUTH'
  | 'SAFE_CODE'
  | 'MAP_GUESSER'
  | 'HARDEES_MEMORY';

// Added GameType to fix import error in TournamentManager.tsx
export type GameType = 'TRIVIA' | 'BLUR' | 'FLAGS' | 'TYPING' | 'CUPS' | 'GRID' | 'WHEEL' | 'PAINT' | 'BATTLE' | 'BOMB' | 'VOTE' | 'DRAW' | 'FRUIT' | 'LOGO' | 'FORBIDDEN' | 'BOSS' | 'ROULETTE' | 'ZOMBIE' | 'BRIDGE' | 'AUCTION' | 'LETTER' | 'HIGHER_LOWER' | 'SAFE_CODE' | 'MAP_GUESSER' | 'HARDEES_MEMORY';

export interface LetterQuestion {
  id: number;
  letter: string;
  question: string;
  answer: string;
  level?: number; // Optional: if set, this question is exclusive to that level
}

export interface HexCellData {
  id: number;
  row: number;
  col: number;
  letter: string;
  owner: 'none' | 'team1' | 'team2';
  isConnecting?: boolean;
}

export interface Question {
  id: number;
  day?: number;
  category: string;
  text: string;
  options: string[];
  correctIndex: number;
}

export interface Category {
  id: string;
  label: string;
  icon: string;
  image: string | string[];
}

export interface Song {
  id: string;
  title: string;
  url: string;
  category?: 'regular' | 'ramadan';
}

export interface Game {
  id: string;
  title: string;
  icon_name: string;
  view_id: ViewState;
  is_primary: boolean;
  is_visible: boolean;
  has_obs: boolean;
  is_coming_soon: boolean;
  coming_soon_text: string;
  position: number;
}
export interface GameSettings {
  winMode: 'SPEED' | 'POINTS';
  roundsCount: number;
  timerDuration: number;
  gameOverOnMiss: boolean;
  backgroundId: string;
  soundEnabled: boolean;
  autoNext: boolean;
  winnerDuration: number;
}
