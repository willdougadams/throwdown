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
      expect(MAX_PLAYERS).toBe(2);
      expect(MAX_ROUNDS).toBe(1);
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
      const buyInLamports = BigInt('100000000'); // 0.1 SOL

      const result = TransactionPacker.packCreateGame(buyInLamports, 'Test Game', 'Test Desc');

      // Format: discriminator + buy_in + name_len + name + desc_len + desc
      // 1 + 8 + 1 + 9 + 1 + 9 = 29
      expect(result.length).toBe(29);
      expect(result[0]).toBe(InstructionType.CreateGame);

      const view = new DataView(result.buffer);
      expect(view.getBigUint64(1, true)).toBe(buyInLamports);
      expect(result[9]).toBe(9); // name_len
    });

    test('should handle empty strings', () => {
      const result = TransactionPacker.packCreateGame(BigInt('1000000'), '', '');
      expect(result.length).toBe(11); // 1 + 8 + 1 + 0 + 1 + 0
    });
  });

  describe('packJoinGame', () => {
    test('should pack JoinGame instruction correctly', () => {
      const playerSlot = 0;
      const result = TransactionPacker.packJoinGame(playerSlot);

      expect(result.length).toBe(2);
      expect(result[0]).toBe(InstructionType.JoinGame);
      expect(result[1]).toBe(playerSlot);
    });
  });

  describe('packRevealMoves', () => {
    test('should pack RevealMoves instruction correctly', () => {
      const moves = [Move.Rock, Move.Paper, Move.Scissors, Move.Rock, Move.Paper];
      const salt = BigInt('9876543210');

      const result = TransactionPacker.packRevealMoves(moves, salt);

      expect(result.length).toBe(14); // 1 + 5 + 8
      expect(result[0]).toBe(InstructionType.RevealMoves);

      const view = new DataView(result.buffer);
      expect(view.getBigUint64(6, true)).toBe(salt);
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
  });

  describe('AccountSizeCalculator', () => {
    test('should calculate correct game account size', () => {
      const size = AccountSizeCalculator.calculateGameAccountSize();
      // Expected size: 384 (metadata) + 2 * 72 (players) = 528
      expect(size).toBe(528);
    });
  });
});
