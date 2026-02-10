
import React, { useState } from 'react';
import { GameState, Position, IdiotChessEngine, BOARD_SIZE, Piece as PieceType } from './GameEngine';
import Piece from './Piece';
import { theme } from '../../theme';
import { motion } from 'framer-motion';
import {
    DndContext,
    useSensor,
    useSensors,
    MouseSensor,
    TouchSensor,
    DragEndEvent,
    DragOverlay,
    useDraggable,
    useDroppable,
    DragStartEvent,
} from '@dnd-kit/core';

interface BoardProps {
    engine: IdiotChessEngine;
    state: GameState;
    onMove: () => void;
}

// --- Draggable Wrapper ---
interface DraggablePieceProps {
    id: string;
    piece: PieceType;
    isSelected: boolean;
}

const DraggablePiece: React.FC<DraggablePieceProps> = ({ id, piece, isSelected }) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: id,
        data: { piece }
    });

    if (isDragging) {
        return (
            <div
                ref={setNodeRef}
                style={{
                    width: '100%',
                    height: '100%',
                    opacity: 0.3,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                }}
            >
                <Piece type={piece.type} player={piece.player} />
            </div>
        );
    }

    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 10,
                cursor: 'grab',
                touchAction: 'none' // Essential for touch drag
            }}
        >
            {/* We keep motion.div here for the layout animations from click moves */}
            <motion.div
                layoutId={piece.id}
                style={{ width: '100%', height: '100%' }}
                transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 30,
                    duration: 0.2
                }}
            >
                <Piece type={piece.type} player={piece.player} />
            </motion.div>
        </div>
    );
};

// --- Droppable Wrapper ---
interface DroppableSquareProps {
    x: number;
    y: number;
    children: React.ReactNode;
    isBlackSquare: boolean;
    isSelected: boolean;
    isValidMove: boolean;
    hasPiece: boolean;
    onClick: () => void;
}

const DroppableSquare: React.FC<DroppableSquareProps> = ({ x, y, children, isBlackSquare, isSelected, isValidMove, hasPiece, onClick }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: `${x}-${y}`,
        data: { x, y }
    });

    const bgColor = isBlackSquare ? '#b58863' : '#f0d9b5';

    return (
        <div
            ref={setNodeRef}
            onClick={onClick}
            style={{
                width: '100%',
                paddingBottom: '100%', // Square aspect ratio
                position: 'relative',
                backgroundColor: bgColor,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
            }}
        >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                {/* Highlight Selected */}
                {isSelected && (
                    <div style={{ position: 'absolute', width: '100%', height: '100%', backgroundColor: 'rgba(255, 255, 0, 0.5)' }} />
                )}

                {/* Highlight Drag Over */}
                {isOver && !hasPiece && ( // Only highlight empty squares on hover for clarity (or handled by GameEngine validation visually?? currently assumes valid)
                    <div style={{ position: 'absolute', width: '100%', height: '100%', backgroundColor: 'rgba(255, 255, 255, 0.3)', zIndex: 5 }} />
                )}

                {/* Highlight Valid Move */}
                {isValidMove && (
                    <div style={{
                        position: 'absolute',
                        width: !hasPiece ? '30%' : '100%',
                        height: !hasPiece ? '30%' : '100%',
                        borderRadius: !hasPiece ? '50%' : '0',
                        backgroundColor: !hasPiece ? 'rgba(0,0,0,0.2)' : 'rgba(255, 0, 0, 0.4)',
                        boxShadow: hasPiece ? 'inset 0 0 10px red' : 'none'
                    }} />
                )}

                {children}
            </div>
        </div>
    );
};


const Board: React.FC<BoardProps> = ({ engine, state, onMove }) => {
    const [selectedPos, setSelectedPos] = useState<Position | null>(null);
    const [validMoves, setValidMoves] = useState<Position[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [activePiece, setActivePiece] = useState<PieceType | null>(null);

    // Sensors: differentiate between click and drag
    // Mouse: needs 5px movement to trigger drag, otherwise it's a click
    // Touch: needs 250ms press or 5px movement
    const sensors = useSensors(
        useSensor(MouseSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 250,
                tolerance: 5,
            },
        })
    );

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

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        setActiveId(active.id as string);
        setActivePiece(active.data.current?.piece as PieceType);

        // Optional: Highlight valid moves for the dragged piece immediately
        // We need coordinates for this. We can find the piece in the board state.
        // But brute force search is fast enough for 5x5
        let foundPos: Position | null = null;
        for (let y = 0; y < BOARD_SIZE; y++) {
            for (let x = 0; x < BOARD_SIZE; x++) {
                if (state.board[y][x]?.id === active.id) {
                    foundPos = { x, y };
                    break;
                }
            }
            if (foundPos) break;
        }

        if (foundPos) {
            setSelectedPos(foundPos); // Visually select it
            setValidMoves(engine.getValidMoves(foundPos));
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        setActivePiece(null);

        // Always clear selection/valid moves on clear
        // Or we can leave them if the move failed? Let's clear for cleaner UI
        setSelectedPos(null);
        setValidMoves([]);

        if (!over) return;

        // Parse coordinates
        const [targetX, targetY] = (over.id as string).split('-').map(Number);

        // Find source coordinates
        // We can't rely on 'selectedPos' because drag might have started without click-select (though we set it in dragStart)
        // But safely resolving from ID is better
        let sourcePos: Position | null = null;
        for (let y = 0; y < BOARD_SIZE; y++) {
            for (let x = 0; x < BOARD_SIZE; x++) {
                if (state.board[y][x]?.id === active.id) {
                    sourcePos = { x, y };
                    break;
                }
            }
            if (sourcePos) break;
        }

        if (sourcePos) {
            // Validate move
            const validMovesForPiece = engine.getValidMoves(sourcePos);
            const isValid = validMovesForPiece.some(m => m.x === targetX && m.y === targetY);

            if (isValid) {
                engine.move(sourcePos, { x: targetX, y: targetY });
                onMove();
            }
        }
    };

    const renderSquare = (x: number, y: number) => {
        const isBlackSquare = (x + y) % 2 === 1;
        const piece = state.board[y][x];
        const isSelected = selectedPos?.x === x && selectedPos?.y === y;
        const isValidMove = validMoves.some(m => m.x === x && m.y === y);

        return (
            <DroppableSquare
                key={`${x}-${y}`}
                x={x}
                y={y}
                isBlackSquare={isBlackSquare}
                isSelected={isSelected}
                isValidMove={isValidMove}
                hasPiece={!!piece}
                onClick={() => handleSquareClick(x, y)}
            >
                {piece ? (
                    <DraggablePiece
                        id={piece.id}
                        piece={piece}
                        isSelected={isSelected}
                    />
                ) : null}
            </DroppableSquare>
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
        <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        // collisionDetection={closestCenter} // Optional, but default rectangle intersection is usually fine for grid
        >
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

            <DragOverlay>
                {activePiece ? (
                    <div style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        cursor: 'grabbing'
                    }}>
                        <Piece type={activePiece.type} player={activePiece.player} size="80px" />
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
};

export default Board;
