import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Swords, Grip, Trees, PlayCircle } from 'lucide-react';
import { theme } from '../theme';

interface GameCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  color: string;
}

const GameCard: React.FC<GameCardProps> = ({ title, description, icon, path, color }) => {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(path)}
      style={{
        backgroundColor: theme.colors.card,
        borderRadius: '12px',
        padding: '1.5rem',
        cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s',
        border: `1px solid ${theme.colors.border}`,
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        height: '100%'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)';
        e.currentTarget.style.borderColor = color;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.borderColor = theme.colors.border;
      }}
    >
      <div style={{
        backgroundColor: `${color}20`,
        width: '48px',
        height: '48px',
        borderRadius: '10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: color
      }}>
        {icon}
      </div>
      <div>
        <h3 style={{ margin: '0 0 0.5rem 0', color: theme.colors.text.primary }}>{title}</h3>
        <p style={{ margin: 0, color: theme.colors.text.secondary, fontSize: '0.95rem', lineHeight: '1.5' }}>
          {description}
        </p>
      </div>
      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', color: color, fontWeight: 'bold', fontSize: '0.9rem' }}>
        Play Now <PlayCircle size={16} />
      </div>
    </div>
  );
};

export default function LandingPage() {
  return (
    <div style={{
      maxWidth: '1000px',
      margin: '0 auto',
      padding: '2rem 1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '3rem'
    }}>
      {/* Hero Section */}
      <div style={{ textAlign: 'center' }}>
        <h1 style={{
          fontSize: '3rem',
          fontWeight: '800',
          marginBottom: '1rem',
          background: `linear-gradient(135deg, ${theme.colors.primary.main}, ${theme.colors.secondary.main})`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: '-0.02em'
        }}>
          Welcome to Skrim
        </h1>
        <p style={{
          fontSize: '1.25rem',
          color: theme.colors.text.secondary,
          maxWidth: '600px',
          margin: '0 auto',
          lineHeight: '1.6'
        }}>
          The ultimate decentralized gaming arena on Solana. Compete, collaborate, and win prizes in our suite of on-chain games.
        </p>
      </div>

      {/* Games Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '1.5rem'
      }}>
        <GameCard
          title="Rock Paper Scissors"
          description="1v1 RPS with SOL prizes. Join a match, commit your moves, and win the prize pool."
          icon={<Swords size={24} />}
          path="/rps-lobby"
          color={theme.colors.primary.main}
        />
        <GameCard
          title="Idiot Chess"
          description="A chaotic and hilarious twist on the classic game of chess. Expect the unexpected in every move."
          icon={<Grip size={24} />}
          path="/idiot-chess"
          color={theme.colors.secondary.main}
        />
        <GameCard
          title="Great Banyan"
          description="Collaborate with other players to grow a massive, persistent tree on the blockchain. Water, prune, and prosper."
          icon={<Trees size={24} />}
          path="/great-banyan"
          color="#10b981"
        />
      </div>

      {/* Stats/Info Section */}
      <div style={{
        backgroundColor: theme.colors.surface,
        borderRadius: '16px',
        padding: '2rem',
        border: `1px solid ${theme.colors.border}`,
        textAlign: 'center'
      }}>
        <h2 style={{ color: theme.colors.text.primary, marginBottom: '1.5rem' }}>Why Skrim?</h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '2rem'
        }}>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: theme.colors.primary.main, marginBottom: '0.5rem' }}>Fully On-Chain</div>
            <p style={{ color: theme.colors.text.secondary, margin: 0, fontSize: '0.9rem' }}>All game logic and states are secured by Solana smart contracts.</p>
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: theme.colors.primary.main, marginBottom: '0.5rem' }}>Fair Play</div>
            <p style={{ color: theme.colors.text.secondary, margin: 0, fontSize: '0.9rem' }}>Provably fair gaming using commit-reveal schemes and decentralized randomness.</p>
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: theme.colors.primary.main, marginBottom: '0.5rem' }}>Instant Payouts</div>
            <p style={{ color: theme.colors.text.secondary, margin: 0, fontSize: '0.9rem' }}>Prizes are distributed automatically to winners via the blockchain.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
