import { useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Circle, FileText, Scissors, Lock, HelpCircle, Minus, Zap, Wind, Sparkles } from 'lucide-react';
import { createWeb3ProgramClient } from '../services/web3ProgramClient';
import { useToast } from '../contexts/ToastContext';
import { WalletDisplay } from './WalletDisplay';
import { MatchupPlayerData, MatchState, GameState } from '../types/game';
import { theme } from '../theme';

const RockIcon = () => <Circle size={16} />;
const PaperIcon = () => <FileText size={16} />;
const ScissorsIcon = () => <Scissors size={16} />;

interface MatchupPlayerProps {
  playerData: MatchupPlayerData;
  matchState: MatchState;
  currentUserPublicKey: string | null;
  gameId: string;
  isUserInGame: boolean;
  gameState: GameState;
  onRefresh: () => void;
  onJoin?: (slot: number) => void;
}

export function MatchupPlayer({
  playerData,
  matchState,
  currentUserPublicKey,
  gameId,
  isUserInGame,
  gameState,
  onRefresh,
  onJoin
}: MatchupPlayerProps) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { publicKey } = wallet;
  const { showToast, updateToast } = useToast();
  const [isJoining, setIsJoining] = useState(false);

  const { player, moves, hasSubmitted, hasRevealed, isWinner } = playerData;
  const isCurrentUser = !!(player && currentUserPublicKey && player.publicKey === currentUserPublicKey);

  // Debug logging with timestamp to track multiple renders
  if (player) {
    console.log(`[${Date.now()}] MatchupPlayer render:`, {
      pubkey: player.publicKey.slice(0, 8),
      isCurrentUser,
      moves,
      movesCount: moves?.length,
      hasSubmitted,
      hasRevealed,
      matchState,
      gameId: gameId.slice(0, 8)
    });
  }

  // Handle joining a slot
  const handleJoinSlot = async () => {
    if (!publicKey || !connection || !wallet.signTransaction || !gameId || playerData.slot === undefined) {
      showToast('Please connect your wallet first', 'error');
      return;
    }

    if (isJoining) return;

    const toastId = showToast('Joining match...', 'loading');
    setIsJoining(true);

    try {
      const client = createWeb3ProgramClient(connection, wallet);
      if (onJoin) {
        onJoin(playerData.slot);
        setIsJoining(false);
        return;
      }
      // Fallback if no onJoin provided
      const defaultMoves = [0, 1, 2, 0, 1]; // Rock, Paper, Scissors, Rock, Paper
      await client.joinRPSGame(gameId, defaultMoves);
      updateToast(toastId, 'Successfully joined!', 'success');
      onRefresh();
    } catch (error) {
      console.error('Error joining game:', error);
      let errorMessage = 'Failed to join game';
      if (error instanceof Error) {
        if (error.message.includes('insufficient funds')) {
          errorMessage = 'Insufficient SOL';
        } else if (error.message.includes('User rejected')) {
          errorMessage = 'Cancelled';
        } else if (error.message.includes('already joined') || error.message.includes('already been processed')) {
          errorMessage = 'Already joined';
          onRefresh();
        } else if (error.message.includes('slot already taken')) {
          errorMessage = 'Slot taken';
          onRefresh();
        }
      }
      updateToast(toastId, errorMessage, 'error');
    } finally {
      setIsJoining(false);
    }
  };

  // Show join button if no player and slot is available
  const showJoinButton = !player && playerData.slot !== undefined && gameState === 'waiting' && !isUserInGame && publicKey;

  if (showJoinButton) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleJoinSlot();
        }}
        disabled={isJoining}
        style={{
          width: '100%',
          padding: '0.5rem',
          backgroundColor: isJoining ? '#ccc' : '#28a745',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: isJoining ? 'not-allowed' : 'pointer',
          fontSize: '0.875rem',
          fontWeight: 600
        }}
      >
        {isJoining ? 'Joining...' : `Join Slot ${(playerData.slot ?? 0) + 1}`}
      </button>
    );
  }

  // Render a single move icon
  const renderMoveIcon = (move: 'rock' | 'paper' | 'scissors' | 'fury' | 'serenity' | 'trickery') => {
    if (move === 'rock') return <RockIcon />;
    if (move === 'paper') return <PaperIcon />;
    if (move === 'scissors') return <ScissorsIcon />;
    if (move === 'fury') return <Zap size={16} />;
    if (move === 'serenity') return <Wind size={16} />;
    if (move === 'trickery') return <Sparkles size={16} />;
    return null;
  };

  // Determine which icons to show
  const renderIcons = () => {
    // Player revealed their moves
    if (moves && moves.length > 0) {
      console.log('Rendering move icons:', moves, 'isCurrentUser:', isCurrentUser);
      return (
        <div style={{ display: 'flex', gap: '4px', color: theme.colors.text.primary }}>
          {moves.map((move, idx) => (
            <span key={idx}>{renderMoveIcon(move)}</span>
          ))}
        </div>
      );
    }

    // Player committed but hasn't revealed
    if (hasSubmitted && !hasRevealed && matchState === 'waiting_for_reveals') {
      console.log('Rendering lock icon');
      return (
        <div style={{ position: 'relative', width: 20, height: 20 }}>
          <Lock size={20} style={{ position: 'absolute', color: theme.colors.text.secondary }} />
          <HelpCircle size={12} style={{ position: 'absolute', top: 4, left: 4, color: theme.colors.text.disabled }} />
        </div>
      );
    }

    // Player hasn't moved yet or waiting for moves
    console.log('Rendering minus icon');
    return <Minus size={20} style={{ color: theme.colors.text.disabled }} />;
  };

  if (!player) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem' }}>
        <span style={{ fontSize: '0.875rem', color: theme.colors.text.secondary }}>Waiting for Player</span>
        <Minus size={20} style={{ color: theme.colors.text.disabled }} />
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0.5rem',
      backgroundColor: isWinner ? 'rgba(76, 175, 80, 0.1)' : 'transparent',
      borderRadius: '4px'
    }}>
      <WalletDisplay
        publicKey={player.publicKey}
        isWinner={isWinner}
        isCurrentUser={isCurrentUser}
      />
      {renderIcons()}
    </div>
  );
}
