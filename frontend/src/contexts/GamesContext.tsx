import React, { createContext, useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useNetwork } from './NetworkContext';
import { GameListItem } from '../services/gameClient';

export interface EnrichedGame extends GameListItem {
  gameType: 'rps' | 'chess';
  isParticipating: boolean;
  isCreator: boolean;
}

interface GamesContextType {
  rpsGames: EnrichedGame[];
  chessGames: EnrichedGame[];
  allChallenges: EnrichedGame[];
  loading: boolean;
  error: string | null;
  refreshGames: () => Promise<void>;
}

const GamesContext = createContext<GamesContextType | undefined>(undefined);

export function GamesProvider({ children }: { children: React.ReactNode }) {
  const { connection, activeClient } = useNetwork();
  const { publicKey } = useWallet();

  const [rpsGames, setRpsGames] = useState<EnrichedGame[]>([]);
  const [chessGames, setChessGames] = useState<EnrichedGame[]>([]);
  const [allChallenges, setAllChallenges] = useState<EnrichedGame[]>([]);
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
      const [_rpsGames, _chessGames] = await Promise.all([
        activeClient.getLobbyGames('rps'),
        activeClient.getLobbyGames('chess')
      ]);

      const enrichGame = (game: GameListItem, type: 'rps' | 'chess'): EnrichedGame => {
        const isCreator = publicKey ? game.creator === publicKey.toString() : false;
        const isParticipating = publicKey ? game.players.includes(publicKey.toString()) : false;
        return {
          ...game,
          gameType: type,
          isCreator,
          isParticipating
        };
      };

      const mappedRpsGames = _rpsGames.map(g => enrichGame(g, 'rps'));
      const mappedChessGames = _chessGames.map(g => enrichGame(g, 'chess'));

      setRpsGames(mappedRpsGames);
      setChessGames(mappedChessGames);

    } catch (err) {
      console.error('Error fetching games:', err);
      setError('Failed to load games. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [connection, activeClient, publicKey]);

  // Derive merged challenges whenever rps or chess games change
  useEffect(() => {
    const validRpsGames = rpsGames.filter(g => g.status === 'waiting' || g.isParticipating);
    const validChessGames = chessGames.filter(g => g.status === 'waiting' || (g.status === 'in_progress' && g.isParticipating));

    const merged = [...validRpsGames, ...validChessGames];
    // Sort: waiting first, then by highest buy-in
    merged.sort((a, b) => {
      if (a.status === 'waiting' && b.status !== 'waiting') return -1;
      if (a.status !== 'waiting' && b.status === 'waiting') return 1;
      return b.buyInSOL - a.buyInSOL;
    });

    setAllChallenges(merged);
  }, [rpsGames, chessGames]);

  // Initial fetch and setup SSE listener
  useEffect(() => {
    refreshGames();
    
    let unsubscribe: (() => void) | undefined;
    if (activeClient.onBanyanUpdate) {
      unsubscribe = activeClient.onBanyanUpdate((event: any) => {
        if (event.type === 'game_update') {
          const game = event.data;
          const type = event.gameType;

          const isCreator = publicKey ? game.creator === publicKey.toString() : false;
          const isParticipating = publicKey ? game.player_addresses.includes(publicKey.toString()) : false;
          
          const enriched: EnrichedGame = {
              id: game.game_address,
              name: game.name,
              description: game.description,
              status: game.state === 'WaitingForPlayers' ? 'waiting' :
                  game.state === 'Finished' ? 'completed' : 'in_progress',
              players: game.player_addresses,
              maxPlayers: game.max_players,
              createdAt: new Date(game.last_action_timestamp * 1000).toISOString().split('T')[0],
              buyInSOL: Number(game.buy_in_lamports) / 1_000_000_000,
              creator: game.creator,
              prizePool: Number(game.prize_pool) / 1_000_000_000,
              winner: game.winner,
              lamports: game.lamports || 0,
              gameType: type,
              isCreator,
              isParticipating
          };

          if (type === 'rps') {
            setRpsGames(prev => {
              const idx = prev.findIndex(g => g.id === enriched.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = enriched;
                return next;
              }
              return [...prev, enriched];
            });
          } else if (type === 'chess') {
            setChessGames(prev => {
              const idx = prev.findIndex(g => g.id === enriched.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = enriched;
                return next;
              }
              return [...prev, enriched];
            });
          }
        }
      });
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [refreshGames, activeClient, publicKey]);

  return (
    <GamesContext.Provider value={{
      rpsGames,
      chessGames,
      allChallenges,
      loading,
      error,
      refreshGames
    }}>
      {children}
    </GamesContext.Provider>
  );
}

export function useGames() {
  const context = React.useContext(GamesContext);
  if (context === undefined) {
    throw new Error('useGames must be used within a GamesProvider');
  }
  return context;
}
