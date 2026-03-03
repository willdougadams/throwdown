import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useTranslation } from 'react-i18next';
import { createWeb3ProgramClient } from '../services/web3ProgramClient';
import { MatchupDisplay } from '../components/MatchupDisplay';
import { MoveSubmissionModal } from '../components/MoveSubmissionModal';
import { Timer } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { theme } from '../theme';

type Move = 'rock' | 'paper' | 'scissors' | 'fury' | 'serenity' | 'trickery';

// Local storage utility functions for moves
const getMovesStorageKey = (userPubkey: string, gameId: string, round: number) => {
  return `${userPubkey}-${gameId}-${round}`;
};

const saveMovesToLocalStorage = (userPubkey: string, gameId: string, round: number, moves: Move[], salt: bigint) => {
  const key = getMovesStorageKey(userPubkey, gameId, round);
  const data = {
    moves,
    salt: salt.toString(),
    timestamp: Date.now()
  };
  localStorage.setItem(key, JSON.stringify(data));
  console.log('Saved moves to localStorage:', { key, data });
};

const loadMovesFromLocalStorage = (userPubkey: string, gameId: string, round: number) => {
  const key = getMovesStorageKey(userPubkey, gameId, round);
  const stored = localStorage.getItem(key);
  if (!stored) return null;

  try {
    const data = JSON.parse(stored);
    return {
      moves: data.moves as Move[],
      salt: BigInt(data.salt),
      timestamp: data.timestamp
    };
  } catch (error) {
    console.error('Error parsing stored moves:', error);
    return null;
  }
};

