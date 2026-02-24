import React, { useState, useEffect, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createWeb3ProgramClient } from '../services/web3ProgramClient';
import { GameService } from '../services/gameService';
import { Swords, Grip, Timer, Users, Search } from 'lucide-react';
import { theme } from '../theme';
import { useToast } from '../contexts/ToastContext';
import { useGames } from '../contexts/GamesContext';


// NewGameConfig removed

// NewGameModal removed
function QuickplayModal({ isOpen, onClose, entryFee, status, onJoin, onLeave }: {
  isOpen: boolean;
  onClose: () => void;
  entryFee: number;
  status: 'idle' | 'searching' | 'matched';
  onJoin: () => void;
  onLeave: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem',
      backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        backgroundColor: theme.colors.surface,
        padding: '2rem',
        borderRadius: '16px',
        maxWidth: '400px',
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
        border: `1px solid ${theme.colors.border}`
      }}>
        <div style={{ marginBottom: '1.5rem' }}>
          {status === 'searching' ? (
            <div style={{ position: 'relative', width: '80px', height: '80px', margin: '0 auto' }}>
              <div className="searching-spinner" style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                border: `3px solid ${theme.colors.primary.main}`,
                borderTopColor: 'transparent',
                animation: 'spin 1s linear infinite'
              }} />
              <Search size={32} color={theme.colors.primary.main} style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)'
              }} />
            </div>
          ) : (
            <Users size={48} color={theme.colors.primary.main} style={{ margin: '0 auto' }} />
          )}
        </div>

        <h2 style={{ color: theme.colors.text.primary, marginBottom: '0.5rem' }}>
          {status === 'searching' ? 'Searching for Opponent...' : 'Quickplay Match'}
        </h2>

        <p style={{ color: theme.colors.text.secondary, marginBottom: '2rem' }}>
          {status === 'searching'
            ? `Waiting for someone to match your ${entryFee} SOL entry fee.`
            : `Instantly battle 1v1 for ${entryFee * 2} SOL prizes.`}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {status === 'idle' && (
            <button
              onClick={onJoin}
              style={{
                padding: '1rem',
                backgroundColor: theme.colors.primary.main,
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '1.1rem',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Join Matchmaking
            </button>
          )}

          {status === 'searching' && (
            <button
              onClick={onLeave}
              style={{
                padding: '0.75rem',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                color: theme.colors.text.primary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              Cancel Search
            </button>
          )}

          {status !== 'searching' && (
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: theme.colors.text.secondary,
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          )}
        </div>
      </div>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}


export default function RPSLobbyPage() {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const wallet = useWallet();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [showQuickplayModal, setShowQuickplayModal] = useState(false);
  const [status, setStatus] = useState<'idle' | 'searching' | 'matched'>('idle');
  const [waitingPlayers, setWaitingPlayers] = useState<any[]>([]);

  // handleGameCreated removed

  const handleJoinPool = async () => {
    if (!publicKey) return;
    try {
      const client = createWeb3ProgramClient(connection, wallet);
      const rpsService = new GameService(connection);

      setStatus('searching');
      setShowQuickplayModal(true);

      // 1. Scan for existing players
      const pool = await rpsService.fetchWaitingPool();
      const opponent = pool.find(p => p.player !== publicKey.toString() && Number(p.entry_fee) === 100_000_000);

      if (opponent) {
        showToast('Found opponent! Matching...', 'success');
        const matchResult = await client.matchPlayer(opponent.player, `Quickplay vs ${opponent.player.slice(0, 4)}`);
        setStatus('matched');
        navigate(`/game/${matchResult.gameId}`);
        return;
      }

      // 2. If no opponent, join pool
      await client.joinPool(0.1);
      showToast('Waiting for opponent...', 'success');
    } catch (e: any) {
      console.error(e);
      setStatus('idle');
      showToast(e.message || 'Failed to join matchmaking', 'error');
    }
  };

  const handleLeavePool = async () => {
    try {
      const client = createWeb3ProgramClient(connection, wallet);
      await client.leavePool();
      setStatus('idle');
      showToast('Left matchmaking pool', 'info');
    } catch (e) {
      console.error(e);
      showToast('Failed to leave pool', 'error');
    }
  };

  // Subscription to watch for matches
  useEffect(() => {
    if (status !== 'searching' || !publicKey) return;

    const rpsService = new GameService(connection);

    const interval = setInterval(async () => {
      // Check if our waiting account still exists
      const client = createWeb3ProgramClient(connection, wallet);
      const address = await client.getWaitingAccountAddress(publicKey);
      const info = await connection.getAccountInfo(address);

      if (!info) {
        // We've been matched! Our account was closed.
        // Now find the game we were matched into.
        // In a real app, we'd use a more robust way to find the game (e.g. index/registry or recent games)
        // For now, let's refresh games and look for one where we are player 2 and state is InProgress
        const games = await rpsService.fetchAllGames();
        const myGame = games.find(g =>
          g.state === 'InProgress' &&
          g.name.includes('Quickplay') // Could be more specific
        );

        if (myGame) {
          clearInterval(interval);
          setStatus('matched');
          showToast('Matched! Entering game...', 'success');
          navigate(`/game/${myGame.game_address}`);
        }
      }

      // Also update waiting player count
      const pool = await rpsService.fetchWaitingPool();
      setWaitingPlayers(pool);
    }, 3000);

    return () => clearInterval(interval);
  }, [status, publicKey, connection, navigate, wallet]);

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
        border: `1px solid ${theme.colors.border}`
      }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: theme.colors.text.primary, fontSize: isMobile ? '1.5rem' : '2rem', margin: 0 }}>
            <Swords size={isMobile ? 24 : 32} color={theme.colors.primary.main} /> Rock Paper Scissors
          </h1>
          <p style={{ margin: '0.5rem 0 0 0', color: theme.colors.text.secondary }}>
            Join the queue and battle for SOL prizes
          </p>
        </div>
        {/* Create Tournament button removed */}
      </div>

      {/* Quickplay Section */}
      <div style={{
        marginBottom: '2rem',
        padding: '1.5rem',
        backgroundColor: 'rgba(78, 93, 243, 0.05)',
        borderRadius: '12px',
        border: `1px solid ${theme.colors.primary.main}44`,
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            backgroundColor: theme.colors.primary.main,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Timer size={24} color="white" />
          </div>
          <div>
            <h3 style={{ margin: 0, color: theme.colors.text.primary }}>Quickplay Mode</h3>
            <p style={{ margin: '0.25rem 0 0 0', color: theme.colors.text.secondary, fontSize: '0.9rem' }}>
              Instant 1v1 matching • 90s turns • Rapid SOL rewards
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', width: isMobile ? '100%' : 'auto' }}>
          <div style={{
            padding: '0.5rem 1rem',
            backgroundColor: theme.colors.surface,
            borderRadius: '8px',
            border: `1px solid ${theme.colors.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.9rem',
            color: theme.colors.text.primary
          }}>
            <Users size={16} /> {waitingPlayers.length} Searching...
          </div>

          <button
            onClick={() => publicKey ? status === 'searching' ? setShowQuickplayModal(true) : setShowQuickplayModal(true) : showToast('Connect wallet')}
            style={{
              padding: '0.8rem 2rem',
              backgroundColor: status === 'searching' ? '#6c757d' : theme.colors.primary.main,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              flex: isMobile ? 1 : 'none',
              boxShadow: `0 4px 12px ${theme.colors.primary.main}44`
            }}
          >
            {status === 'searching' ? 'Searching...' : 'Find Match'}
          </button>
        </div>
      </div>

      {/* GameList and NewGameModal removed */}
      <QuickplayModal
        isOpen={showQuickplayModal}
        onClose={() => setShowQuickplayModal(false)}
        entryFee={0.1}
        status={status}
        onJoin={handleJoinPool}
        onLeave={handleLeavePool}
      />
    </div>
  );
}