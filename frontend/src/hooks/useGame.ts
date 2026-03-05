import { useState, useEffect, useCallback } from 'react';
import { useNetwork } from '../contexts/NetworkContext';


export interface GameData {
  id: string;
  state: 'waiting' | 'in_progress' | 'completed';
  currentRound: number;
  maxPlayers: number;
  players: Array<{
    id: string;
    publicKey: string;
    nickname?: string;
    eliminated?: boolean;
    slot?: number;
  }>;
  winner?: {
    id: string;
    publicKey: string;
    nickname?: string;
  };
}

interface UseGameResult {
  gameData: GameData | null;
  rawGameData: any | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Custom hook for fetching and managing game data from the blockchain
 * @param gameId - The public key of the game account
 * @param autoRefresh - Optional: Auto-refresh interval in milliseconds
 */
export function useGame(gameId: string | undefined, autoRefresh?: number): UseGameResult {
  const { activeClient } = useNetwork();

  const [gameData, setGameData] = useState<GameData | null>(null);
  const [rawGameData, setRawGameData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGameData = useCallback(async () => {
    if (!gameId) {
      console.log('No gameId available');
      return;
    }


    console.log('Fetching game data for:', gameId);
    setLoading(true);
    setError(null);

    try {
      const gameDetails = await activeClient.getGameDetails('rps', gameId);


      if (!gameDetails) {
        setError('Game not found');
        setGameData(null);
        setRawGameData(null);
        return;
      }

      console.log('Raw game details:', gameDetails);
      setRawGameData(gameDetails);

      // Parse players - use slot numbers, not array indices
      const players = gameDetails.players?.map((player: any) => ({
        id: player.slot.toString(),
        publicKey: player.pubkey || player.toString(),
        nickname: `Slot ${player.slot + 1}`,
        eliminated: player.eliminated,
        slot: player.slot
      })) || [];

      // Find winner if game is finished
      let winner = undefined;
      if (gameDetails.state === 'Finished') {
        const winnerPlayer = players.find((p: any) => !p.eliminated);
        if (winnerPlayer) {
          winner = {
            id: winnerPlayer.id,
            publicKey: winnerPlayer.publicKey,
            nickname: winnerPlayer.nickname || 'Winner'
          };
        }
      }

      // Map blockchain state to UI state
      const mapState = (state: string): 'waiting' | 'in_progress' | 'completed' => {
        switch (state) {
          case 'WaitingForPlayers': return 'waiting';
          case 'InProgress': return 'in_progress';
          case 'Finished': return 'completed';
          default: return 'waiting';
        }
      };

      const convertedGameData: GameData = {
        id: gameId,
        state: mapState(gameDetails.state),
        currentRound: gameDetails.current_round ?? 0,
        maxPlayers: gameDetails.max_players ?? 8,
        players,
        winner
      };

      console.log('Converted game data:', convertedGameData);
      setGameData(convertedGameData);
    } catch (err) {
      console.error('Error fetching game data:', err);
      setError('Failed to load game data. Please try again.');
      setGameData(null);
      setRawGameData(null);
    } finally {
      setLoading(false);
    }
  }, [activeClient, gameId]);


  // Initial fetch
  useEffect(() => {
    fetchGameData();
  }, [fetchGameData]);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchGameData();
    }, autoRefresh);

    return () => clearInterval(interval);
  }, [autoRefresh, fetchGameData]);

  return {
    gameData,
    rawGameData,
    loading,
    error,
    refresh: fetchGameData
  };
}
