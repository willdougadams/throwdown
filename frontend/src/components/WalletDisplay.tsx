import React from 'react';

interface WalletDisplayProps {
  publicKey: string;
  isWinner?: boolean;
  isCurrentUser?: boolean;
}

export function WalletDisplay({ publicKey, isWinner, isCurrentUser }: WalletDisplayProps) {
  return (
    <span style={{
      fontFamily: 'monospace',
      fontSize: '0.875rem',
      fontWeight: isWinner ? 600 : 400,
      color: isWinner ? '#4caf50' : 'inherit'
    }}>
      {publicKey.slice(0, 4)}...{publicKey.slice(-4)}
    </span>
  );
}
