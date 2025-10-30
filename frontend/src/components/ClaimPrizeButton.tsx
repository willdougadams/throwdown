import React from 'react';
import { theme } from '../theme';

interface ClaimPrizeButtonProps {
  gameState: 'waiting' | 'in_progress' | 'completed';
  winnerPublicKey?: string;
  currentUserPublicKey: string | null;
  onClaimPrize: () => void;
}

export function ClaimPrizeButton({
  gameState,
  winnerPublicKey,
  currentUserPublicKey,
  onClaimPrize
}: ClaimPrizeButtonProps) {
  const shouldShow = gameState === 'completed' && winnerPublicKey && winnerPublicKey === currentUserPublicKey;

  if (!shouldShow) return null;

  return (
    <div style={{
      textAlign: 'center',
      padding: theme.spacing.xl,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.xl,
      margin: `${theme.spacing.xl} 0`,
      boxShadow: '0 4px 16px rgba(255, 215, 0, 0.2)'
    }}>
      <h2 style={{ color: '#ffd700', marginBottom: theme.spacing.lg }}>Congratulations!</h2>
      <p style={{ color: theme.colors.text.secondary, marginBottom: theme.spacing.xl }}>
        You won the tournament! Click below to claim your prize.
      </p>
      <button
        onClick={onClaimPrize}
        style={{
          padding: `${theme.spacing.md} ${theme.spacing.xl}`,
          backgroundColor: '#ffd700',
          color: '#000',
          border: 'none',
          borderRadius: theme.borderRadius.md,
          cursor: 'pointer',
          fontSize: theme.fontSize.xl,
          fontWeight: theme.fontWeight.bold
        }}
      >
        Claim Prize
      </button>
    </div>
  );
}
