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
}

export enum GameState {
  WaitingForPlayers = 0,
  InProgress = 1,
  Finished = 2,
}

export const MAX_PLAYERS = 64;
export const MAX_ROUNDS = 6;

/**
 * Instruction discriminators matching the Rust program
 */
export enum InstructionType {
  CreateGame = 0,
  JoinGame = 1,
  SubmitMoves = 2,
  RevealMoves = 3,
  ClaimPrize = 4,
}

export class TransactionPacker {
  /**
   * Pack CreateGame instruction
   * Format: [discriminator: u8][max_players: u8][buy_in_lamports: u64][name_len: u8][name: [u8; name_len]][description_len: u8][description: [u8; description_len]]
   */
  static packCreateGame(maxPlayers: number, buyInLamports: bigint, name: string = '', description: string = ''): Uint8Array {
    const nameBytes = new TextEncoder().encode(name);
    const descriptionBytes = new TextEncoder().encode(description);

    // Validate lengths (on-chain limits: 64 for name, 256 for description)
    if (nameBytes.length > 64) {
      throw new Error(`Game name too long: ${nameBytes.length} bytes (max 64)`);
    }
    if (descriptionBytes.length > 256) {
      throw new Error(`Game description too long: ${descriptionBytes.length} bytes (max 256)`);
    }

    // Calculate total size
    // 1 (discriminator) + 1 (max_players) + 8 (buy_in) + 1 (name_len) + name + 1 (desc_len) + description
    const size = 12 + nameBytes.length + descriptionBytes.length;
    const data = new Uint8Array(size);
    const view = new DataView(data.buffer);

    let offset = 0;

    // Discriminator
    view.setUint8(offset, InstructionType.CreateGame);
    offset += 1;

    // Max players
    view.setUint8(offset, maxPlayers);
    offset += 1;

    // Buy-in lamports (little-endian u64)
    view.setBigUint64(offset, buyInLamports, true);
    offset += 8;

    // Name length and bytes
    view.setUint8(offset, nameBytes.length);
    offset += 1;
    data.set(nameBytes, offset);
    offset += nameBytes.length;

    // Description length and bytes
    view.setUint8(offset, descriptionBytes.length);
    offset += 1;
    data.set(descriptionBytes, offset);

    return data;
  }

  /**
   * Pack JoinGame instruction
   * Format: [discriminator: u8][player_slot: u8]
   */
  static packJoinGame(playerSlot: number): Uint8Array {
    if (playerSlot < 0 || playerSlot >= MAX_PLAYERS) {
      throw new Error(`Invalid player slot: must be 0-${MAX_PLAYERS - 1}`);
    }
    return new Uint8Array([InstructionType.JoinGame, playerSlot]);
  }

