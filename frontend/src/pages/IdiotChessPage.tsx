
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { IdiotChessEngine } from '../components/idiot_chess/GameEngine';
import Board from '../components/idiot_chess/Board';
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

    // Computer Player Logic
    useEffect(() => {
        if (gameState.turn === 'black' && !gameState.winner) {
            const timer = setTimeout(() => {
                const moved = engineRef.current.makeRandomMove();
                if (moved) {
                    handleMove();
                }
            }, 500); // Small delay for better UX
            return () => clearTimeout(timer);
        }
    }, [gameState.turn, gameState.winner]);

    const handleReset = () => {
        engineRef.current = new IdiotChessEngine();
        setGameState(engineRef.current.getState());
    };

    return (
        <div className="idiot-chess-page">
            <div className="idiot-chess-header">
                <button
                    onClick={() => navigate('/')}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: theme.colors.text.secondary,
                        cursor: 'pointer',
                        fontSize: theme.fontSize.lg,
                        display: 'flex',
                        alignItems: 'center',
                        marginRight: '1rem'
                    }}
                >
                    ← Back
                </button>
                <h1 style={{ margin: 0, color: theme.colors.text.primary }}>Idiot Chess</h1>
            </div>

            <div className="idiot-chess-layout">
                <div className="idiot-chess-board-wrapper">
                    <Board
                        engine={engineRef.current}
                        state={gameState}
                        onMove={handleMove}
                    />
                </div>
                <div className="idiot-chess-info">
                    <GameInfo
                        turn={gameState.turn}
                        winner={gameState.winner}
                        onReset={handleReset}
                    />
                </div>
            </div>
        </div>
    );
};

export default IdiotChessPage;
