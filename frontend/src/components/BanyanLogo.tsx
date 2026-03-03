import React from 'react';

interface BanyanLogoProps {
    size?: number;
    className?: string;
    style?: React.CSSProperties;
}

const BanyanLogo: React.FC<BanyanLogoProps> = ({ size = 32, className, style }) => {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 512 512"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            style={{ ...style, flexShrink: 0 }}
            aria-hidden="true"
        >
            {/* Exactly 1 -> 2 -> 4 Nodes Structure */}
            <g transform="translate(256, 400)">
                {/* Level 0: Root Node */}
                <circle cx="0" cy="0" r="16" fill="currentColor" />

                {/* Branches to Level 1 */}
                <path d="M 0,0 L -100,-120" stroke="currentColor" strokeWidth="20" strokeLinecap="round" />
                <path d="M 0,0 L 100,-120" stroke="currentColor" strokeWidth="20" strokeLinecap="round" />

                {/* Level 1: 2 Middle Nodes */}
                <g transform="translate(-100, -120)">
                    <circle cx="0" cy="0" r="14" fill="currentColor" />
                    {/* Branches to Level 2 */}
                    <path d="M 0,0 L -60,-100" stroke="currentColor" strokeWidth="16" strokeLinecap="round" />
                    <path d="M 0,0 L 60,-100" stroke="currentColor" strokeWidth="16" strokeLinecap="round" />
                    {/* Level 2: 2 Leaf Nodes */}
                    <circle cx="-60" cy="-100" r="12" fill="currentColor" />
                    <circle cx="60" cy="-100" r="12" fill="currentColor" />
                </g>

                <g transform="translate(100, -120)">
                    <circle cx="0" cy="0" r="14" fill="currentColor" />
                    {/* Branches to Level 2 */}
                    <path d="M 0,0 L -60,-100" stroke="currentColor" strokeWidth="16" strokeLinecap="round" />
                    <path d="M 0,0 L 60,-100" stroke="currentColor" strokeWidth="16" strokeLinecap="round" />
                    {/* Level 2: 2 Leaf Nodes */}
                    <circle cx="-60" cy="-100" r="12" fill="currentColor" />
                    <circle cx="60" cy="-100" r="12" fill="currentColor" />
                </g>
            </g>
        </svg>
    );
};

export default BanyanLogo;
