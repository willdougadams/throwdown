import React, { useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createWeb3ProgramClient, CreateGameParams } from '../services/web3ProgramClient';
import { GameList } from '../components';
import { Swords, Plus, Grip } from 'lucide-react';
import { theme } from '../theme';
import { useToast } from '../contexts/ToastContext';
import { useGames } from '../contexts/GamesContext';


interface NewGameConfig {
  playerCount: number;
  entryFee: number;
  gameName: string;
  description: string;
}

function NewGameModal({ isOpen, onClose, onGameCreated }: {
  isOpen: boolean;
  onClose: () => void;
  onGameCreated?: (gameId: string) => void;
}) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { publicKey } = wallet;
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [config, setConfig] = useState<NewGameConfig>({
    playerCount: 8,
    entryFee: 0.1,
    gameName: '',
    description: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof NewGameConfig, string>>>({});

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof NewGameConfig, string>> = {};

    if (!config.gameName.trim()) {
      newErrors.gameName = 'Game name is required';
    }

    if (typeof config.entryFee !== 'number' || config.entryFee < 0) {
      newErrors.entryFee = 'Entry fee cannot be negative';
    }

    if (typeof config.entryFee === 'number' && config.entryFee > 10) {
      newErrors.entryFee = 'Entry fee cannot exceed 10 SOL';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!publicKey || !connection || !wallet.signTransaction) {
      showToast('Please connect your wallet first', 'error');
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      console.log('Creating game with config:', config);

      const gameParams: CreateGameParams = {
        playerCount: config.playerCount,
        entryFee: config.entryFee,
        gameName: config.gameName,
        description: config.description
      };

      console.log('Creating Web3 program client...');
      const client = createWeb3ProgramClient(connection, wallet);

      console.log('Calling createGame function...');
      const result = await client.createGame(gameParams);

      console.log('Game created successfully:', result);

      // Show success message with game details
      showToast(
        `Tournament "${config.gameName}" created successfully! Entry Fee: ${config.entryFee} SOL, Prize Pool: ${(config.entryFee * config.playerCount).toFixed(2)} SOL`,
        'success',
        4000
      );

      // Navigate to game page
      navigate(`/game/${result.gameId}`);

      // Notify parent component if callback provided
      if (onGameCreated) {
        onGameCreated(result.gameId);
      }

      onClose();

      // Reset form
      setConfig({
        playerCount: 8,
        entryFee: 0.1,
        gameName: '',
        description: ''
      });
    } catch (error) {
      console.error('Failed to create game:', error);

      let errorMessage = 'Failed to create tournament. ';
      if (error instanceof Error) {
        if (error.message.includes('User rejected')) {
          errorMessage += 'Transaction was cancelled.';
        } else if (error.message.includes('insufficient funds')) {
          errorMessage += 'Insufficient SOL for transaction and entry fee.';
        } else {
          errorMessage += error.message;
        }
      } else {
        errorMessage += 'Please try again.';
      }

      showToast(errorMessage, 'error', 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof NewGameConfig, value: string | number) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem'
    }}>
      <div style={{
        backgroundColor: theme.colors.surface,
        padding: window.innerWidth < 768 ? '1.5rem' : '2rem',
        borderRadius: '12px',
        maxWidth: '500px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem'
        }}>
          <h2 style={{ margin: 0, color: theme.colors.text.primary, fontSize: window.innerWidth < 768 ? '1.2rem' : '1.5rem' }}>Create New Tournament</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: theme.colors.text.secondary,
              padding: '0.25rem'
            }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Game Name */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: 'bold',
              color: theme.colors.text.primary
            }}>
              Tournament Name *
            </label>
            <input
              type="text"
              value={config.gameName}
              onChange={(e) => handleInputChange('gameName', e.target.value)}
              placeholder="e.g., Friday Night Battles"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: `2px solid ${errors.gameName ? theme.colors.error : theme.colors.border}`,
                borderRadius: '6px',
                fontSize: '1rem',
                boxSizing: 'border-box',
                backgroundColor: theme.colors.background,
                color: theme.colors.text.primary
              }}
            />
            {errors.gameName && (
              <div style={{ color: theme.colors.error, fontSize: '0.875rem', marginTop: '0.25rem' }}>
                {errors.gameName}
              </div>
            )}
          </div>

          {/* Description */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: 'bold',
              color: theme.colors.text.primary
            }}>
              Description (Optional)
            </label>
            <textarea
              value={config.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Tournament description or special rules..."
              rows={3}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: `2px solid ${theme.colors.border}`,
                borderRadius: '6px',
                fontSize: '1rem',
                boxSizing: 'border-box',
                resize: 'vertical',
                backgroundColor: theme.colors.background,
                color: theme.colors.text.primary
              }}
            />
          </div>

          {/* Player Count */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: 'bold',
              color: theme.colors.text.primary
            }}>
              Number of Players
            </label>
            <select
              value={config.playerCount.toString()}
              onChange={(e) => handleInputChange('playerCount', parseInt(e.target.value))}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: `2px solid ${theme.colors.border}`,
                borderRadius: '6px',
                fontSize: '1rem',
                backgroundColor: theme.colors.background,
                color: theme.colors.text.primary
              }}
            >
              <option value={4}>4 Players (2 rounds)</option>
              <option value={8}>8 Players (3 rounds)</option>
              <option value={16}>16 Players (4 rounds)</option>
              <option value={32}>32 Players (5 rounds)</option>
            </select>
            <div style={{ fontSize: '0.875rem', color: theme.colors.text.secondary, marginTop: '0.25rem' }}>
              Tournament will have {Math.log2(config.playerCount)} rounds
            </div>
          </div>

          {/* Entry Fee */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: 'bold',
              color: theme.colors.text.primary
            }}>
              Entry Fee (SOL)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="10"
              value={config.entryFee.toString()}
              onChange={(e) => handleInputChange('entryFee', parseFloat(e.target.value) || 0)}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: `2px solid ${errors.entryFee ? theme.colors.error : theme.colors.border}`,
                borderRadius: '6px',
                fontSize: '1rem',
                boxSizing: 'border-box',
                backgroundColor: theme.colors.background,
                color: theme.colors.text.primary
              }}
            />
            {errors.entryFee && (
              <div style={{ color: theme.colors.error, fontSize: '0.875rem', marginTop: '0.25rem' }}>
                {errors.entryFee}
              </div>
            )}
            <div style={{ fontSize: '0.875rem', color: theme.colors.text.secondary, marginTop: '0.25rem' }}>
              Total prize pool: {(config.entryFee * config.playerCount).toFixed(2)} SOL
            </div>
          </div>

          {/* Prize Distribution Info */}
          <div style={{
            backgroundColor: theme.colors.surface,
            padding: '1rem',
            borderRadius: '6px',
            marginBottom: '1.5rem',
            border: `1px solid ${theme.colors.border}`
          }}>
            <h4 style={{ margin: '0 0 0.5rem 0', color: theme.colors.text.primary }}>Prize Distribution</h4>
            <div style={{ fontSize: '0.875rem', color: theme.colors.text.secondary }}>
              • Winner: {(config.entryFee * config.playerCount * 0.7).toFixed(2)} SOL (70%)<br />
              • Runner-up: {(config.entryFee * config.playerCount * 0.2).toFixed(2)} SOL (20%)<br />
              • Platform fee: {(config.entryFee * config.playerCount * 0.1).toFixed(2)} SOL (10%)
            </div>
          </div>

          {/* Buttons */}
          <div style={{
            display: 'flex',
            gap: '1rem',
            justifyContent: 'flex-end'
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                fontSize: '1rem',
                opacity: isSubmitting ? 0.6 : 1
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: isSubmitting ? '#6c757d' : '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                fontSize: '1rem',
                minWidth: '120px'
              }}
            >
              {isSubmitting ? 'Creating...' : 'Create Tournament'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


export default function LandingPage() {
  const { publicKey } = useWallet();
  const [showNewGameModal, setShowNewGameModal] = useState(false);
  const { allGames, loading, error, refreshGames } = useGames();
  const location = useLocation();

  const handleGameCreated = (gameId: string) => {
    console.log('New game created:', gameId);
    // Refresh games list
    refreshGames();
  };

  // Check if we should auto-open join for a specific game
  useEffect(() => {
    if (location.state?.joinGameId) {
      // Could auto-scroll to game list or highlight the specific game
      console.log('Auto-join game:', location.state.joinGameId);
    }
  }, [location.state]);

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
        marginBottom: '1rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.5rem'
      }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: theme.colors.text.primary, fontSize: isMobile ? '1.2rem' : '1.5rem', margin: 0 }}>
          <Swords size={isMobile ? 20 : 24} /> Throwdown
        </h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => window.location.href = '/idiot-chess'}
            style={{
              padding: isMobile ? '0.5rem 0.75rem' : '0.6rem 1rem',
              fontSize: isMobile ? '0.85rem' : '0.9rem',
              backgroundColor: theme.colors.secondary.main,
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <Grip size={16} /> {isMobile ? 'Chess' : 'Idiot Chess'}
          </button>
          {publicKey && (
            <button
              onClick={() => setShowNewGameModal(true)}
              style={{
                padding: isMobile ? '0.5rem 0.75rem' : '0.6rem 1rem',
                fontSize: isMobile ? '0.85rem' : '0.9rem',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <Plus size={16} /> {isMobile ? 'New' : 'New Game'}
            </button>
          )}
        </div>
      </div>

      {/* Games list */}
      <GameList games={allGames} error={error} />

      {/* New game modal */}
      <NewGameModal
        isOpen={showNewGameModal}
        onClose={() => setShowNewGameModal(false)}
        onGameCreated={handleGameCreated}
      />
    </div>
  );
}