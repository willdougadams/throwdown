
import React from 'react';
import { theme } from '../../theme';
import { Player } from './GameEngine';

interface GameInfoProps {
    turn: Player;
    winner: Player | null;
    onReset: () => void;
}

const GameInfo: React.FC<GameInfoProps> = ({ turn, winner, onReset }) => {
    return (
        <div style={{
            marginTop: '1rem',
            padding: '1rem',
            backgroundColor: theme.colors.surface,
            borderRadius: theme.borderRadius.md,
            boxShadow: theme.shadow.sm,
            textAlign: 'center'
        }}>
            {winner ? (
                <h2 style={{ color: theme.colors.primary.main, marginBottom: '1rem' }}>
                    {winner === 'white' ? 'White' : 'Black'} Wins!
                </h2>
            ) : (
                <h3 style={{ color: theme.colors.text.primary, marginBottom: '1rem' }}>
                    Turn: <span style={{ fontWeight: 'bold' }}>{turn === 'white' ? 'White' : 'Black'}</span>
                </h3>
            )}

            <button
                onClick={onReset}
                style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: theme.colors.primary.main,
                    color: 'white',
                    border: 'none',
                    borderRadius: theme.borderRadius.sm,
                    cursor: 'pointer',
                    fontWeight: theme.fontWeight.medium,
                    fontSize: theme.fontSize.sm,
                    transition: 'background-color 0.2s',
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = theme.colors.primary.hover || theme.colors.primary.main}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = theme.colors.primary.main}
            >
                {winner ? 'Play Again' : 'Reset Game'}
            </button>

            <div style={{ marginTop: '1rem', fontSize: theme.fontSize.xs, color: theme.colors.text.secondary }}>
                <p>White moves first. Pawns move forward, attack diagonally.</p>
                <p>Win by capturing all enemy kings or reaching the enemy start rank with your King.</p>
            </div>
        </div>
    );
};

export default GameInfo;
