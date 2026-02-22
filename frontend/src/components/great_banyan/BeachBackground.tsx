import React from 'react';

const commonStyles = `
    .beach-background-container {
        --sky-day: linear-gradient(to bottom, #87CEEB 0%, #E0F7FA 100%);
        --ocean-day: linear-gradient(to bottom, #006994 0%, #00BFFF 100%);
        --sand-day: linear-gradient(to bottom, #F4A460 0%, #F5DEB3 100%);
    }
`;

export const SkyLayer: React.FC = () => {
    return (
        <div style={{
            position: 'absolute',
            top: -15000,
            left: -15000,
            width: 30000,
            height: 30000,
            background: 'var(--sky-gradient, linear-gradient(to bottom, #87CEEB 0%, #E0F7FA 100%))',
            zIndex: -1,
        }}>
            <style>{commonStyles}</style>
        </div>
    );
};

export const OceanLayer: React.FC = () => {
    return (
        <div style={{
            position: 'absolute',
            // Horizon starts 200px above the root
            top: -200,
            left: -15000,
            width: 30000,
            height: 15000,
            background: 'var(--ocean-gradient, linear-gradient(to bottom, #006994 0%, #00BFFF 100%))',
            zIndex: 0,
        }} />
    );
};

export const SandLayer: React.FC = () => {
    return (
        <div style={{
            position: 'absolute',
            // Sand starts exactly at the root and goes down
            top: 0, 
            left: -15000,
            width: 30000,
            height: 15000,
            background: 'var(--sand-gradient, linear-gradient(to bottom, #F4A460 0%, #F5DEB3 100%))',
            // Flatter beach
            clipPath: 'ellipse(50% 100px at 50% 100px)',
            zIndex: 1,
        }} />
    );
};
