import { useState, useEffect, useCallback } from 'react';

type Move = 'rock' | 'paper' | 'scissors';

interface StoredMoves {
  moves: Move[];
  salt: bigint;
  timestamp: number;
}

/**
 * Custom hook for managing player moves in localStorage
 * Automatically loads/saves moves based on current round
 */
export function usePlayerMoves(
  playerPublicKey: string | null,
  gameId: string | undefined,
  currentRound: number | undefined
) {
  const [moves, setMoves] = useState<Move[]>([]);
  const [salt, setSalt] = useState<bigint | null>(null);

  // Generate storage key
  const getStorageKey = useCallback((pubkey: string, gId: string, round: number) => {
    return `${pubkey}-${gId}-${round}`;
  }, []);

  // Save to localStorage
  const saveMoves = useCallback((movesToSave: Move[], saltToSave: bigint) => {
    if (!playerPublicKey || !gameId || currentRound === undefined) return;

    const key = getStorageKey(playerPublicKey, gameId, currentRound);
    const data: StoredMoves = {
      moves: movesToSave,
      salt: saltToSave,
      timestamp: Date.now()
    };

    localStorage.setItem(key, JSON.stringify({
      ...data,
      salt: saltToSave.toString() // Convert BigInt to string for JSON
    }));

    console.log('Saved moves to localStorage:', { key, data });
  }, [playerPublicKey, gameId, currentRound, getStorageKey]);

  // Load from localStorage
  const loadMoves = useCallback(() => {
    if (!playerPublicKey || !gameId || currentRound === undefined) {
      setMoves([]);
      setSalt(null);
      return null;
    }

    const key = getStorageKey(playerPublicKey, gameId, currentRound);
    const stored = localStorage.getItem(key);

    if (!stored) {
      setMoves([]);
      setSalt(null);
      return null;
    }

    try {
      const data = JSON.parse(stored);
      const loadedMoves = data.moves as Move[];
      const loadedSalt = BigInt(data.salt);

      setMoves(loadedMoves);
      setSalt(loadedSalt);

      console.log('Loaded moves from localStorage:', { key, moves: loadedMoves });
      return { moves: loadedMoves, salt: loadedSalt, timestamp: data.timestamp };
    } catch (error) {
      console.error('Error parsing stored moves:', error);
      setMoves([]);
      setSalt(null);
      return null;
    }
  }, [playerPublicKey, gameId, currentRound, getStorageKey]);

  // Clear moves for current round
  const clearMoves = useCallback(() => {
    setMoves([]);
    setSalt(null);

    if (playerPublicKey && gameId && currentRound !== undefined) {
      const key = getStorageKey(playerPublicKey, gameId, currentRound);
      localStorage.removeItem(key);
    }
  }, [playerPublicKey, gameId, currentRound, getStorageKey]);

  // Update a single move
  const updateMove = useCallback((index: number, move: Move) => {
    setMoves(prev => {
      const newMoves = [...prev];
      newMoves[index] = move;
      return newMoves;
    });
  }, []);

  // Auto-load moves when round changes
  useEffect(() => {
    loadMoves();
  }, [loadMoves]);

  return {
    moves,
    salt,
    setMoves,
    setSalt,
    updateMove,
    saveMoves,
    loadMoves,
    clearMoves
  };
}
