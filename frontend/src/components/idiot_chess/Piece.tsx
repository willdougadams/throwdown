
import React from 'react';
import { Player, PieceType } from './GameEngine';

interface PieceProps {
    type: PieceType;
    player: Player;
    size?: string;
    className?: string;
}

const Piece: React.FC<PieceProps> = ({ type, player, size = '100%', className }) => {
    const color = player === 'white' ? '#f0f0f0' : '#2d2d2d';
    const stroke = player === 'white' ? '#2d2d2d' : '#f0f0f0';

    return (
        <div
            className={className}
            style={{
                width: size,
                height: size,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                filter: 'drop-shadow(0px 2px 2px rgba(0,0,0,0.3))',
                transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                cursor: 'pointer'
            }}
        >
            {type === 'king' ? (
                <svg viewBox="0 0 100 100" width="80%" height="80%" fill={color} stroke={stroke} strokeWidth="3" strokeLinejoin="round">
                    <path d="M50 10 L50 25 M42 18 L58 18 M30 40 L30 30 L40 30 L40 25 L60 25 L60 30 L70 30 L70 40 L80 40 L80 90 L20 90 L20 40 Z" />
                    <path d="M20 50 L80 50" strokeWidth="2" />
                </svg>
            ) : (
                <svg viewBox="0 0 100 100" width="70%" height="70%" fill={color} stroke={stroke} strokeWidth="3" strokeLinejoin="round">
                    <circle cx="50" cy="30" r="15" />
                    <path d="M35 45 Q50 90 65 45 L65 90 L35 90 Z" />
                    <path d="M25 90 L75 90" strokeWidth="3" />
                </svg>
            )}
        </div>
    );
};

export default Piece;
