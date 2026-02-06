
import React, { useState } from 'react';
import { GameState, Position, IdiotChessEngine, BOARD_SIZE } from './GameEngine';
import Piece from './Piece';
import { theme } from '../../theme';
import { motion } from 'framer-motion';

interface BoardProps {
    engine: IdiotChessEngine;
    state: GameState;
    onMove: () => void;
}

const Board: React.FC<BoardProps> = ({ engine, state, onMove }) => {
    const [selectedPos, setSelectedPos] = useState<Position | null>(null);
    const [validMoves, setValidMoves] = useState<Position[]>([]);

    const handleSquareClick = (x: number, y: number) => {
        // If game over, ignore
        if (state.winner) return;

        // Prevent user from interacting during computer's turn (Black)
        if (state.turn === 'black') return;

        const clickedPos = { x, y };
        const clickedPiece = engine.getPiece(clickedPos);

        // If selecting a piece of current turn
        if (clickedPiece && clickedPiece.player === state.turn) {
            if (selectedPos?.x === x && selectedPos?.y === y) {
                // Deselect
                setSelectedPos(null);
                setValidMoves([]);
            } else {
                // Select new
                setSelectedPos(clickedPos);
                setValidMoves(engine.getValidMoves(clickedPos));
            }
            return;
        }

        // Handing move to empty square or enemy capture
        if (selectedPos) {
            const isMoveValid = validMoves.some(m => m.x === x && m.y === y);
            if (isMoveValid) {
                engine.move(selectedPos, clickedPos);
                setSelectedPos(null);
                setValidMoves([]);
                onMove();
            } else {
                // If clicking invalid square (empty or enemy not in range), deselect
                setSelectedPos(null);
                setValidMoves([]);
            }
        }
    };



    const renderSquare = (x: number, y: number) => {
        // Coordinate system: y=0 bottom, y=4 top.
        // CSS Grid usually renders top-down. 
        // Let's render row 4 (top) -> row 0 (bottom).
        // The loop in render() will handle this order.

        const isBlackSquare = (x + y) % 2 === 1;
        const piece = state.board[y][x];
        const isSelected = selectedPos?.x === x && selectedPos?.y === y;
        const isValidMove = validMoves.some(m => m.x === x && m.y === y);
        const isLastMoveSource = false; // TODO: Parse logic history if we want
        const isLastMoveDest = false;

        // Visual order: Row 4 is top.
        const bgColor = isBlackSquare ? '#b58863' : '#f0d9b5';

        return (
            <div
                key={`${x}-${y}`}
                onClick={() => handleSquareClick(x, y)}
                style={{
                    width: '100%',
                    paddingBottom: '100%', // Square aspect ratio
                    position: 'relative',
                    backgroundColor: bgColor,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    cursor: 'pointer',
                }}
            >
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    {/* Highlight Selected */}
                    {isSelected && (
                        <div style={{ position: 'absolute', width: '100%', height: '100%', backgroundColor: 'rgba(255, 255, 0, 0.5)' }} />
                    )}

                    {/* Highlight Valid Move */}
                    {isValidMove && (
                        <div style={{
                            position: 'absolute',
                            width: !piece ? '30%' : '100%',
                            height: !piece ? '30%' : '100%',
                            borderRadius: !piece ? '50%' : '0',
                            backgroundColor: !piece ? 'rgba(0,0,0,0.2)' : 'rgba(255, 0, 0, 0.4)',
                            boxShadow: piece ? 'inset 0 0 10px red' : 'none'
                        }} />
                    )}

                    {piece && (
                        <motion.div
                            layoutId={piece.id}
                            style={{
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                zIndex: 10, // Ensure moving piece is above board elements
                            }}
                            transition={{
                                type: "spring",
                                stiffness: 300,
                                damping: 30,
                                duration: 0.2
                            }}
                        >
                            <Piece type={piece.type} player={piece.player} />
                        </motion.div>
                    )}
                </div>
            </div>
        );
    };

    const rows = [];
    // Render from Top (y=4) to Bottom (y=0)
    for (let y = BOARD_SIZE - 1; y >= 0; y--) {
        const cols = [];
        for (let x = 0; x < BOARD_SIZE; x++) {
            cols.push(renderSquare(x, y));
        }
        rows.push(
            <div key={`row-${y}`} style={{ display: 'grid', gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)` }}>
                {cols}
            </div>
        );
    }

    return (
        <div style={{
            width: '100%',
            height: '100%',
            aspectRatio: '1 / 1',
            border: `4px solid ${theme.colors.border}`,
            borderRadius: '4px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
        }}>
            {rows}
        </div>
    );
};

export default Board;