export default function GamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const wallet = useWallet();
  const { publicKey } = wallet;
  const { connection } = useConnection();
  const { showToast, updateToast } = useToast();
  const { t } = useTranslation();

  // Essential state only
  const [selectedMoves, setSelectedMoves] = useState<Move[]>([]);
  const [moveSalt, setMoveSalt] = useState<bigint | null>(null);
  const [showMoveModal, setShowMoveModal] = useState(false);

  // Game data state (still managed locally since useGameData hook uses different API)
  const [gameData, setGameData] = useState<any>(null);
  const [rawGameData, setRawGameData] = useState<any>(null);
  const [gameAccountBalance, setGameAccountBalance] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastActionTimestamp, setLastActionTimestamp] = useState<number>(0);

  // Fetch game data
  const fetchGameData = async () => {
    if (!connection || !gameId) {
      console.log('No connection or gameId available');
      return;
    }

    console.log('Fetching game data for:', gameId);
    setLoading(true);
    setError(null);

    try {
      const { GameService } = await import('../services/gameService');
      const gameService = new GameService(connection);
      const gameDetails = await gameService.fetchGameDetails(gameId);

      if (!gameDetails) {
        setError(t('rps.game.not_found'));
        return;
      }

      console.log('Raw game details:', gameDetails);
      setRawGameData(gameDetails);
      setLastActionTimestamp(gameDetails.last_action_timestamp || 0);

      // Fetch the actual account balance to detect if prize was claimed
      try {
        const { PublicKey } = await import('@solana/web3.js');
        const gamePubkey = new PublicKey(gameId);
        const accountInfo = await connection.getAccountInfo(gamePubkey);
        if (accountInfo) {
          setGameAccountBalance(accountInfo.lamports);
        }
      } catch (balanceError) {
        console.error('Error fetching account balance:', balanceError);
      }

      // Convert blockchain data to GameData format
      // IMPORTANT: Use player.slot, not array index, since players can join specific slots
      const players = gameDetails.players?.map((player: any) => ({
        id: player.slot.toString(),
        publicKey: player.pubkey || player.toString(),
        nickname: `Slot ${player.slot + 1}`,
        eliminated: player.eliminated,
        slot: player.slot  // Preserve the slot number
      })) || [];

      // Find the winner (only non-eliminated player when game is finished)
      let winner = undefined;
      if (gameDetails.state === 'Finished') {
        const winnerPlayer = players.find((p: any) => !p.eliminated);
        if (winnerPlayer) {
          winner = {
            id: winnerPlayer.id,
            publicKey: winnerPlayer.publicKey,
            nickname: winnerPlayer.nickname || 'Winner'
          };
          console.log('Winner detected:', winner);
        }
      }

      const mapBlockchainStateToUI = (state: string) => {
        switch (state) {
          case 'WaitingForPlayers': return 'waiting';
          case 'InProgress': return 'in_progress';
          case 'Finished': return 'completed';
          default: return 'waiting';
        }
      };

      const convertedGameData = {
        id: gameId,
        state: mapBlockchainStateToUI(gameDetails.state),
        maxPlayers: gameDetails.max_players ?? 2,
        players,
        winner
      };

      console.log('Converted game data:', convertedGameData);
      setGameData(convertedGameData);
    } catch (err) {
      console.error('Error fetching game data:', err);
      setError(t('rps.game.load_failed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGameData();
  }, [connection, gameId]);

  // Load moves from localStorage when game data changes
  useEffect(() => {
    if (!publicKey || !gameId || !gameData) return;

    const storedMoves = loadMovesFromLocalStorage(publicKey.toString(), gameId, 0);

    if (storedMoves) {
      console.log('Loaded moves from localStorage:', storedMoves);
      setSelectedMoves(storedMoves.moves);
      setMoveSalt(storedMoves.salt);
    } else {
      console.log('No stored moves found for current round');
      setSelectedMoves([]);
      setMoveSalt(null);
    }
  }, [publicKey, gameId, gameData?.currentRound, gameData?.state]);

  // Helper functions
  const isUserInGame = () => {
    if (!publicKey || !rawGameData) return false;
    return rawGameData.players?.some((player: any) =>
      (player.pubkey || player.toString()) === publicKey.toString()
    );
  };

  const hasUserSubmittedMoves = () => {
    if (!publicKey || !rawGameData) return false;
    const userPlayer = rawGameData.players?.find((player: any) =>
      (player.pubkey || player.toString()) === publicKey.toString()
    );

    if (!userPlayer || !userPlayer.moves_committed) return false;

    const movesCommitted = Array.isArray(userPlayer.moves_committed)
      ? userPlayer.moves_committed
      : Array.from(userPlayer.moves_committed);

    return movesCommitted.some((byte: any) => {
      const byteValue = typeof byte === 'number' ? byte : parseInt(byte);
      return !isNaN(byteValue) && byteValue !== 0;
    });
  };

  const hasUserRevealedMoves = () => {
    if (!publicKey || !rawGameData) return false;
    const userPlayer = rawGameData.players?.find((player: any) =>
      (player.pubkey || player.toString()) === publicKey.toString()
    );
    // moves_revealed is now [move_index]
    return userPlayer && userPlayer.moves_revealed &&
      userPlayer.moves_revealed.some((m: any) => m !== null);
  };

  const hasOpponentSubmittedMoves = () => {
    if (!publicKey || !rawGameData) return false;

    // Find current user's slot index
    const userPlayer = rawGameData.players?.find((player: any) =>
      (player.pubkey || player.toString()) === publicKey.toString()
    );

    if (!userPlayer || userPlayer.slot === undefined) return false;

    // Opponent is simply the other player (slot 0 or 1)
    const opponentSlotIndex = userPlayer.slot === 0 ? 1 : 0;
    const opponentPlayer = rawGameData.players?.find((p: any) => p.slot === opponentSlotIndex);

    if (!opponentPlayer || !opponentPlayer.moves_committed) return false;

    const movesCommitted = Array.isArray(opponentPlayer.moves_committed)
      ? opponentPlayer.moves_committed
      : Array.from(opponentPlayer.moves_committed);

    return movesCommitted.some((byte: any) => {
      const byteValue = typeof byte === 'number' ? byte : parseInt(byte);
      return !isNaN(byteValue) && byteValue !== 0;
    });
  };

  // Action handlers
  const handleSubmitMoves = async () => {
    if (!publicKey || !gameId || selectedMoves.length !== 5) {
      showToast(t('rps.game.select_all_moves'), 'error');
      return;
    }

    const toastId = showToast(t('rps.toasts.joining_submitting'), 'loading');
    try {
      const programClient = createWeb3ProgramClient(connection, wallet);
      // Convert moves to numbers
      const moveNumbers = selectedMoves.map(move => {
        switch (move) {
          case 'rock': return 0;
          case 'paper': return 1;
          case 'scissors': return 2;
          case 'fury': return 3;
          case 'serenity': return 4;
          case 'trickery': return 5;
          default: return 0;
        }
      });

      await programClient.joinRPSGame(gameId, moveNumbers);
      updateToast(toastId, t('rps.toasts.joined'), 'success');
      await fetchGameData();
    } catch (error: any) {
      console.error('Error joining match:', error);
      updateToast(toastId, error.message || t('rps.toasts.join_failed'), 'error');
    }
  };

  const handleRevealMoves = async () => {
    if (!publicKey || !gameId || selectedMoves.length !== 5 || !moveSalt) {
      showToast(t('rps.game.no_moves_to_reveal'), 'error');
      return;
    }

    const toastId = showToast(t('rps.toasts.revealing'), 'loading');
    try {
      const programClient = createWeb3ProgramClient(connection, wallet);

      // Convert moves to numbers
      const moveNumbers = selectedMoves.map(move => {
        switch (move) {
          case 'rock': return 0;
          case 'paper': return 1;
          case 'scissors': return 2;
          case 'fury': return 3;
          case 'serenity': return 4;
          case 'trickery': return 5;
          default: return 0;
        }
      });

      await programClient.revealMoves(gameId, moveNumbers, moveSalt);
      updateToast(toastId, t('rps.toasts.revealed_auto'), 'success');
      await fetchGameData();
    } catch (error) {
      console.error('Error revealing moves:', error);
      updateToast(toastId, t('rps.toasts.reveal_failed'), 'error');
    }
  };

  const handleJoinMatch = async (slot: number) => {
    if (!publicKey) {
      showToast('Please connect your wallet', 'error');
      return;
    }
    // Only slot 2 (index 1) can be joined via RPS join flow
    if (slot !== 1) {
      showToast('You can only join slot 2', 'error');
      return;
    }
    setShowMoveModal(true);
  };

  const handleClaimPrize = async () => {
    if (!publicKey || !gameId) {
      showToast('Wallet not connected', 'error');
      return;
    }

    const toastId = showToast('Claiming prize...', 'loading');
    try {
      const programClient = createWeb3ProgramClient(connection, wallet);
      await programClient.claimPrize(gameId);
      updateToast(toastId, t('rps.toasts.claimed_congrats'), 'success');
      await fetchGameData();
    } catch (error: any) {
      console.error('Error claiming prize:', error);
      updateToast(toastId, t('rps.toasts.claim_failed_reason', { reason: error?.message || t('common.unknown_error') }), 'error');
    }
  };

  const handleMoveSelect = (index: number, move: Move) => {
    const newMoves = [...selectedMoves];
    newMoves[index] = move;
    setSelectedMoves(newMoves);
  };

  // Loading state
  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2 style={{ color: theme.colors.text.primary }}>{t('common.loading_game_data')}</h2>
        <div style={{
          display: 'inline-block',
          width: '40px',
          height: '40px',
          border: `4px solid ${theme.colors.border}`,
          borderTop: `4px solid ${theme.colors.primary.main}`,
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2 style={{ color: theme.colors.text.primary }}>{t('rps.game.error_loading')}</h2>
        <p style={{ color: theme.colors.error, marginBottom: '1rem' }}>{error}</p>
        <button
          onClick={fetchGameData}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: theme.colors.primary.main,
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginRight: '1rem'
          }}
        >
          {t('common.retry')}
        </button>
        <button
          onClick={() => navigate('/rps-lobby')}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: theme.colors.text.disabled,
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          {t('rps.game.back_to_lobby')}
        </button>
      </div>
    );
  }

  // No game data
  if (!gameData) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2 style={{ color: theme.colors.text.primary }}>{t('rps.game.not_found')}</h2>
        <button onClick={() => navigate('/rps-lobby')}>{t('rps.game.back_to_lobby')}</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem', minHeight: '100vh', backgroundColor: theme.colors.background }}>
      {/* Header */}
      <div style={{
        padding: '1rem',
        marginBottom: '1rem'
      }}>
        <h1 style={{ color: theme.colors.text.primary, margin: 0 }}>{t('rps.game.matchup_title')}</h1>
        {gameData.maxPlayers === 2 && gameData.state === 'in_progress' && (() => {
          const now = Math.floor(Date.now() / 1000);
          const deadline = lastActionTimestamp + 90;
          const isStalled = now >= deadline;

          return (
            <div style={{
              marginTop: '1rem',
              padding: theme.spacing.lg,
              backgroundColor: isStalled ? 'rgba(244, 67, 54, 0.1)' : 'rgba(33, 150, 243, 0.1)',
              borderRadius: theme.borderRadius.md,
              border: `2px solid ${isStalled ? theme.colors.error : theme.colors.primary.main}`,
              display: 'flex',
              flexDirection: 'column',
              gap: theme.spacing.sm
            }}>
              <div style={{
                color: isStalled ? theme.colors.error : theme.colors.primary.main,
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Timer size={20} />
                {isStalled ? t('rps.game.deadline.stalled') : t('rps.game.deadline.remaining', { time: new Date(deadline * 1000).toLocaleTimeString() })}
              </div>

              {isStalled && isUserInGame() && (
                <div style={{ marginTop: theme.spacing.sm }}>
                  <p style={{ color: theme.colors.text.secondary, marginBottom: theme.spacing.md }}>
                    {t('rps.game.deadline.stalled_note')}
                  </p>
                  <button
                    onClick={handleClaimPrize}
                    style={{
                      padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
                      backgroundColor: theme.colors.error,
                      color: 'white',
                      border: 'none',
                      borderRadius: theme.borderRadius.sm,
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    {t('rps.game.claim_refund')}
                  </button>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* 1v1 Matchup display with join functionality */}
      <MatchupDisplay
        gameData={gameData}
        rawGameData={rawGameData}
        currentUserPublicKey={publicKey?.toString() || null}
        onMatchupClick={() => setShowMoveModal(true)}
        onRefresh={fetchGameData}
        onJoin={handleJoinMatch}
        isUserInGame={isUserInGame()}
        onClaimPrize={handleClaimPrize}
        gameAccountBalance={gameAccountBalance}
      />

      {/* Move Selection Modal */}
      <MoveSubmissionModal
        isOpen={showMoveModal}
        onClose={() => setShowMoveModal(false)}
        gameState={gameData.state}
        hasUserSubmittedMoves={hasUserSubmittedMoves()}
        hasUserRevealedMoves={hasUserRevealedMoves()}
        hasOpponentSubmittedMoves={hasOpponentSubmittedMoves()}
        selectedMoves={selectedMoves}
        moveSalt={moveSalt}
        onMoveSelect={handleMoveSelect}
        onSubmitMoves={handleSubmitMoves}
        onRevealMoves={handleRevealMoves}
      />
    </div>
  );
}
