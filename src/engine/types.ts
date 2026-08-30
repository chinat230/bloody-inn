/** Pure rules types for The Bloody Inn (base game). */

export type GuestType =
  | 'merchant'
  | 'artisan'
  | 'police'
  | 'religious'
  | 'noble'
  | 'peasant';

export type Affinity = 'bribe' | 'build' | 'kill' | 'bury';
export type ActionKind = Affinity | 'pass';

export type PlayerColor = 'crimson' | 'forest' | 'navy' | 'amber';

export type AnnexEffectId =
  | 'barn'
  | 'vegetableGarden'
  | 'workshop'
  | 'distillery'
  | 'gardens'
  | 'park'
  | 'butcherShop'
  | 'kiosk'
  | 'parlor'
  | 'roomService'
  | 'grocery'
  | 'shop'
  | 'brewery'
  | 'altar'
  | 'bedroom'
  | 'cellar'
  | 'chapel'
  | 'crypt'
  | 'bishopric'
  | 'chandelier'
  | 'kingSizeBed'
  | 'diningRoom'
  | 'stables'
  | 'greenhouse'
  | 'pavilion';

export interface AnnexDef {
  id: AnnexEffectId;
  name: string;
}

export interface CardDef {
  occupationId: string;
  name: string;
  type: GuestType;
  rank: 0 | 1 | 2 | 3;
  pocket: number;
  annex: AnnexDef | null;
  affinity: Affinity | null;
}

export interface Card {
  uid: string;
  occupationId: string;
}

export interface Annex {
  uid: string;
  card: Card | null;
  effectId: AnnexEffectId;
  rank: 0 | 1 | 2 | 3;
  buried: Card[];
}

export interface Room {
  number: number;
  keyColor: PlayerColor | 'white' | null;
  roomServiceOwner: number | null;
  guest: Card | null;
}

export interface PlayerState {
  id: number;
  name: string;
  color: PlayerColor;
  isHuman: boolean;
  cash: number;
  checks: number;
  hand: Card[];
  annexes: Annex[];
  unburied: Card[];
  tokens: number;
  /** Set when cash cannot cover wages; number of cards that must leave. */
  unpaid?: number;
}

export type Phase =
  | 'welcome'
  | 'night'
  | 'police'
  | 'wages'
  | 'endGrave'
  | 'gameOver';

export interface GameConfig {
  playerCount: 2 | 3 | 4;
  length: 'short' | 'long' | 'tutorial';
  aiDifficulty: 'easy' | 'normal';
  seed: number;
  tutorial: boolean;
  humanIndex?: number;
}

export interface LogEntry {
  kind: string;
  text: string;
}

export interface GameState {
  config: GameConfig;
  players: PlayerState[];
  rooms: Room[];
  entrance: Card[];
  exit: Card[];
  bistro: Card[];
  box: Card[];
  firstPlayer: number;
  currentPlayer: number;
  phase: Phase;
  nightPulse: 1 | 2;
  season: 1 | 2;
  entranceEmptiedCount: number;
  lastRound: boolean;
  pendingGuest: Card | null;
  pendingPlayers: number[];
  round: number;
  log: LogEntry[];
  rngState: number;
  winnerIds: number[];
  scores: PlayerScore[] | null;
}

export interface PlayerScore {
  playerId: number;
  cash: number;
  checks: number;
  loot: number;
  ownBuried: number;
}

export type Move =
  | { type: 'welcome'; room: number }
  | {
      type: 'bribe';
      rooms: number[];
      peasantUids: string[];
      payment: string[];
    }
  | {
      type: 'build';
      cardUid: string;
      payment: string[];
      roomServiceRoom?: number;
      monkRoom?: number;
    }
  | {
      type: 'kill';
      rooms: number[];
      peasantUid: string | null;
      payment: string[];
    }
  | {
      type: 'bury';
      corpses: { uid: string; annexUid: string }[];
      payment: string[];
    }
  | {
      type: 'pass';
      launder?: { dir: 'toChecks' | 'toCash'; n: number };
    }
  | { type: 'policePay'; cash: number; checks: number }
  | { type: 'wageDiscard'; cardUids: string[] }
  | { type: 'endGravePay'; cash: number; checks: number };

export class IllegalMoveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IllegalMoveError';
  }
}

export const COLORS: PlayerColor[] = ['crimson', 'forest', 'navy', 'amber'];

export const CULL: Record<2 | 3 | 4, { short: number; long: number }> = {
  2: { short: 35, long: 25 },
  3: { short: 28, long: 16 },
  4: { short: 22, long: 6 },
};

export const WHITE_KEYS: Record<2 | 3 | 4, number> = {
  2: 3,
  3: 3,
  4: 4,
};
