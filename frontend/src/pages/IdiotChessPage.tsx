
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { IdiotChessEngine } from '../components/idiot_chess/GameEngine';
import Board from '../components/idiot_chess/Board';
import GameOverOverlay from '../components/idiot_chess/GameOverOverlay';
import GameInfo from '../components/idiot_chess/GameInfo';

import { theme } from '../theme';

const IdiotChessPage: React.FC = () => {
    const navigate = useNavigate();
    // Use ref to keep engine instance stable, state to trigger re-renders
    const engineRef = useRef(new IdiotChessEngine());
    const [gameState, setGameState] = useState(engineRef.current.getState());

    const handleMove = () => {
        // Engine state is mutated internally, trigger re-render with new state copy
        setGameState({ ...engineRef.current.getState() });
    };

    const handleReset = () => {
        engineRef.current = new IdiotChessEngine();
        setGameState(engineRef.current.getState());
    };

    // Computer Player Logic
    useEffect(() => {
        if (gameState.turn === 'black' && !gameState.winner) {
            const timer = setTimeout(() => {
                const moved = engineRef.current.makeSmartMove(3);
                if (moved) {
                    handleMove();
                }
            }, 500); // Small delay for better UX
            return () => clearTimeout(timer);
        }
    }, [gameState.turn, gameState.winner]);



    return (
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1rem', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                marginBottom: '1.5rem',
                flexShrink: 0
            }}>
                <button
                    onClick={() => navigate('/')}
                    style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: theme.colors.surface,
                        border: `1px solid ${theme.colors.border}`,
                        color: theme.colors.text.primary,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                    }}
                >
                    ← Home
                </button>
                <h1 style={{ margin: 0, color: theme.colors.text.primary }}>Idiot Chess</h1>
            </div>

            <div style={{
                display: 'flex',
                flexDirection: window.innerWidth < 1000 ? 'column' : 'row',
                gap: '2rem',
                alignItems: 'stretch',
                flex: 1
            }}>
                <div style={{ 
                    position: 'relative', 
                    flex: '1.5',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-start',
                    minWidth: 0 // Prevents flex item from overflowing
                }}>
                    <Board
                        engine={engineRef.current}
                        state={gameState}
                        onMove={handleMove}
                    />
                    <GameOverOverlay
                        winner={gameState.winner}
                        onReset={handleReset}
                    />
                </div>

                <div style={{ 
                    flex: '1', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '1rem',
                    minWidth: window.innerWidth < 1000 ? '100%' : '350px',
                    maxWidth: window.innerWidth < 1000 ? '100%' : '450px'
                }}>
                    <GameInfo state={gameState} />
                </div>
            </div>
        </div>
    );
};

export default IdiotChessPage;
