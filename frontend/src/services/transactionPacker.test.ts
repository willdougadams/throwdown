import {
  TransactionPacker,
  Move,
  InstructionType,
  MAX_PLAYERS,
  AccountSizeCalculator,
} from './transactionPacker';

describe('TransactionPacker', () => {
  describe('Constants', () => {
    test('should have correct max values', () => {
      expect(MAX_PLAYERS).toBe(2);
    });
  });

  describe('Enums', () => {
    test('Move enum should have correct values', () => {
      expect(Move.Rock).toBe(0);
      expect(Move.Paper).toBe(1);
      expect(Move.Scissors).toBe(2);
      expect(Move.Fury).toBe(3);
      expect(Move.Serenity).toBe(4);
      expect(Move.Trickery).toBe(5);
    });

    test('InstructionType enum should have correct discriminators', () => {
      expect(InstructionType.CreateChallenge).toBe(0);
      expect(InstructionType.AcceptChallenge).toBe(1);
      expect(InstructionType.RevealMoves).toBe(2);
      expect(InstructionType.ClaimPrize).toBe(3);
    });
  });

  describe('packCreateChallenge', () => {
    test('should pack CreateChallenge instruction correctly', () => {
      const buyInLamports = BigInt('100000000'); // 0.1 SOL
      const movesHash = new Uint8Array(32).fill(1);
      const result = TransactionPacker.packCreateChallenge(buyInLamports, movesHash);

      // Format: [disc: u8][buy_in: u64][hash: [u8; 32]]
      // 1 + 8 + 32 = 41
      expect(result.length).toBe(41);
      expect(result[0]).toBe(InstructionType.CreateChallenge);

      const view = new DataView(result.buffer);
      expect(view.getBigUint64(1, true)).toBe(buyInLamports);
      expect(result.slice(9, 41)).toEqual(movesHash);

    });
  });

  describe('packAcceptChallenge', () => {
    test('should pack AcceptChallenge instruction correctly', () => {
      const moves = [Move.Rock, Move.Paper, Move.Scissors, Move.Fury, Move.Serenity];
      const result = TransactionPacker.packAcceptChallenge(moves);

      // 1 (disc) + 5 (moves) = 6
      expect(result.length).toBe(6);
      expect(result[0]).toBe(InstructionType.AcceptChallenge);
      expect(result[1]).toBe(Move.Rock);
      expect(result[5]).toBe(Move.Serenity);
    });
  });

  describe('packRevealMoves', () => {
    test('should pack RevealMoves instruction correctly', () => {
      const moves = [Move.Rock, Move.Paper, Move.Scissors, Move.Fury, Move.Serenity];
      const salt = BigInt('9876543210');

      const result = TransactionPacker.packRevealMoves(moves, salt);

      // 1 (disc) + 5 (moves) + 8 (salt) = 14
      expect(result.length).toBe(14);
      expect(result[0]).toBe(InstructionType.RevealMoves);

      const view = new DataView(result.buffer);
      expect(view.getBigUint64(6, true)).toBe(salt);
    });
  });

  describe('hashMoves', () => {
    test('should produce consistent hashes', () => {
      const moves = [Move.Rock, Move.Paper, Move.Scissors, Move.Fury, Move.Serenity];
      const salt = BigInt('123456789');

      const hash1 = TransactionPacker.hashMoves(moves, salt);
      const hash2 = TransactionPacker.hashMoves(moves, salt);

      expect(hash1).toEqual(hash2);
      expect(hash1.length).toBe(32);
    });
  });

  describe('AccountSizeCalculator', () => {
    test('should calculate correct game account size', () => {
      const size = AccountSizeCalculator.calculateGameAccountSize();
      // baseSize = 32 + 64 + 256 + 1 + 1 + 1 + 5 + 8 + 8 + 8 = 384
      // playersSize = 2 * (32 + 32 + 5 + 1 + 2) = 2 * 72 = 144
      // total = 384 + 144 = 528
      expect(size).toBe(528);
    });
  });
});
