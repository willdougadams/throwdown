import React from 'react';

// Common styles to be reused or we can duplicate for simplicity since they are small
const commonStyles = `
    /* Day Mode Defaults */
    .beach-sky-layer {
        --sky-gradient: linear-gradient(to bottom, #87CEEB 0%, #E0F7FA 100%);
        --sun-moon-color: #FFD700;
    }
    .beach-ocean-layer {
         --ocean-gradient: linear-gradient(to bottom, #006994 0%, #00BFFF 100%);
    }
    .beach-sand-layer {
        --sand-gradient: linear-gradient(to bottom, #F4A460 0%, #F5DEB3 100%);
    }

    @media (prefers-color-scheme: dark) {
        .beach-sky-layer {
            --sky-gradient: linear-gradient(to bottom, #0B1026 0%, #2B32B2 100%);
            --sun-moon-color: #F4F6F0; /* Moon */
        }
        .beach-ocean-layer {
            --ocean-gradient: linear-gradient(to bottom, #000033 0%, #191970 100%);
        }
        .beach-sand-layer {
            --sand-gradient: linear-gradient(to bottom, #2F2F2F 0%, #4B4B4B 100%);
        }
    }
`;

export const SkyLayer: React.FC = () => {
    return (
        <div className="beach-sky-layer" style={{
            width: '120%',
            height: '120%',
            position: 'absolute',
            top: '-10%',
            left: '-10%',
            background: 'var(--sky-gradient, linear-gradient(to bottom, #87CEEB 0%, #E0F7FA 100%))',
            pointerEvents: 'none',
        }}>
            <style>{commonStyles}</style>
            {/* Sun/Moon Glow */}
            <div className="celestial-body" style={{
                position: 'absolute',
                top: '15%', /* Adjusted relative to new larger container */
                right: '25%', /* Adjusted */
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: 'var(--sun-moon-color)',
                boxShadow: '0 0 40px var(--sun-moon-color)',
                opacity: 0.8
            }} />
        </div>
    );
};

export const OceanLayer: React.FC = () => {
    return (
        <div className="beach-ocean-layer" style={{
            width: '100%',
            height: '100%',
            position: 'absolute',
            top: 0,
            left: 0,
            pointerEvents: 'none',
        }}>
            <style>{commonStyles}</style>
            <div style={{
                position: 'absolute',
                bottom: 0,
                left: '-50%', // Wider to allow for parallax movement without showing edges immediately
                width: '200%',
                height: '40%', // Takes up bottom 40% of the screen height
                background: 'var(--ocean-gradient)',
            }} />
        </div>
    );
};

export const SandLayer: React.FC = () => {
    return (
        <div className="beach-sand-layer" style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 0,
        }}>
            <style>{commonStyles}</style>
            <div style={{
                width: '100%',
                height: '100%',
                background: 'var(--sand-gradient)',
                // Create a curved horizon for the sand
                // We want the curve to peak at the top-center of the container
                clipPath: 'ellipse(150% 100% at 50% 100%)'
            }} />
        </div>
    );
};
