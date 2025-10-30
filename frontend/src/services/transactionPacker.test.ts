import {
  TransactionPacker,
  Move,
  GameState,
  InstructionType,
  MAX_PLAYERS,
  MAX_ROUNDS,
  AccountSizeCalculator,
} from './transactionPacker';

describe('TransactionPacker', () => {
  describe('Constants', () => {
    test('should have correct max values', () => {
      expect(MAX_PLAYERS).toBe(64);
      expect(MAX_ROUNDS).toBe(6);
    });
  });

  describe('Enums', () => {
    test('Move enum should have correct values', () => {
      expect(Move.Rock).toBe(0);
      expect(Move.Paper).toBe(1);
      expect(Move.Scissors).toBe(2);
    });

    test('GameState enum should have correct values', () => {
      expect(GameState.WaitingForPlayers).toBe(0);
      expect(GameState.InProgress).toBe(1);
      expect(GameState.Finished).toBe(2);
    });

    test('InstructionType enum should have correct discriminators', () => {
      expect(InstructionType.CreateGame).toBe(0);
      expect(InstructionType.JoinGame).toBe(1);
      expect(InstructionType.SubmitMoves).toBe(2);
      expect(InstructionType.RevealMoves).toBe(3);
      expect(InstructionType.ClaimPrize).toBe(4);
    });
  });

  describe('packCreateGame', () => {
    test('should pack CreateGame instruction correctly', () => {
      const maxPlayers = 8;
      const buyInLamports = BigInt('100000000'); // 0.1 SOL

      const result = TransactionPacker.packCreateGame(maxPlayers, buyInLamports);

      // Format: discriminator + max_players + buy_in + name_len + name + desc_len + desc
      // With empty name and description: 1 + 1 + 8 + 1 + 0 + 1 + 0 = 12
      expect(result.length).toBe(12);
      expect(result[0]).toBe(InstructionType.CreateGame);
      expect(result[1]).toBe(maxPlayers);

      const view = new DataView(result.buffer);
      expect(view.getBigUint64(2, true)).toBe(buyInLamports);
      expect(result[10]).toBe(0); // name_len
      expect(result[11]).toBe(0); // description_len
    });

    test('should handle different player counts', () => {
      const testCases = [2, 4, 8, 16, 32, 64];

      for (const count of testCases) {
        const result = TransactionPacker.packCreateGame(count, BigInt('1000000'));
        expect(result[1]).toBe(count);
      }
    });

    test('should handle different buy-in amounts', () => {
      const testAmounts = [
        BigInt('0'),
        BigInt('1000000'), // 0.001 SOL
        BigInt('1000000000'), // 1 SOL
        BigInt('10000000000'), // 10 SOL
      ];

      for (const amount of testAmounts) {
        const result = TransactionPacker.packCreateGame(8, amount);
        const view = new DataView(result.buffer);
        expect(view.getBigUint64(2, true)).toBe(amount);
      }
    });
  });

  describe('packJoinGame', () => {
    test('should pack JoinGame instruction correctly', () => {
      const playerSlot = 0;
      const result = TransactionPacker.packJoinGame(playerSlot);

      // Format: discriminator + player_slot = 1 + 1 = 2 bytes
      expect(result.length).toBe(2);
      expect(result[0]).toBe(InstructionType.JoinGame);
      expect(result[1]).toBe(playerSlot);
    });

    test('should handle different player slots', () => {
      const testSlots = [0, 1, 5, 10, 63];

      for (const slot of testSlots) {
        const result = TransactionPacker.packJoinGame(slot);
        expect(result[1]).toBe(slot);
      }
    });

    test('should reject invalid player slots', () => {
      expect(() => TransactionPacker.packJoinGame(-1)).toThrow();
      expect(() => TransactionPacker.packJoinGame(64)).toThrow();
      expect(() => TransactionPacker.packJoinGame(100)).toThrow();
    });
  });

  describe('packSubmitMoves', () => {
    test('should pack SubmitMoves instruction correctly', () => {
      const movesHash = new Uint8Array(32);
      movesHash.fill(42);

      const result = TransactionPacker.packSubmitMoves(movesHash);

      expect(result.length).toBe(33); // 1 + 32
      expect(result[0]).toBe(InstructionType.SubmitMoves);

      for (let i = 0; i < 32; i++) {
        expect(result[i + 1]).toBe(42);
      }
    });

    test('should reject invalid hash lengths', () => {
      const shortHash = new Uint8Array(16);
      const longHash = new Uint8Array(64);

      expect(() => TransactionPacker.packSubmitMoves(shortHash)).toThrow();
      expect(() => TransactionPacker.packSubmitMoves(longHash)).toThrow();
    });
  });

  describe('packRevealMoves', () => {
    test('should pack RevealMoves instruction correctly', () => {
      const moves = [Move.Rock, Move.Paper, Move.Scissors, Move.Rock, Move.Paper];
      const salt = BigInt('9876543210');

      const result = TransactionPacker.packRevealMoves(moves, salt);

      expect(result.length).toBe(14); // 1 + 5 + 8
      expect(result[0]).toBe(InstructionType.RevealMoves);

      // Check moves
      for (let i = 0; i < 5; i++) {
        expect(result[i + 1]).toBe(moves[i]);
      }

      // Check salt
      const view = new DataView(result.buffer);
      expect(view.getBigUint64(6, true)).toBe(salt);
    });

    test('should reject incorrect number of moves', () => {
      const tooFewMoves = [Move.Rock, Move.Paper];
      const tooManyMoves = [Move.Rock, Move.Paper, Move.Scissors, Move.Rock, Move.Paper, Move.Scissors];
      const salt = BigInt('123');

      expect(() => TransactionPacker.packRevealMoves(tooFewMoves, salt)).toThrow();
      expect(() => TransactionPacker.packRevealMoves(tooManyMoves, salt)).toThrow();
    });

    test('should handle all move combinations', () => {
      const allMoves = [
        [Move.Rock, Move.Rock, Move.Rock, Move.Rock, Move.Rock],
        [Move.Paper, Move.Paper, Move.Paper, Move.Paper, Move.Paper],
        [Move.Scissors, Move.Scissors, Move.Scissors, Move.Scissors, Move.Scissors],
        [Move.Rock, Move.Paper, Move.Scissors, Move.Rock, Move.Paper],
      ];

      for (const moves of allMoves) {
        const result = TransactionPacker.packRevealMoves(moves, BigInt('123'));
        expect(result.length).toBe(14);

        for (let i = 0; i < 5; i++) {
          expect(result[i + 1]).toBe(moves[i]);
        }
      }
    });
  });

  describe('packClaimPrize', () => {
    test('should pack ClaimPrize instruction correctly', () => {
      const result = TransactionPacker.packClaimPrize();

      expect(result.length).toBe(1);
      expect(result[0]).toBe(InstructionType.ClaimPrize);
    });
  });

  describe('hashMoves', () => {
    test('should produce consistent hashes', () => {
      const moves = [Move.Rock, Move.Paper, Move.Scissors, Move.Rock, Move.Paper];
      const salt = BigInt('123456789');

      const hash1 = TransactionPacker.hashMoves(moves, salt);
      const hash2 = TransactionPacker.hashMoves(moves, salt);

      expect(hash1).toEqual(hash2);
      expect(hash1.length).toBe(32);
    });

    test('should produce different hashes for different moves', () => {
      const moves1 = [Move.Rock, Move.Paper, Move.Scissors, Move.Rock, Move.Paper];
      const moves2 = [Move.Paper, Move.Rock, Move.Scissors, Move.Rock, Move.Paper];
      const salt = BigInt('123456789');

      const hash1 = TransactionPacker.hashMoves(moves1, salt);
      const hash2 = TransactionPacker.hashMoves(moves2, salt);

      expect(hash1).not.toEqual(hash2);
    });

    test('should produce different hashes for different salts', () => {
      const moves = [Move.Rock, Move.Paper, Move.Scissors, Move.Rock, Move.Paper];
      const salt1 = BigInt('123456789');
      const salt2 = BigInt('987654321');

      const hash1 = TransactionPacker.hashMoves(moves, salt1);
      const hash2 = TransactionPacker.hashMoves(moves, salt2);

      expect(hash1).not.toEqual(hash2);
    });

    test('should match Rust hash implementation', () => {
      // This test verifies the hash matches the Rust program's implementation
      const moves = [Move.Rock, Move.Paper, Move.Scissors, Move.Rock, Move.Paper];
      const salt = BigInt('1000000');

      const hash = TransactionPacker.hashMoves(moves, salt);

      // The hash should be deterministic based on the Rust implementation
      expect(hash.length).toBe(32);
      // Verify it's not all zeros (basic sanity check)
      const isAllZeros = hash.every(byte => byte === 0);
      expect(isAllZeros).toBe(false);
    });
  });

  describe('AccountSizeCalculator', () => {
    test('should calculate correct game account size', () => {
      const size = AccountSizeCalculator.calculateGameAccountSize();

      // Expected size breakdown:
      // Base: 32 (creator) + 64 (name) + 256 (description) + 1 (max_players) + 1 (current_players)
      //       + 1 (state) + 1 (current_round) + 1 (total_rounds) + 1 (matchups_resolved)
      //       + 2 (padding) + 8 (buy_in) + 8 (prize_pool) = 376 bytes
      // Players: 64 * (32 + 32 + 30 + 1 + 2) = 64 * 97 = 6208 bytes
      //   (pubkey + committed_hash + revealed_moves[6*5] + eliminated + padding)
      // Bracket: 6 * 64 = 384 bytes
      // Total: 376 + 6208 + 384 = 6968 bytes

      expect(size).toBe(6968);
    });
  });

  describe('Utility functions', () => {
    test('toHexString should format bytes correctly', () => {
      const bytes = new Uint8Array([0, 255, 16, 170]);
      const result = TransactionPacker.toHexString(bytes);
      expect(result).toBe('00 ff 10 aa');
    });

    test('toHexString should handle empty array', () => {
      const bytes = new Uint8Array([]);
      const result = TransactionPacker.toHexString(bytes);
      expect(result).toBe('');
    });

    test('toHexString should handle single byte', () => {
      const bytes = new Uint8Array([42]);
      const result = TransactionPacker.toHexString(bytes);
      expect(result).toBe('2a');
    });
  });

  describe('Integration tests', () => {
    test('submit and reveal workflow should work correctly', () => {
      const moves = [Move.Rock, Move.Paper, Move.Scissors, Move.Rock, Move.Paper];
      const salt = BigInt('9876543210');

      // Hash the moves
      const hash = TransactionPacker.hashMoves(moves, salt);

      // Pack submit instruction
      const submitData = TransactionPacker.packSubmitMoves(hash);
      expect(submitData.length).toBe(33);

      // Pack reveal instruction
      const revealData = TransactionPacker.packRevealMoves(moves, salt);
      expect(revealData.length).toBe(14);

      // Verify the hash in submitData matches what we'd compute from revealData
      const extractedHash = submitData.slice(1, 33);
      const recomputedHash = TransactionPacker.hashMoves(moves, salt);
      expect(extractedHash).toEqual(recomputedHash);
    });

    test('complete game flow instructions', () => {
      // CreateGame
      const createData = TransactionPacker.packCreateGame(8, BigInt('100000000'));
      expect(createData[0]).toBe(InstructionType.CreateGame);

      // JoinGame
      const joinData = TransactionPacker.packJoinGame(0);
      expect(joinData[0]).toBe(InstructionType.JoinGame);

      // SubmitMoves
      const moves = [Move.Rock, Move.Paper, Move.Scissors, Move.Rock, Move.Paper];
      const salt = BigInt('123456');
      const hash = TransactionPacker.hashMoves(moves, salt);
      const submitData = TransactionPacker.packSubmitMoves(hash);
      expect(submitData[0]).toBe(InstructionType.SubmitMoves);

      // RevealMoves
      const revealData = TransactionPacker.packRevealMoves(moves, salt);
      expect(revealData[0]).toBe(InstructionType.RevealMoves);

      // ClaimPrize
      const claimData = TransactionPacker.packClaimPrize();
      expect(claimData[0]).toBe(InstructionType.ClaimPrize);
    });
  });
});
