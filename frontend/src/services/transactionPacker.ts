import { PublicKey } from '@solana/web3.js';

/**
 * Transaction Packer for Skrim RPS Game
 *
 * Matches the new bytemuck-based Rust program structure with:
 * - Manual instruction packing (no Borsh)
 * - Fixed-size arrays (64 max players)
 * - Atomic matchup resolution
 */

export enum Move {
  Rock = 0,
  Paper = 1,
  Scissors = 2,
  Fury = 3,
  Serenity = 4,
  Trickery = 5,
}

export enum GameState {
  WaitingForPlayers = 0,
  InProgress = 1,
  Finished = 2,
}

export const MAX_PLAYERS = 2;
export const MAX_ROUNDS = 1;

/**
 * Instruction discriminators matching the Rust program
 */
export enum InstructionType {
  CreateChallenge = 0,
  AcceptChallenge = 1,
  RevealMoves = 2,
  ClaimPrize = 3,
}

export class TransactionPacker {
  /**
   * Pack CreateChallenge instruction
   * Format: [disc: u8][buy_in: u64][hash: [u8; 32]][name_len: u8][name: [u8; name_len]]
   */
  static packCreateChallenge(buyInLamports: bigint, movesHash: Uint8Array): Uint8Array {
    // 1 (disc) + 8 (buy_in) + 32 (hash)
    const data = new Uint8Array(41);
    const view = new DataView(data.buffer);

    view.setUint8(0, InstructionType.CreateChallenge);
    view.setBigUint64(1, buyInLamports, true);
    data.set(movesHash, 9);

    return data;
  }

  /**
   * Pack AcceptChallenge instruction
   * Format: [disc: u8][move1: u8]...[move5: u8]
   */
  static packAcceptChallenge(moves: Move[]): Uint8Array {
    if (moves.length !== 5) {
      throw new Error('Must provide exactly 5 moves');
    }
    const data = new Uint8Array(6);
    data[0] = InstructionType.AcceptChallenge;
    for (let i = 0; i < 5; i++) {
      data[1 + i] = moves[i];
    }
    return data;
  }

  /**
   * Pack RevealMoves instruction
   * Format: [discriminator: u8][move1: u8][move2: u8][move3: u8][move4: u8][move5: u8][salt: u64]
   */
  static packRevealMoves(moves: Move[], salt: bigint): Uint8Array {
    if (moves.length !== 5) {
      throw new Error('Must provide exactly 5 moves');
    }

    const data = new Uint8Array(14); // 1 + 5 + 8
    const view = new DataView(data.buffer);

    view.setUint8(0, InstructionType.RevealMoves);

    // Pack 5 moves
    for (let i = 0; i < 5; i++) {
      view.setUint8(1 + i, moves[i]);
    }

    // Pack salt (little-endian u64)
    view.setBigUint64(6, salt, true);

    return data;
  }

  /**
   * Pack ClaimPrize instruction
   * Format: [discriminator: u8]
   */
  static packClaimPrize(): Uint8Array {
    return new Uint8Array([InstructionType.ClaimPrize]);
  }


  /**
   * Hash moves with salt (matching the program's implementation)
   */
  static hashMoves(moves: Move[], salt: bigint): Uint8Array {
    const input = new Uint8Array(5 + 8); // 5 moves + 8 bytes for salt

    // Add moves
    for (let i = 0; i < 5; i++) {
      input[i] = moves[i];
    }

    // Add salt (little endian)
    const saltBytes = new Uint8Array(8);
    const view = new DataView(saltBytes.buffer);
    view.setBigUint64(0, salt, true);
    input.set(saltBytes, 5);

    // Simple hash matching program implementation
    const hash = new Uint8Array(32);

    for (let i = 0; i < input.length; i++) {
      const pos = i % 32;
      hash[pos] = ((hash[pos] + input[i]) * 7 + i) & 0xFF;
    }

    // Add mixing
    for (let i = 0; i < 32; i++) {
      const next = (i + 1) % 32;
      hash[i] = ((hash[i] + hash[next]) * 3) & 0xFF;
    }

    return hash;
  }

  /**
   * Debug helper to format bytes as hex string
   */
  static toHexString(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ');
  }

  /**
   * Debug helper to log instruction data
   */
  static logInstruction(name: string, data: Uint8Array): void {
    console.log(`[${name}] Instruction Data (${data.length} bytes):`);
    console.log(`  Hex: ${this.toHexString(data)}`);
    console.log(`  Discriminant: ${data[0]}`);
  }
}

/**
 * Game Account Deserializer for bytemuck-based structure
 */
