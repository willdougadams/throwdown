import React from 'react';
import { PublicKey } from '@solana/web3.js';
import { theme } from '../../theme';
import { BudAccount } from './utils';

interface BudModalProps {
    isOpen: boolean;
    onClose: () => void;
    bud: BudAccount | null;
    budAddress: PublicKey | null;
    onNurture: (essence: string) => void;
    onBloom: () => void;
    isProcessing: boolean;
}

export const BudModal: React.FC<BudModalProps> = ({
    isOpen,
    onClose,
    bud,
    budAddress,
    onNurture,
    onBloom,
    isProcessing
}) => {
    if (!isOpen || !bud) return null;

    const [essence, setEssence] = React.useState('');

    const progress = Number(bud.vitalityRequired > 0n ? (bud.vitalityCurrent * 100n) / bud.vitalityRequired : 0n);
    const isReadyToBloom = bud.vitalityCurrent >= bud.vitalityRequired;

    return (
        <div
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                backdropFilter: 'blur(4px)',
                cursor: 'pointer'
            }}
        >
            <div style={{
                backgroundColor: theme.colors.surface,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '12px',
                padding: '2rem',
                maxWidth: '500px',
                width: '90%',
                color: theme.colors.text.primary,
                boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                cursor: 'default'
            }}>


                <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                    <div style={{ position: 'relative', width: '80px', height: '80px', marginBottom: '1rem' }}>
                        <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                            <circle
                                cx="18"
                                cy="18"
                                r="16"
                                fill="none"
                                stroke={theme.colors.background}
                                strokeWidth="3"
                            />
                            <circle
                                cx="18"
                                cy="18"
                                r="16"
                                fill="none"
                                stroke={isReadyToBloom ? theme.colors.secondary.main : theme.colors.primary.main}
                                strokeWidth="3"
                                strokeDasharray={`${progress}, 100`}
                                strokeLinecap="round"
                                style={{ transition: 'stroke-dasharray 0.3s ease' }}
                            />
                        </svg>
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1rem',
                            fontWeight: 'bold'
                        }}>
                            {Math.round(progress)}%
                        </div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.875rem', color: theme.colors.text.secondary, marginBottom: '0.25rem' }}>Growth</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                            {bud.vitalityCurrent.toString()} / {bud.vitalityRequired.toString()}
                        </div>
                    </div>
                </div>

                {!bud.isBloomed && (
                    <div style={{ paddingBottom: (bud.contributions && bud.contributions.length > 0) ? '1.5rem' : 0 }}>
                        {isReadyToBloom ? (
                            <button
                                onClick={onBloom}
                                disabled={isProcessing}
                                style={{
                                    width: '100%',
                                    padding: '1rem',
                                    backgroundColor: theme.colors.secondary.main,
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontWeight: 'bold',
                                    cursor: isProcessing ? 'wait' : 'pointer',
                                    opacity: isProcessing ? 0.7 : 1
                                }}
                            >
                                {isProcessing ? 'Blooming...' : 'Bloom Bud'}
                            </button>
                        ) : (
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    type="text"
                                    placeholder="Whisper kind words..."
                                    value={essence}
                                    onChange={(e) => setEssence(e.target.value)}
                                    style={{
                                        flex: 1,
                                        padding: '0.75rem',
                                        borderRadius: '8px',
                                        border: `1px solid ${theme.colors.border}`,
                                        backgroundColor: theme.colors.background,
                                        color: theme.colors.text.primary
                                    }}
                                />
                                <button
                                    onClick={() => onNurture(essence)}
                                    disabled={!essence || isProcessing}
                                    style={{
                                        padding: '0.75rem 1.5rem',
                                        backgroundColor: theme.colors.primary.main,
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontWeight: 'bold',
                                        cursor: (!essence || isProcessing) ? 'not-allowed' : 'pointer',
                                        opacity: (!essence || isProcessing) ? 0.6 : 1
                                    }}
                                >
                                    {isProcessing ? '...' : 'Nurture'}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {bud.contributions && bud.contributions.length > 0 && (
                    <div style={{ borderTop: `1px solid ${theme.colors.border}`, paddingTop: '1.5rem' }}>
                        <div style={{ fontSize: '0.875rem', color: theme.colors.text.secondary, marginBottom: '0.5rem' }}>nurtured by</div>
                        <div style={{ fontSize: '0.875rem', backgroundColor: theme.colors.background, padding: '0.5rem', borderRadius: '8px' }}>
                            <ul style={{ margin: 0, paddingLeft: '1.2rem', listStyle: 'circle' }}>
                                {bud.contributions.map(([pk, amount], idx) => (
                                    <li key={idx}>
                                        {pk.toString().slice(0, 4)}...{pk.toString().slice(-4)}: <strong>{amount.toString()}</strong>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

