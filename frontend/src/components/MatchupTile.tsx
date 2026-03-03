import React from 'react';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';
import { MatchupPlayer } from './MatchupPlayer';
import { Matchup, MatchState } from '../types/game';

interface MatchupTileProps {
  matchup: Matchup;
  currentUserPublicKey: string | null;
  isUserInGame: boolean;
  onMatchupClick: () => void;
  onRefresh: () => void;
  onJoin?: (slot: number) => void;
}

export function MatchupTile({
  matchup,
  currentUserPublicKey,
  isUserInGame,
  onMatchupClick,
  onRefresh,
  onJoin
}: MatchupTileProps) {
  const { t } = useTranslation();
  const { player1, player2, matchState, isCurrentUserInMatch, gameId, gameState } = matchup;

  const getStateColor = () => {
    switch (matchState) {
      case 'waiting_for_players': return theme.colors.text.disabled;
      case 'ready_to_play': return theme.colors.primary.main;
      case 'waiting_for_moves': return theme.colors.warning;
      case 'waiting_for_reveals': return '#9c27b0'; // Special purple for reveals
      case 'completed': return theme.colors.success;
      default: return theme.colors.text.disabled;
    }
  };

  const getStateText = () => {
    switch (matchState) {
      case 'waiting_for_players': return t('rps.match_states.waiting_for_players');
      case 'ready_to_play': return t('rps.match_states.ready_to_play');
      case 'waiting_for_moves': return t('rps.match_states.waiting_for_moves');
      case 'waiting_for_reveals': return t('rps.match_states.waiting_for_reveals');
      case 'completed': return t('rps.match_states.completed');
      default: return t('rps.match_states.unknown');
    }
  };

  const isClickable = isCurrentUserInMatch && (matchState === 'waiting_for_moves' || matchState === 'waiting_for_reveals');

  return (
    <div
      onClick={isClickable ? onMatchupClick : undefined}
      style={{
        border: `3px solid ${getStateColor()}`,
        borderRadius: theme.borderRadius.lg,
        padding: theme.spacing.lg,
        backgroundColor: theme.colors.surface,
        minWidth: '240px',
        minHeight: '140px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxShadow: theme.shadow.md,
        transition: theme.transition.base,
        cursor: isClickable ? 'pointer' : 'default',
        position: 'relative'
      }}
      onMouseEnter={(e) => {
        if (isClickable) {
          e.currentTarget.style.transform = 'scale(1.02)';
          e.currentTarget.style.boxShadow = '0 6px 20px rgba(33, 150, 243, 0.4)';
        }
      }}
      onMouseLeave={(e) => {
        if (isClickable) {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
        }
      }}
    >
      {/* State badge */}
      <div style={{
        fontSize: theme.fontSize.xs,
        fontWeight: theme.fontWeight.bold,
        color: 'white',
        backgroundColor: getStateColor(),
        padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
        borderRadius: theme.borderRadius.sm,
        textAlign: 'center',
        marginBottom: theme.spacing.md
      }}>
        {getStateText()}
        {isClickable && ` - ${t('rps.match_states.click_to_play')}`}
      </div>

      {/* Player 1 */}
      <div style={{ marginBottom: theme.spacing.sm }}>
        <MatchupPlayer
          playerData={player1}
          matchState={matchState}
          currentUserPublicKey={currentUserPublicKey}
          gameId={gameId}
          isUserInGame={isUserInGame}
          gameState={gameState}
          onRefresh={onRefresh}
          onJoin={onJoin}
        />
      </div>

      {/* VS */}
      <div style={{
        textAlign: 'center',
        fontSize: theme.fontSize.xs,
        fontWeight: theme.fontWeight.bold,
        color: theme.colors.text.secondary,
        margin: `${theme.spacing.xs} 0`
      }}>
        VS
      </div>

      {/* Player 2 */}
      <div style={{ marginTop: theme.spacing.sm }}>
        <MatchupPlayer
          playerData={player2}
          matchState={matchState}
          currentUserPublicKey={currentUserPublicKey}
          gameId={gameId}
          isUserInGame={isUserInGame}
          gameState={gameState}
          onRefresh={onRefresh}
          onJoin={onJoin}
        />
      </div>
    </div>
  );
}
