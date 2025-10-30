import React from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../theme';
import { Users, Trophy, Coins } from 'lucide-react';

interface GameListItem {
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

interface GameRowProps {
  game: GameListItem;
}

// Helper to format prize pool amounts
const formatAmount = (amount: number) => {
  return amount % 1 === 0 ? amount.toString() : amount.toFixed(2);
};

// Reusable display components
const DataItem: React.FC<{
  icon?: React.ReactNode;
  label: string;
  value: string;
  valueColor?: string;
  valueSize?: string;
}> = ({ icon, label, value, valueColor = theme.colors.text.primary, valueSize = '1.3rem' }) => (
  <div style={{ textAlign: 'center' }}>
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.25rem',
      color: theme.colors.text.disabled,
      fontSize: '0.75rem',
      marginBottom: '0.25rem'
    }}>
      {icon}
      {label}
    </div>
    <div style={{ fontSize: valueSize, fontWeight: '700', color: valueColor }}>
      {value}
    </div>
  </div>
);

const PrizePoolDisplay: React.FC<{ amount: number }> = ({ amount }) => (
  <DataItem
    icon={<Trophy size={12} />}
    label="Prize Pool"
    value={`◎${formatAmount(amount)}`}
    valueColor={theme.colors.secondary.main}
  />
);

const BuyInDisplay: React.FC<{ amount: number }> = ({ amount }) => (
  <DataItem
    icon={<Coins size={12} />}
    label="Buy-in"
    value={`◎${amount}`}
  />
);

const SlotsLeftDisplay: React.FC<{ slotsLeft: number; maxPlayers: number }> = ({ slotsLeft, maxPlayers }) => (
  <DataItem
    icon={<Users size={12} />}
    label="Slots Left"
    value={`${slotsLeft}/${maxPlayers}`}
  />
);

const RoundDisplay: React.FC<{ currentRound: number; totalRounds: number }> = ({ currentRound, totalRounds }) => (
  <DataItem
    label="Current Round"
    value={`Round ${currentRound + 1} of ${totalRounds}`}
    valueColor={theme.colors.primary.main}
  />
);

const WinnerDisplay: React.FC<{ winner: string; prizeAmount: number }> = ({ winner, prizeAmount }) => (
  <DataItem
    icon={<Trophy size={12} />}
    label="Winner"
    value={`${winner.slice(0, 4)}...${winner.slice(-4)}`}
  />
);

const GameRow: React.FC<GameRowProps> = ({ game }) => {
  const navigate = useNavigate();

  const handleGameClick = () => {
    navigate(`/game/${game.id}`);
  };

  const slotsLeft = game.maxPlayers - game.players.length;

  // Render status-specific content
  const renderContent = () => {
    switch (game.status) {
      case 'waiting':
        return (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1rem'
          }}>
            <BuyInDisplay amount={game.buyInSOL} />
            <PrizePoolDisplay amount={game.prizePool} />
            <SlotsLeftDisplay slotsLeft={slotsLeft} maxPlayers={game.maxPlayers} />
          </div>
        );

      case 'in_progress':
        return (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '1.5rem'
          }}>
            <PrizePoolDisplay amount={game.prizePool} />
            <RoundDisplay currentRound={game.currentRound ?? 0} totalRounds={game.totalRounds ?? 0} />
          </div>
        );

      case 'completed':
        return <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '1.5rem'
          }}>
            <PrizePoolDisplay amount={game.prizePool} />
            <WinnerDisplay winner={game.winner ?? 'Unknown'} prizeAmount={game.prizePool} />
          </div>
        ;

      default:
        return null;
    }
  };

  return (
    <div
      onClick={handleGameClick}
      style={{
        backgroundColor: theme.colors.card,
        border: `2px solid ${theme.colors.border}`,
        borderRadius: '8px',
        padding: '1.25rem',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        position: 'relative',
        overflow: 'hidden'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = theme.colors.primary.main;
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = theme.colors.border;
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '0.75rem', textAlign: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '600', color: theme.colors.text.primary, marginBottom: '0.25rem' }}>
          {game.name}
        </h3>
        <p style={{ margin: 0, fontSize: '0.9rem', color: theme.colors.text.secondary, lineHeight: '1.4' }}>
          {game.description}
        </p>
      </div>

      {/* Status-specific Info */}
      <div style={{
        padding: '1rem',
        backgroundColor: theme.colors.surface,
        borderRadius: '6px',
        marginTop: '1rem'
      }}>
        {renderContent()}
      </div>
    </div>
  );
};

export default GameRow;
