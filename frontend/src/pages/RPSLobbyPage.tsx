import { useState, useEffect, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { createWeb3ProgramClient } from '../services/web3ProgramClient';
import { GameService } from '../services/gameService';
import { Swords, Zap, Wind, Sparkles, X, Circle, FileText, Scissors } from 'lucide-react';
import { theme } from '../theme';
import { useToast } from '../contexts/ToastContext';


// NewGameConfig removed

// NewGameModal removed
interface Challenge {
  id: string;
  creator: string;
  name: string;
  buyInSOL: number;
  players: string[];
  status: 'waiting' | 'in_progress' | 'completed';
  winner?: string;
  lamports: number;
}

function CreateChallengeModal({ isOpen, onClose, onCreate }: {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (entryFee: number, moves: number[]) => void;
}) {
  const { t } = useTranslation();
  const [entryFee, setEntryFee] = useState(0.1);
  const [moves, setMoves] = useState<number[]>([]);
  const [step, setStep] = useState<'config' | 'moves'>('config');

  if (!isOpen) return null;

  const handleMoveSelect = (index: number, move: number) => {
    const newMoves = [...moves];
    newMoves[index] = move;
    setMoves(newMoves);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      padding: '1rem', backdropFilter: 'blur(8px)'
    }}>
      <div style={{
        backgroundColor: theme.colors.surface, padding: '2rem',
        borderRadius: '16px', maxWidth: '500px', width: '100%',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)', border: `1px solid ${theme.colors.border} `
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <h2 style={{ color: theme.colors.text.primary, margin: 0 }}>{t('rps.create_modal.title')}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: theme.colors.text.secondary, cursor: 'pointer' }} aria-label={t('common.cancel')}><X size={24} /></button>
        </div>

        {step === 'config' ? (
          <div>
            <label style={{ color: theme.colors.text.secondary, display: 'block', marginBottom: '0.5rem' }}>{t('rps.create_modal.entry_fee')}</label>
            <input
              type="number"
              value={entryFee}
              onChange={e => setEntryFee(parseFloat(e.target.value))}
              style={{
                width: '100%', padding: '1rem', borderRadius: '8px',
                backgroundColor: theme.colors.background, border: `1px solid ${theme.colors.border} `,
                color: theme.colors.text.primary, fontSize: '1.1rem', marginBottom: '2rem'
              }}
            />
            <button
              onClick={() => setStep('moves')}
              style={{
                width: '100%', padding: '1rem', backgroundColor: theme.colors.primary.main,
                color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer'
              }}
            >
              {t('rps.create_modal.continue_moves')}
            </button>
          </div>
        ) : (
          <div>
            <p style={{ color: theme.colors.text.secondary, marginBottom: '1.5rem' }}>{t('rps.create_modal.select_moves')}</p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginBottom: '2rem' }}>
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  backgroundColor: moves[i] !== undefined ? theme.colors.success : theme.colors.border,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.8rem'
                }}>
                  {i + 1}
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {(['rock', 'paper', 'scissors'] as const).map((m) => {
                const Icon = m === 'rock' ? Circle : m === 'paper' ? FileText : Scissors;
                const idx = m === 'rock' ? 0 : m === 'paper' ? 1 : 2;
                return (
                  <button
                    key={m}
                    onClick={() => {
                      if (moves.length < 5) handleMoveSelect(moves.length, idx);
                    }}
                    style={{
                      aspectRatio: '1', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                      borderRadius: '12px', border: `2px solid ${theme.colors.border} `,
                      backgroundColor: theme.colors.background, color: theme.colors.text.primary,
                      cursor: moves.length < 5 ? 'pointer' : 'not-allowed',
                      fontSize: '0.8rem', fontWeight: 'bold'
                    }}
                  >
                    <Icon size={24} fill={m === 'rock' ? 'currentColor' : 'none'} />
                    {t(`rps.game.moves.${m}`)}
                  </button>
                );
              })}
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '2rem',
              opacity: moves.length === 0 ? 0.4 : 1,
              pointerEvents: moves.length === 0 ? 'none' : 'auto'
            }}>
              {(['fury', 'serenity', 'trickery'] as const).map((s) => {
                const Icon = s === 'fury' ? Zap : s === 'serenity' ? Wind : Sparkles;
                const idx = s === 'fury' ? 3 : s === 'serenity' ? 4 : 5;
                return (
                  <button
                    key={s}
                    onClick={() => {
                      if (moves.length < 5) handleMoveSelect(moves.length, idx);
                    }}
                    style={{
                      aspectRatio: '1', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                      borderRadius: '12px', border: `2px solid ${theme.colors.border} `,
                      backgroundColor: theme.colors.background, color: theme.colors.text.primary,
                      cursor: moves.length < 5 ? 'pointer' : 'not-allowed',
                      fontSize: '0.8rem', fontWeight: 'bold'
                    }}
                  >
                    <Icon size={24} fill={s === 'fury' ? 'currentColor' : 'none'} />
                    {t(`rps.game.moves.${s} `)}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={() => setStep('config')} style={{ flex: 1, padding: '1rem', borderRadius: '8px', border: `1px solid ${theme.colors.border} `, background: 'none', color: theme.colors.text.secondary, cursor: 'pointer' }}>{t('rps.create_modal.back')}</button>
              <button
                onClick={() => onCreate(entryFee, moves)}
                disabled={moves.length < 5}
                style={{
                  flex: 2, padding: '1rem', backgroundColor: theme.colors.success,
                  color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold',
                  cursor: moves.length === 5 ? 'pointer' : 'not-allowed', opacity: moves.length === 5 ? 1 : 0.6
                }}
              >
                {t('rps.create_modal.create_for', { fee: entryFee })}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AcceptChallengeModal({ isOpen, onClose, onAccept, challenge }: {
  isOpen: boolean;
  onClose: () => void;
  onAccept: (moves: number[]) => void;
  challenge: Challenge | null;
}) {
  const { t } = useTranslation();
  const [moves, setMoves] = useState<number[]>([]);

  if (!isOpen || !challenge) return null;

  const handleMoveSelect = (index: number, move: number) => {
    const newMoves = [...moves];
    newMoves[index] = move;
    setMoves(newMoves);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      padding: '1rem', backdropFilter: 'blur(8px)'
    }}>
      <div style={{
        backgroundColor: theme.colors.surface, padding: '2rem',
        borderRadius: '16px', maxWidth: '500px', width: '100%',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)', border: `1px solid ${theme.colors.border} `
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <h2 style={{ color: theme.colors.text.primary, margin: 0 }}>{t('rps.accept_modal.title')}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: theme.colors.text.secondary, cursor: 'pointer' }} aria-label={t('common.cancel')}><X size={24} /></button>
        </div>

        <p style={{ color: theme.colors.text.secondary, marginBottom: '2rem' }}>
          {t('rps.accept_modal.intro', { creator: `${challenge.creator.slice(0, 4)}...${challenge.creator.slice(-4)}`, fee: challenge.buyInSOL })}
        </p>

        <p style={{ color: theme.colors.text.secondary, marginBottom: '1.5rem' }}>{t('rps.accept_modal.select_moves')}</p>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginBottom: '2rem' }}>
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} style={{
              width: '32px', height: '32px', borderRadius: '50%',
              backgroundColor: moves[i] !== undefined ? theme.colors.success : theme.colors.border,
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.8rem'
            }}>
              {i + 1}
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {(['rock', 'paper', 'scissors'] as const).map((m) => {
            const Icon = m === 'rock' ? Circle : m === 'paper' ? FileText : Scissors;
            const idx = m === 'rock' ? 0 : m === 'paper' ? 1 : 2;
            return (
              <button
                key={m}
                onClick={() => {
                  if (moves.length < 5) handleMoveSelect(moves.length, idx);
                }}
                style={{
                  aspectRatio: '1', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  borderRadius: '12px', border: `2px solid ${theme.colors.border} `,
                  backgroundColor: theme.colors.background, color: theme.colors.text.primary,
                  cursor: moves.length < 5 ? 'pointer' : 'not-allowed',
                  fontSize: '0.8rem', fontWeight: 'bold'
                }}
              >
                <Icon size={24} fill={m === 'rock' ? 'currentColor' : 'none'} />
                {t(`rps.game.moves.${m}`)}
              </button>
            );
          })}
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '2rem',
          opacity: moves.length === 0 ? 0.4 : 1,
          pointerEvents: moves.length === 0 ? 'none' : 'auto'
        }}>
          {(['fury', 'serenity', 'trickery'] as const).map((s) => {
            const Icon = s === 'fury' ? Zap : s === 'serenity' ? Wind : Sparkles;
            const idx = s === 'fury' ? 3 : s === 'serenity' ? 4 : 5;
            return (
              <button
                key={s}
                onClick={() => {
                  if (moves.length < 5) handleMoveSelect(moves.length, idx);
                }}
                style={{
                  aspectRatio: '1', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  borderRadius: '12px', border: `2px solid ${theme.colors.border} `,
                  backgroundColor: theme.colors.background, color: theme.colors.text.primary,
                  cursor: moves.length < 5 ? 'pointer' : 'not-allowed',
                  fontSize: '0.8rem', fontWeight: 'bold'
                }}
              >
                <Icon size={24} fill={s === 'fury' ? 'currentColor' : 'none'} />
                {t(`rps.game.moves.${s} `)}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => onAccept(moves)}
          disabled={moves.length < 5}
          style={{
            width: '100%', padding: '1rem', backgroundColor: theme.colors.primary.main,
            color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold',
            cursor: moves.length === 5 ? 'pointer' : 'not-allowed', opacity: moves.length === 5 ? 1 : 0.6
          }}
        >
          {t('rps.accept_modal.join_submit')}
        </button>
      </div>
    </div>
  );
}


export default function RPSLobbyPage() {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const wallet = useWallet();
  const { showToast, updateToast } = useToast();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [acceptingChallenge, setAcceptingChallenge] = useState<Challenge | null>(null);

  const refreshChallenges = useCallback(async () => {
    try {
      const rpsService = new GameService(connection);
      const allGames = await rpsService.getFormattedGamesForLobby();
      setChallenges(allGames.filter(g =>
        g.status === 'waiting' ||
        (publicKey && g.players.includes(publicKey.toString()))
      ) as any);
    } catch (e) {
      console.error('Failed to refresh challenges:', e);
    }
  }, [connection, publicKey]);

  useEffect(() => {
    refreshChallenges();
    const interval = setInterval(refreshChallenges, 10000);
    return () => clearInterval(interval);
  }, [refreshChallenges]);

  const handleCreateChallenge = async (fee: number, moves: number[]) => {
    if (!publicKey) return;
    const toastId = showToast(t('rps.toasts.creating'), 'loading');
    try {
      const client = createWeb3ProgramClient(connection, wallet);
      const salt = BigInt(Math.floor(Math.random() * 1000000)); // Simple salt for now

      const result = await client.createChallenge({
        entryFee: fee,
        gameName: `Challenge by ${publicKey.toString().slice(0, 4)}`,
        moves: moves,
        salt: salt
      });

      // Save moves to localStorage for Reveal phase
      const moveMapping = ['rock', 'paper', 'scissors', 'fury', 'serenity', 'trickery'];
      const key = `${publicKey.toString()}-${result.gameId}-0`;
      localStorage.setItem(key, JSON.stringify({
        moves: moves.map(m => moveMapping[m]),
        salt: salt.toString(),
        timestamp: Date.now()
      }));

      updateToast(toastId, t('rps.toasts.created'), 'success');
      setShowCreateModal(false);
      navigate(`/game/${result.gameId}`);
    } catch (e: any) {
      console.error(e);
      updateToast(toastId, e.message || t('rps.toasts.create_failed'), 'error');
    }
  };

  const handleAcceptChallenge = async (moves: number[]) => {
    if (!publicKey || !acceptingChallenge) return;
    const toastId = showToast(t('rps.toasts.accepting'), 'loading');
    try {
      const client = createWeb3ProgramClient(connection, wallet);
      await client.acceptChallenge(acceptingChallenge.id, moves);

      // Save moves to localStorage so they show up in UI
      const moveMapping = ['rock', 'paper', 'scissors', 'fury', 'serenity', 'trickery'];
      const key = `${publicKey.toString()}-${acceptingChallenge.id}-0`;
      localStorage.setItem(key, JSON.stringify({
        moves: moves.map(m => moveMapping[m]),
        salt: "0", // No salt needed for acceptor but keep format
        timestamp: Date.now()
      }));

      updateToast(toastId, t('rps.toasts.accepted'), 'success');
      navigate(`/game/${acceptingChallenge.id}`);
    } catch (e: any) {
      console.error(e);
      updateToast(toastId, e.message || t('rps.toasts.accept_failed'), 'error');
    }
  };

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div style={{ padding: isMobile ? '0.5rem' : '1rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        marginBottom: '2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        padding: '1rem',
        backgroundColor: theme.colors.surface,
        borderRadius: '12px',
        border: `1px solid ${theme.colors.border} `
      }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: theme.colors.text.primary, fontSize: isMobile ? '1.5rem' : '2rem', margin: 0 }}>
            <Swords size={isMobile ? 24 : 32} color={theme.colors.primary.main} /> {t('rps.lobby.title')}
          </h1>
          <p style={{ margin: '0.5rem 0 0 0', color: theme.colors.text.secondary }}>
            {t('rps.lobby.subtitle')}
          </p>
        </div>
        {/* Create Tournament button removed */}
      </div>

      <div style={{
        padding: '1rem', backgroundColor: theme.colors.surface, borderRadius: '12px', border: `1px solid ${theme.colors.border} `
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ color: theme.colors.text.primary, margin: 0 }}>{t('rps.lobby.open_challenges')}</h2>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              padding: '0.8rem 1.5rem', backgroundColor: theme.colors.primary.main, color: 'white',
              border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
            }}
          >
            {t('rps.lobby.create_challenge')}
          </button>
        </div>

        {challenges.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: theme.colors.text.secondary }}>
            {t('rps.lobby.no_challenges')}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: isMobile ? '1' : 'repeat(auto-fill, minmax(300px, 1fr))' }}>
            {challenges.map(c => (
              <div key={c.id} style={{
                padding: '1.5rem', borderRadius: '12px', backgroundColor: theme.colors.background,
                border: `1px solid ${theme.colors.border} `, display: 'flex', flexDirection: 'column', gap: '1rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: theme.colors.primary.main, fontWeight: 'bold' }}>{t('common.sol_match', { fee: c.buyInSOL })}</span>
                  <span style={{ color: theme.colors.text.secondary, fontSize: '0.8rem' }}>{c.creator.slice(0, 6)}...</span>
                </div>
                <button
                  onClick={() => {
                    const isCreator = publicKey && c.creator === publicKey.toString();
                    const isWinner = publicKey && c.winner === publicKey.toString();
                    const isUnclaimed = c.lamports > 1000000; // ~0.001 SOL threshold for rent+prize

                    if (c.status === 'waiting' && !isCreator) {
                      setAcceptingChallenge(c);
                    } else if (c.status === 'in_progress' && isCreator) {
                      navigate(`/game/${c.id}`);
                    } else if (c.status === 'completed' && isWinner && isUnclaimed) {
                      navigate(`/game/${c.id}`); // Game page handles claiming
                    } else {
                      navigate(`/game/${c.id}`);
                    }
                  }}
                  style={{
                    padding: '0.8rem',
                    backgroundColor: (() => {
                      const isCreator = publicKey && c.creator === publicKey.toString();
                      const isWinner = publicKey && c.winner === publicKey.toString();
                      const isUnclaimed = c.lamports > 1000000;

                      if (c.status === 'waiting' && !isCreator) return theme.colors.success;
                      if (c.status === 'in_progress' && isCreator) return theme.colors.primary.main;
                      if (c.status === 'completed' && isWinner && isUnclaimed) return '#d4af37'; // Gold for Claim
                      return theme.colors.text.secondary; // Gray for View
                    })(),
                    color: 'white', border: 'none', borderRadius: '8px',
                    cursor: 'pointer', fontWeight: 'bold'
                  }}
                >
                  {(() => {
                    const isCreator = publicKey && c.creator === publicKey.toString();
                    const isWinner = publicKey && c.winner === publicKey.toString();
                    const isUnclaimed = c.lamports > 1000000;

                    if (c.status === 'waiting' && !isCreator) return t('rps.lobby.accept_challenge');
                    if (c.status === 'in_progress' && isCreator) return t('rps.lobby.reveal');
                    if (c.status === 'completed' && isWinner && isUnclaimed) return t('rps.lobby.claim');
                    return t('rps.lobby.view');
                  })()}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <CreateChallengeModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateChallenge}
      />

      <AcceptChallengeModal
        isOpen={!!acceptingChallenge}
        onClose={() => setAcceptingChallenge(null)}
        onAccept={handleAcceptChallenge}
        challenge={acceptingChallenge}
      />
    </div>
  );
}
