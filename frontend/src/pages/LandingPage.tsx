import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Swords, Grip, Trees, PlayCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';
import { ConstructionBanner, BanyanLogo } from '../components';

interface GameCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  color: string;
}

const GameCard: React.FC<GameCardProps> = ({ title, description, icon, path, color }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

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
        {t('landing.play_now')} <PlayCircle size={16} />
      </div>
    </div>
  );
};

export default function LandingPage() {
  const { t } = useTranslation();

  return (
    <div style={{
      maxWidth: '1000px',
      margin: '0 auto',
      padding: '2rem 1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '3rem'
    }}>
      <ConstructionBanner />

      {/* Hero Branding */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1.5rem',
          marginBottom: '2rem',
          color: theme.colors.text.primary
        }}>
          <BanyanLogo size={80} />
          <span style={{
            fontSize: '5rem',
            fontWeight: '900',
            letterSpacing: '-0.05em',
            lineHeight: 1
          }}>SKRIM</span>
        </div>
      </div>

      {/* Games Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '1.5rem'
      }}>
        <GameCard
          title={t('landing.games.rps.title')}
          description={t('landing.games.rps.description')}
          icon={<Swords size={24} />}
          path="/rps-lobby"
          color={theme.colors.primary.main}
        />
        <GameCard
          title={t('landing.games.chess.title')}
          description={t('landing.games.chess.description')}
          icon={<Grip size={24} />}
          path="/idiot-chess-lobby"
          color={theme.colors.secondary.main}
        />
        <GameCard
          title={t('landing.games.banyan.title')}
          description={t('landing.games.banyan.description')}
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
        <h2 style={{ color: theme.colors.text.primary, marginBottom: '1.5rem' }}>{t('landing.why_skrim.title')}</h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '2rem'
        }}>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: theme.colors.primary.main, marginBottom: '0.5rem' }}>{t('landing.why_skrim.on_chain.title')}</div>
            <p style={{ color: theme.colors.text.secondary, margin: 0, fontSize: '0.9rem' }}>{t('landing.why_skrim.on_chain.description')}</p>
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: theme.colors.primary.main, marginBottom: '0.5rem' }}>{t('landing.why_skrim.fair_play.title')}</div>
            <p style={{ color: theme.colors.text.secondary, margin: 0, fontSize: '0.9rem' }}>{t('landing.why_skrim.fair_play.description')}</p>
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: theme.colors.primary.main, marginBottom: '0.5rem' }}>{t('landing.why_skrim.payouts.title')}</div>
            <p style={{ color: theme.colors.text.secondary, margin: 0, fontSize: '0.9rem' }}>{t('landing.why_skrim.payouts.description')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
