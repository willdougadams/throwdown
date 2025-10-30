import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { GameService } from '../services/gameService';

export interface GameListItem {
  id: string;
  name: string;
  description: string;
  status: 'waiting' | 'in_progress' | 'completed';
  players: string[];
  maxPlayers: number;
  createdAt: string;
  buyInSOL: number;
  creator: string;
  prizePool: number;
  currentRound?: number;
  totalRounds?: number;
  winner?: string;
}

export interface UserGame {
  id: string;
  status: 'waiting' | 'in_progress' | 'completed';
  maxPlayers: number;
  currentPlayers: number;
  isCreator: boolean;
  buyInSOL: number;
}

interface GamesContextType {
  allGames: GameListItem[];
  userGames: UserGame[];
  loading: boolean;
  error: string | null;
  refreshGames: () => Promise<void>;
}

const GamesContext = createContext<GamesContextType | undefined>(undefined);

export function GamesProvider({ children }: { children: React.ReactNode }) {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [allGames, setAllGames] = useState<GameListItem[]>([]);
  const [userGames, setUserGames] = useState<UserGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshGames = useCallback(async () => {
    if (!connection) {
      console.log('No connection available');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const gameService = new GameService(connection);

      // Fetch all games for the lobby
      const fetchedGames = await gameService.getFormattedGamesForLobby();
      console.log('Fetched games:', fetchedGames);
      setAllGames(fetchedGames);

      // If user is connected, filter their games
      if (publicKey) {
        const rawGames = await gameService.fetchAllGames();
        const userParticipatingGames = [];

        for (const game of rawGames) {
          const isCreator = game.creator === publicKey.toString();
          let isParticipating = isCreator;

          if (!isCreator) {
            try {
              const gameDetails = await gameService.fetchGameDetails(game.game_address);
              if (gameDetails && gameDetails.players) {
                isParticipating = gameDetails.players.some((player: any) =>
                  (player.pubkey || player.toString()) === publicKey.toString()
                );
              }
            } catch (error) {
              console.log('Error checking participation in game:', game.game_address);
            }
          }

          if (isParticipating) {
            userParticipatingGames.push({
              ...game,
              isCreator
            });
          }
        }

        const formattedUserGames: UserGame[] = userParticipatingGames.map((game: any) => ({
          id: game.game_address,
          status: game.state === 'WaitingForPlayers' ? 'waiting' :
                 game.state === 'Finished' ? 'completed' : 'in_progress',
          maxPlayers: game.max_players,
          currentPlayers: game.current_players,
          isCreator: game.isCreator,
          buyInSOL: parseFloat((Number(game.buy_in_lamports) / 1_000_000_000).toFixed(3))
        }));

        setUserGames(formattedUserGames);
      } else {
        setUserGames([]);
      }
    } catch (err) {
      console.error('Error fetching games:', err);
      setError('Failed to load games. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [connection, publicKey]);

  // Fetch games when connection or wallet changes
  useEffect(() => {
    refreshGames();
  }, [refreshGames]);

  return (
    <GamesContext.Provider value={{ allGames, userGames, loading, error, refreshGames }}>
      {children}
    </GamesContext.Provider>
  );
}

export function useGames() {
  const context = useContext(GamesContext);
  if (!context) {
    throw new Error('useGames must be used within GamesProvider');
  }
  return context;
}
