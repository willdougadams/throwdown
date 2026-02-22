import React from 'react';
import { GameState, BOARD_SIZE } from './GameEngine';
import { theme } from '../../theme';
import { User, Cpu, Hash } from 'lucide-react';

interface GameInfoProps {
    state: GameState;
}

const GameInfo: React.FC<GameInfoProps> = ({ state }) => {
    const isPlayerTurn = state.turn === 'white';
    
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            padding: '1.5rem',
            backgroundColor: theme.colors.card,
            borderRadius: '12px',
            border: `1px solid ${theme.colors.border}`,
            width: '100%',
            maxWidth: '400px'
        }}>
            {/* Turn Indicator */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.75rem',
                    color: isPlayerTurn ? theme.colors.primary.main : theme.colors.text.secondary,
                    transition: 'all 0.3s'
                }}>
                    <User size={20} />
                    <span style={{ fontWeight: isPlayerTurn ? 'bold' : 'normal' }}>Player (White)</span>
                    {isPlayerTurn && <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: theme.colors.primary.main }} />}
                </div>
                <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.75rem',
                    color: !isPlayerTurn ? theme.colors.secondary.main : theme.colors.text.secondary,
                    transition: 'all 0.3s'
                }}>
                    {!isPlayerTurn && <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: theme.colors.secondary.main }} />}
                    <span style={{ fontWeight: !isPlayerTurn ? 'bold' : 'normal' }}>CPU (Black)</span>
                    <Cpu size={20} />
                </div>
            </div>

            {/* Progress to Draw */}
            <div style={{ marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: theme.colors.text.secondary, marginBottom: '0.4rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Hash size={14} /> Moves since capture
                    </span>
                    <span>{state.moveCount} / 15</span>
                </div>
                <div style={{ width: '100%', height: '6px', backgroundColor: theme.colors.background, borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ 
                        width: `${(state.moveCount / 15) * 100}%`, 
                        height: '100%', 
                        backgroundColor: state.moveCount > 10 ? theme.colors.error : theme.colors.text.secondary,
                        transition: 'width 0.3s ease-out'
                    }} />
                </div>
            </div>

            {/* Rules Reminder */}
            <div style={{ 
                marginTop: '0.5rem', 
                padding: '0.75rem', 
                backgroundColor: theme.colors.background, 
                borderRadius: '8px',
                fontSize: '0.85rem',
                color: theme.colors.text.secondary,
                lineHeight: '1.4'
            }}>
                <strong>Winning:</strong> Capture all of the opponent's Kings! If 15 moves pass without a capture, the game ends in a stalemate.
            </div>
        </div>
    );
};

export default GameInfo;
