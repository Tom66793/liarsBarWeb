export type CardType = 'ACE' | 'KING' | 'QUEEN' | 'JOKER';
export type PlayerStatus = 'alive' | 'dead';
export type GamePhase = 'lobby' | 'playing' | 'revolver' | 'gameOver';

export interface Card {
  id: string;
  type: CardType;
}

export interface PublicPlayer {
  id: string;
  name: string;
  handCount: number;
  status: PlayerStatus;
  cardsRemaining: number;
  isHost: boolean;
}

export interface LastPlay {
  playerId: string;
  count: number;
  claimedType: CardType;
}

export interface GameState {
  id: string;
  phase: GamePhase;
  currentPlayerIndex: number;
  tableCard: CardType | null;
  lastPlay: LastPlay | null;
  pendingShooter: string | null;
  players: PublicPlayer[];
  winner: string | null;
  log: string[];
}

export interface LiarCalledEvent {
  callerName: string;
  accusedName: string;
  revealedCards: Card[];
  claimedType: CardType;
  wasLying: boolean;
  shooterId: string;
  shooterName: string;
}

export interface TriggerResultEvent {
  playerId: string;
  playerName: string;
  died: boolean;
  cardIndex: number;
  deathPosition: number | null;
  cardsRemaining: number;
}