export class GameAccountDeserializer {
  /**
   * Deserialize a game account from on-chain data (bytemuck format)
   */
  static deserialize(data: Uint8Array): any {
    if (data.length < 100) {
      return null;
    }

    const view = new DataView(data.buffer, data.byteOffset);
    let offset = 0;

    // Read creator (32 bytes)
    const creatorBytes = new Uint8Array(data.buffer, data.byteOffset + offset, 32);
    const creator = new PublicKey(creatorBytes).toString();
    offset += 32;

    // Read game metadata
    const max_players = view.getUint8(offset); offset += 1;
    const current_players = view.getUint8(offset); offset += 1;
    const state = view.getUint8(offset); offset += 1;
    offset += 5; // _padding (35 + 5 = 40, matching OFFSET_LAST_ACTION)
    const last_action_timestamp = view.getBigInt64(offset, true); offset += 8;
    const buy_in_lamports = view.getBigUint64(offset, true); offset += 8;
    const prize_pool = view.getBigUint64(offset, true); offset += 8;

    // Read players array (fixed size: 2 players)
    const players = [];
    const playerSize = 72; // 32 + 32 + 5 + 1 + 2

    for (let i = 0; i < 2; i++) {
      const playerOffset = offset + (i * playerSize);

      if (playerOffset + playerSize > data.length) {
        break;
      }

      const pubkeyBytes = new Uint8Array(data.buffer, data.byteOffset + playerOffset, 32);
      const isEmptySlot = pubkeyBytes.every(byte => byte === 0);

      if (!isEmptySlot) {
        const pubkey = new PublicKey(pubkeyBytes);
        const moves_committed = new Uint8Array(data.buffer, data.byteOffset + playerOffset + 32, 32);
        const moves_revealed_bytes = new Uint8Array(data.buffer, data.byteOffset + playerOffset + 64, 5);
        const moves_revealed = Array.from(moves_revealed_bytes).map(byteVal => byteVal === 0 ? null : byteVal - 1);
        const eliminated = view.getUint8(playerOffset + 69);

        players.push({
          slot: i,
          pubkey: pubkey.toString(),
          moves_committed: Array.from(moves_committed),
          moves_revealed: moves_revealed,
          eliminated: eliminated !== 0
        });
      }
    }

    const stateNames = ['WaitingForPlayers', 'InProgress', 'Finished'];
    const stateName = stateNames[state] || 'Unknown';

    return {
      creator,
      name: "",
      description: "",
      max_players,
      buy_in_lamports,
      current_players,
      state: stateName,
      stateValue: state,
      prize_pool,
      last_action_timestamp: Number(last_action_timestamp),
      players
    };
  }

  /**
   * Format lamports to SOL
   */
  static lamportsToSol(lamports: bigint | number): number {
    const lamportsBigInt = typeof lamports === 'number' ? BigInt(lamports) : lamports;
    return Number(lamportsBigInt) / 1_000_000_000;
  }

  /**
   * Get a human-readable game status
   */
  static getGameStatus(game: any): string {
    switch (game.state) {
      case 'WaitingForPlayers':
        return `Waiting for players (${game.current_players}/${game.max_players})`;
      case 'InProgress':
        return `Round ${game.current_round + 1}/${game.total_rounds}`;
      case 'Finished':
        const winner = game.players.find((p: any) => !p.eliminated);
        return winner ? `Game finished! Winner: ${winner.pubkey.slice(0, 8)}...` : 'Game finished';
      default:
        return 'Unknown state';
    }
  }
}

/**
 * Waiting Account Deserializer
 */
export class WaitingAccountDeserializer {
  /**
   * Deserialize a waiting account
   * Format: [player: Pubkey][entry_fee: u64][timestamp: i64]
   */
  static deserialize(data: Uint8Array): any {
    if (data.length < 48) return null;
    const view = new DataView(data.buffer, data.byteOffset);

    const playerBytes = new Uint8Array(data.buffer, data.byteOffset, 32);
    const player = new PublicKey(playerBytes).toString();

    const entry_fee = view.getBigUint64(32, true);
    const timestamp = view.getBigInt64(40, true);

    return {
      player,
      entry_fee,
      timestamp: Number(timestamp)
    };
  }
}

/**
 * Account Size Calculator
 */
export class AccountSizeCalculator {
  /**
   * Calculate space needed for a game account (fixed size with bytemuck)
   */
  static calculateGameAccountSize(): number {
    return 208;
  }

  static calculateChessAccountSize(): number {
    return 208;
  }
}

/**
 * Transaction Packer for Skrim Idiot Chess Game
 */
export enum ChessInstructionType {
  CreateChallenge = 0,
  AcceptChallenge = 1,
  MakeMove = 2,
  ClaimPrize = 3,
}

