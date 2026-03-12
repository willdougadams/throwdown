import { theme } from '../theme';
import { generateReadableName } from '../utils/nameGenerator';

interface WalletDisplayProps {
  publicKey: string;
  isWinner?: boolean;
  isCurrentUser?: boolean;
}

export function WalletDisplay({ publicKey, isWinner, isCurrentUser }: WalletDisplayProps) {
  return (
    <span 
      title={publicKey}
      style={{
        fontFamily: 'monospace',
        fontSize: '0.875rem',
        fontWeight: isWinner || isCurrentUser ? 600 : 400,
        color: isWinner ? '#4caf50' : (isCurrentUser ? theme.colors.primary.main : 'inherit')
      }}
    >
      {generateReadableName(publicKey)}{isCurrentUser ? ' (You)' : ''}
    </span>
  );
}
