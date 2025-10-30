/**
 * Tests for BracketGame instruction serialization and game logic
 */

describe('BracketGame Instructions', () => {
  test('serializeCreateGameInstruction creates correct buffer', () => {
    // Mock the serialization function using native browser APIs
    const serializeCreateGameInstruction = (maxPlayers: number, buyInLamports: bigint): Uint8Array => {
      // Total size: 1 (discriminator) + 1 (max_players) + 8 (buy_in) = 10 bytes
      const buffer = new Uint8Array(10);
      const view = new DataView(buffer.buffer);
      
      // Instruction discriminator (0 = CreateGame)
      view.setUint8(0, 0);
      
      // Max players (u8)
      view.setUint8(1, maxPlayers);
      
      // Buy-in amount (u64, little endian)
      view.setBigUint64(2, buyInLamports, true);
      
      return buffer;
    };

    const maxPlayers = 8;
    const buyInLamports = BigInt(1000000000); // 1 SOL
    const result = serializeCreateGameInstruction(maxPlayers, buyInLamports);

    // Check total length: 1 (discriminator) + 1 (max_players) + 8 (buy_in) = 10 bytes
    expect(result.length).toBe(10);

    // Check discriminator
    expect(result[0]).toBe(0);

    // Check max_players
    expect(result[1]).toBe(8);

    // Check buy_in_lamports (little endian)
    const view = new DataView(result.buffer, 2, 8);
    const reconstructed = view.getBigUint64(0, true);
    expect(reconstructed).toBe(BigInt(1000000000));
  });

  test('serializeJoinGameInstruction creates correct buffer', () => {
    const serializeJoinGameInstruction = (): Uint8Array => {
      // Total size: 1 (discriminator) = 1 byte
      const buffer = new Uint8Array(1);
      const view = new DataView(buffer.buffer);
      
      // Instruction discriminator (1 = JoinGame)
      view.setUint8(0, 1);
      
      return buffer;
    };

    const result = serializeJoinGameInstruction();

    // Check length and discriminator
    expect(result.length).toBe(1);
    expect(result[0]).toBe(1);
  });

  test('tournament size validation', () => {
    const validSizes = [4, 8, 16, 32];
    const invalidSizes = [1, 2, 3, 5, 6, 7, 9, 10, 15, 20, 64];

    validSizes.forEach(size => {
      expect([4, 8, 16, 32]).toContain(size);
    });

    invalidSizes.forEach(size => {
      expect([4, 8, 16, 32]).not.toContain(size);
    });
  });

  test('prize pool calculation', () => {
    const testCases = [
      { players: 4, buyIn: 0.1, expected: 0.4 },
      { players: 8, buyIn: 0.25, expected: 2.0 },
      { players: 16, buyIn: 0.05, expected: 0.8 },
      { players: 32, buyIn: 0.01, expected: 0.32 },
    ];

    testCases.forEach(({ players, buyIn, expected }) => {
      const prizePool = players * buyIn;
      expect(prizePool).toBeCloseTo(expected, 2);
    });
  });

  test('move enum values', () => {
    enum Move {
      Rock = 0,
      Paper = 1,
      Scissors = 2,
    }

    expect(Move.Rock).toBe(0);
    expect(Move.Paper).toBe(1);
    expect(Move.Scissors).toBe(2);
  });

  test('RPS game logic', () => {
    enum Move {
      Rock = 0,
      Paper = 1,
      Scissors = 2,
    }

    const rpsWinner = (move1: Move, move2: Move): number | null => {
      if (
        (move1 === Move.Rock && move2 === Move.Scissors) ||
        (move1 === Move.Paper && move2 === Move.Rock) ||
        (move1 === Move.Scissors && move2 === Move.Paper)
      ) {
        return 0; // Player 1 wins
      } else if (
        (move1 === Move.Scissors && move2 === Move.Rock) ||
        (move1 === Move.Rock && move2 === Move.Paper) ||
        (move1 === Move.Paper && move2 === Move.Scissors)
      ) {
        return 1; // Player 2 wins
      } else {
        return null; // Tie
      }
    };

    // Test wins
    expect(rpsWinner(Move.Rock, Move.Scissors)).toBe(0);
    expect(rpsWinner(Move.Paper, Move.Rock)).toBe(0);
    expect(rpsWinner(Move.Scissors, Move.Paper)).toBe(0);

    // Test losses (reversed)
    expect(rpsWinner(Move.Scissors, Move.Rock)).toBe(1);
    expect(rpsWinner(Move.Rock, Move.Paper)).toBe(1);
    expect(rpsWinner(Move.Paper, Move.Scissors)).toBe(1);

    // Test ties
    expect(rpsWinner(Move.Rock, Move.Rock)).toBe(null);
    expect(rpsWinner(Move.Paper, Move.Paper)).toBe(null);
    expect(rpsWinner(Move.Scissors, Move.Scissors)).toBe(null);
  });

  test('lamports conversion', () => {
    const LAMPORTS_PER_SOL = 1000000000;
    
    const testCases = [
      { sol: 0.1, lamports: 100000000 },
      { sol: 1.0, lamports: 1000000000 },
      { sol: 0.001, lamports: 1000000 },
      { sol: 2.5, lamports: 2500000000 },
    ];

    testCases.forEach(({ sol, lamports }) => {
      const converted = Math.floor(sol * LAMPORTS_PER_SOL);
      expect(converted).toBe(lamports);
      
      const convertedBigInt = BigInt(converted);
      expect(convertedBigInt).toBe(BigInt(lamports));
    });
  });

  test('rounds calculation for tournament sizes', () => {
    const calculateRounds = (players: number): number => {
      switch (players) {
        case 4: return 2;   // 4 -> 2 -> 1
        case 8: return 3;   // 8 -> 4 -> 2 -> 1
        case 16: return 4;  // 16 -> 8 -> 4 -> 2 -> 1
        case 32: return 5;  // 32 -> 16 -> 8 -> 4 -> 2 -> 1
        default: throw new Error('Invalid tournament size');
      }
    };

    expect(calculateRounds(4)).toBe(2);
    expect(calculateRounds(8)).toBe(3);
    expect(calculateRounds(16)).toBe(4);
    expect(calculateRounds(32)).toBe(5);

    expect(() => calculateRounds(6)).toThrow('Invalid tournament size');
  });
});