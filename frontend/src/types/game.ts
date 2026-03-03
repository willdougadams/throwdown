// Shared types for game components

export type Move = 'rock' | 'paper' | 'scissors' | 'fury' | 'serenity' | 'trickery';
export type MatchState = 'waiting_for_players' | 'ready_to_play' | 'waiting_for_moves' | 'waiting_for_reveals' | 'completed';
export type GameState = 'waiting' | 'in_progress' | 'completed';

export interface Player {
  id: string;
  publicKey: string;
  nickname?: string;
  eliminated?: boolean;
  slot?: number;
}

export interface MatchupPlayerData {
  player?: Player;
  moves?: Move[]; // All 5 moves
  hasSubmitted: boolean;
  hasRevealed: boolean;
  isWinner: boolean;
  slot?: number; // Slot number for empty slots (when player is undefined)
}

export interface Matchup {
  player1: MatchupPlayerData;
  player2: MatchupPlayerData;
  matchState: MatchState;
  isCurrentUserInMatch: boolean;
  gameId: string;
  gameState: GameState;
}
