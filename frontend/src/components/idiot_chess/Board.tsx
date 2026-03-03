
import React, { useState } from 'react';
import { GameState, Position, IdiotChessEngine, BOARD_SIZE, Piece as PieceType, Player } from './GameEngine';
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
    onMove: (from?: Position, to?: Position) => void;
    disabled?: boolean;
    perspective?: Player;
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
                {isSelected && (
                    <div style={{ position: 'absolute', width: '100%', height: '100%', backgroundColor: 'rgba(255, 255, 0, 0.5)' }} />
                )}

                {isOver && !hasPiece && (
                    <div style={{ position: 'absolute', width: '100%', height: '100%', backgroundColor: 'rgba(255, 255, 255, 0.3)', zIndex: 5 }} />
                )}

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


const Board: React.FC<BoardProps> = ({ engine, state, onMove, disabled, perspective = 'white' }) => {
    const [selectedPos, setSelectedPos] = useState<Position | null>(null);
    const [validMoves, setValidMoves] = useState<Position[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [activePiece, setActivePiece] = useState<PieceType | null>(null);

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
        // If game over or disabled, ignore
        if (state.winner || disabled) return;

        // Prevent user from interacting during opponent's turn
        if (state.turn !== perspective) {
            return;
        }

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
                onMove(selectedPos, clickedPos);
            } else {
                // If clicking invalid square (empty or enemy not in range), deselect
                setSelectedPos(null);
                setValidMoves([]);
            }
        }
    };

    const handleDragStart = (event: DragStartEvent) => {
        if (disabled || state.turn !== perspective) return;
        const { active } = event;
        setActiveId(active.id as string);
        setActivePiece(active.data.current?.piece as PieceType);

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
        if (disabled || state.turn !== perspective) return;
        const { active, over } = event;
        setActiveId(null);
        setActivePiece(null);

        setSelectedPos(null);
        setValidMoves([]);

        if (!over) return;

        // Parse coordinates
        const [targetX, targetY] = (over.id as string).split('-').map(Number);

        // Find source coordinates
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
                onMove(sourcePos, { x: targetX, y: targetY });
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
    if (perspective === 'black') {
        // Black Perspective: Render from Bottom (y=0) to Top (y=4)
        // And from Right (x=4) to Left (x=0)
        for (let y = 0; y < BOARD_SIZE; y++) {
            const cols = [];
            for (let x = BOARD_SIZE - 1; x >= 0; x--) {
                cols.push(renderSquare(x, y));
            }
            rows.push(
                <div key={`row-${y}`} style={{ display: 'grid', gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)` }}>
                    {cols}
                </div>
            );
        }
    } else {
        // White Perspective: Render from Top (y=4) to Bottom (y=0)
        // And from Left (x=0) to Right (x=4)
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
    }

    return (
        <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div style={{
                width: '100%',
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