  /**
   * Pack SubmitMoves instruction
   * Format: [discriminator: u8][moves_hash: [u8; 32]]
   */
  static packSubmitMoves(movesHash: Uint8Array): Uint8Array {
    if (movesHash.length !== 32) {
      throw new Error('Moves hash must be exactly 32 bytes');
    }

    const data = new Uint8Array(33); // 1 + 32
    data[0] = InstructionType.SubmitMoves;
    data.set(movesHash, 1);

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

    // Read name (64 bytes) - stored on-chain in fixed array
    const nameBytes = new Uint8Array(data.buffer, data.byteOffset + offset, 64);
    const name = new TextDecoder().decode(nameBytes).replace(/\0/g, '').trim();
    offset += 64;

    // Read description (256 bytes) - stored on-chain in fixed array
    const descriptionBytes = new Uint8Array(data.buffer, data.byteOffset + offset, 256);
    const description = new TextDecoder().decode(descriptionBytes).replace(/\0/g, '').trim();
    offset += 256;

    // Read game metadata
    const max_players = view.getUint8(offset); offset += 1;
    const current_players = view.getUint8(offset); offset += 1;
    const state = view.getUint8(offset); offset += 1;
    const current_round = view.getUint8(offset); offset += 1;
    const total_rounds = view.getUint8(offset); offset += 1;
    const matchups_resolved_in_round = view.getUint8(offset); offset += 1;
    offset += 2; // _padding

    const buy_in_lamports = view.getBigUint64(offset, true); offset += 8;
    const prize_pool = view.getBigUint64(offset, true); offset += 8;

    // Read players array (fixed size: 64 players)
    // IMPORTANT: Preserve slot indices by including ALL slots (empty or not)
    const players = [];
    const playerSize = 32 + 32 + 30 + 1 + 2; // pubkey + committed + revealed (5 moves * 6 rounds) + eliminated + padding

    for (let i = 0; i < MAX_PLAYERS; i++) {
      const playerOffset = offset + (i * playerSize);

      // Check if we have enough data for this player
      if (playerOffset + playerSize > data.length) {
        break; // Account too small, stop reading
      }

      const pubkeyBytes = new Uint8Array(data.buffer, data.byteOffset + playerOffset, 32);

      // Check if slot is empty (all zeros)
      const isEmptySlot = pubkeyBytes.every(byte => byte === 0);
      if (!isEmptySlot) {
        const pubkey = new PublicKey(pubkeyBytes);
        const moves_committed = new Uint8Array(data.buffer, data.byteOffset + playerOffset + 32, 32);

        // Read all rounds of moves (30 bytes = 6 rounds * 5 moves per round)
        const moves_revealed_bytes = new Uint8Array(data.buffer, data.byteOffset + playerOffset + 64, 30);

        // Parse into array of rounds, where each round has 5 moves
        const moves_revealed = [];
        for (let round = 0; round < MAX_ROUNDS; round++) {
          const roundMoves = [];
          for (let moveIdx = 0; moveIdx < 5; moveIdx++) {
            const byteVal = moves_revealed_bytes[round * 5 + moveIdx];
            roundMoves.push(byteVal === 0 ? null : byteVal - 1); // 0 = not revealed, 1-3 = Move + 1
          }
          moves_revealed.push(roundMoves);
        }

        const eliminated = view.getUint8(playerOffset + 94); // offset changed: 32 + 32 + 30

        players.push({
          slot: i, // Include the actual slot index
          pubkey: pubkey.toString(),
          moves_committed: Array.from(moves_committed),
          moves_revealed: moves_revealed, // Now an array of rounds, each with 5 moves
          eliminated: eliminated !== 0
        });
      }
    }
    offset += MAX_PLAYERS * playerSize;

    // Read bracket (6 rounds x 64 positions) - only if data is large enough
    const bracket = [];
    if (offset + (MAX_ROUNDS * MAX_PLAYERS) <= data.length) {
      for (let round = 0; round < MAX_ROUNDS; round++) {
        const roundBracket = [];
        for (let pos = 0; pos < MAX_PLAYERS; pos++) {
          const playerIdx = view.getUint8(offset);
          offset += 1;
          if (playerIdx !== 255) { // 255 = empty
            roundBracket.push(playerIdx);
          }
        }
        if (roundBracket.length > 0) {
          bracket.push(roundBracket);
        }
      }
    }

    // Convert state enum to string
    const stateNames = ['WaitingForPlayers', 'InProgress', 'Finished'];
    const stateName = stateNames[state] || 'Unknown';

    return {
      creator,
      name,
      description,
      max_players,
      buy_in_lamports,
      current_players,
      state: stateName,
      stateValue: state,
      current_round,
      total_rounds,
      matchups_resolved_in_round,
      prize_pool,
      players,
      bracket
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
 * Account Size Calculator
 */
export class AccountSizeCalculator {
  /**
   * Calculate space needed for a game account (fixed size with bytemuck)
   */
  static calculateGameAccountSize(): number {
    // GameAccount struct size (all fields are fixed-size with bytemuck)
    const baseSize =
      32 +     // creator: Pubkey
      64 +     // name: [u8; 64]
      256 +    // description: [u8; 256]
      1 +      // max_players: u8
      1 +      // current_players: u8
      1 +      // state: GameState (u8)
      1 +      // current_round: u8
      1 +      // total_rounds: u8
      1 +      // matchups_resolved_in_round: u8
      2 +      // _padding: [u8; 2]
      8 +      // buy_in_lamports: u64
      8;       // prize_pool: u64

    // Players array: [PlayerData; 64]
    const playerSize = 32 + 32 + 30 + 1 + 2; // pubkey + committed + revealed (5 moves * 6 rounds) + eliminated + padding
    const playersSize = MAX_PLAYERS * playerSize;

    // Bracket: [[u8; 64]; 6]
    const bracketSize = MAX_ROUNDS * MAX_PLAYERS;

    return baseSize + playersSize + bracketSize;
  }
}