export class ChessTransactionPacker {
  static packCreateChallenge(buyInLamports: bigint): Uint8Array {
    const data = new Uint8Array(9);
    const view = new DataView(data.buffer);
    view.setUint8(0, ChessInstructionType.CreateChallenge);
    view.setBigUint64(1, buyInLamports, true);
    return data;
  }

  static packAcceptChallenge(): Uint8Array {
    return new Uint8Array([ChessInstructionType.AcceptChallenge]);
  }

  static packMakeMove(fromX: number, fromY: number, toX: number, toY: number): Uint8Array {
    return new Uint8Array([
      ChessInstructionType.MakeMove,
      fromX,
      fromY,
      toX,
      toY
    ]);
  }

  static packClaimPrize(): Uint8Array {
    return new Uint8Array([ChessInstructionType.ClaimPrize]);
  }
}

/**
 * Game Account Deserializer for Idiot Chess
 */
export class ChessGameAccountDeserializer {
  static deserialize(data: Uint8Array): any {
    if (data.length < 208) {
      return null;
    }

    const view = new DataView(data.buffer, data.byteOffset);
    let offset = 0;

    // creator: Pubkey (32)
    const creatorBytes = new Uint8Array(data.buffer, data.byteOffset + offset, 32);
    const creator = new PublicKey(creatorBytes).toString();
    offset += 32;

    // last_action_timestamp: i64 (8)
    const last_action_timestamp = view.getBigInt64(offset, true);
    offset += 8;

    // buy_in_lamports: u64 (8)
    const buy_in_lamports = view.getBigUint64(offset, true);
    offset += 8;

    // prize_pool: u64 (8)
    const prize_pool = view.getBigUint64(offset, true);
    offset += 8;

    // white_time_seconds: i64 (8)
    const white_time_seconds = view.getBigInt64(offset, true);
    offset += 8;

    // black_time_seconds: i64 (8)
    const black_time_seconds = view.getBigInt64(offset, true);
    offset += 8;

    // players: [PlayerData; 2] (2 * 40 = 80)
    const players = [];
    for (let i = 0; i < 2; i++) {
      const playerOffset = offset + (i * 40);
      const pubkeyBytes = new Uint8Array(data.buffer, data.byteOffset + playerOffset, 32);

      const isEmptySlot = pubkeyBytes.every(byte => byte === 0);
      if (!isEmptySlot) {
        const pubkey = new PublicKey(pubkeyBytes).toString();
        const eliminated = view.getUint8(playerOffset + 32);
        players.push({
          pubkey,
          eliminated: eliminated !== 0
        });
      }
    }
    offset += 80;

    // board: [[Piece; 5]; 5] (25 * 2 = 50)
    const board: any[][] = [];
    const piecesList: any[] = [];
    for (let y = 0; y < 5; y++) {
      const row = [];
      for (let x = 0; x < 5; x++) {
        const pieceOffset = offset + (y * 5 + x) * 2;
        const pieceType = view.getUint8(pieceOffset);
        const player = view.getUint8(pieceOffset + 1);

        if (pieceType === 0) {
          row.push(null);
        } else {
          const piece = {
            type: pieceType === 1 ? 'king' : 'pawn',
            player: player === 0 ? 'white' : 'black',
            id: `onchain-${y}-${x}-${pieceType}-${player}`,
            x,
            y,
            pieceType,
            playerValue: player
          };
          row.push(piece);
          piecesList.push(piece);
        }
      }
      board.push(row);
    }
    offset += 50;

    const turnVal = view.getUint8(offset); offset += 1;
    const winnerVal = view.getUint8(offset); offset += 1;
    const move_count = view.getUint8(offset); offset += 1;

    const winnerMap = ['None', 'white', 'black', 'draw'];
    const winner = winnerMap[winnerVal] === 'None' ? null : winnerMap[winnerVal];

    return {
      creator,
      name: "",
      description: '',
      last_action_timestamp: Number(last_action_timestamp),
      buy_in_lamports,
      buyIn: Number(buy_in_lamports),
      prize_pool,
      white_time_seconds: Number(white_time_seconds),
      black_time_seconds: Number(black_time_seconds),
      players,
      playerWhite: players[0]?.pubkey || '',
      playerBlack: players[1]?.pubkey || '',
      board,
      pieces: piecesList,
      turn: turnVal,
      winner: winnerVal === 0 ? null : winnerVal,
      moveCount: move_count,
      move_count,
      prizeClaimed: winnerVal !== 0 && players.every(p => p.eliminated),
      state: winner ? 'Finished' : (players.length < 2 ? 'WaitingForPlayers' : 'InProgress')
    };
  }
}
