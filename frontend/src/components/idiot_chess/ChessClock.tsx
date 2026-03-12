import React from 'react';
import { Clock } from 'lucide-react';
import { theme } from '../../theme';

interface ChessClockProps {
    whiteTime: number;
    blackTime: number;
    activePlayer: 'white' | 'black' | null;
}

const ChessClock: React.FC<ChessClockProps> = ({ whiteTime, blackTime, activePlayer }) => {
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const getTimerColor = (seconds: number, isActive: boolean) => {
        if (seconds <= 0) return theme.colors.error;
        if (seconds < 60) return theme.colors.warning;
        return isActive ? theme.colors.primary.main : theme.colors.text.secondary;
    };

    return (
        <div style={{
            display: 'flex',
            gap: '1rem',
            width: '100%',
            justifyContent: 'space-between',
            marginBottom: '1rem'
        }}>
            <div style={{
                flex: 1,
                padding: '1rem',
                backgroundColor: theme.colors.surface,
                borderRadius: '12px',
                border: `2px solid ${activePlayer === 'white' ? theme.colors.primary.main : theme.colors.border}`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                transition: 'all 0.3s ease',
                boxShadow: activePlayer === 'white' ? `0 0 15px ${theme.colors.primary.main}44` : 'none',
                opacity: activePlayer === 'black' ? 0.7 : 1
            }}>
                <div style={{ fontSize: '0.8rem', color: theme.colors.text.secondary, marginBottom: '0.4rem', fontWeight: 'bold' }}>
                    WHITE {activePlayer === 'white' && '●'}
                </div>
                <div style={{
                    fontSize: '1.8rem',
                    fontFamily: 'monospace',
                    fontWeight: 'bold',
                    color: getTimerColor(whiteTime, activePlayer === 'white')
                }}>
                    {formatTime(whiteTime)}
                </div>
            </div>

            <div style={{
                display: 'flex',
                alignItems: 'center',
                color: theme.colors.text.secondary,
                padding: '0 0.5rem'
            }}>
                <Clock size={24} />
            </div>

            <div style={{
                flex: 1,
                padding: '1rem',
                backgroundColor: theme.colors.surface,
                borderRadius: '12px',
                border: `2px solid ${activePlayer === 'black' ? theme.colors.primary.main : theme.colors.border}`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                transition: 'all 0.3s ease',
                boxShadow: activePlayer === 'black' ? `0 0 15px ${theme.colors.primary.main}44` : 'none',
                opacity: activePlayer === 'white' ? 0.7 : 1
            }}>
                <div style={{ fontSize: '0.8rem', color: theme.colors.text.secondary, marginBottom: '0.4rem', fontWeight: 'bold' }}>
                    BLACK {activePlayer === 'black' && '●'}
                </div>
                <div style={{
                    fontSize: '1.8rem',
                    fontFamily: 'monospace',
                    fontWeight: 'bold',
                    color: getTimerColor(blackTime, activePlayer === 'black')
                }}>
                    {formatTime(blackTime)}
                </div>
            </div>
        </div>
    );
};

export default ChessClock;
