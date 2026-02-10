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

    const progress = Math.min(100, (bud.vitalityCurrent / bud.vitalityRequired) * 100);
    const isReadyToBloom = bud.vitalityCurrent >= bud.vitalityRequired;

    return (
        <div style={{
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
            backdropFilter: 'blur(4px)'
        }}>
            <div style={{
                backgroundColor: theme.colors.surface,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '12px',
                padding: '2rem',
                maxWidth: '500px',
                width: '90%',
                color: theme.colors.text.primary,
                boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Bud Details</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: theme.colors.text.secondary, cursor: 'pointer', fontSize: '1.5rem' }}>×</button>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ fontSize: '0.875rem', color: theme.colors.text.secondary, marginBottom: '0.5rem' }}>ADDRESS</div>
                    <div style={{ fontFamily: 'monospace', backgroundColor: theme.colors.background, padding: '0.5rem', borderRadius: '4px', wordBreak: 'break-all' }}>
                        {budAddress?.toString()}
                    </div>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.875rem', color: theme.colors.text.secondary }}>VITALITY</span>
                        <span>{bud.vitalityCurrent} / {bud.vitalityRequired}</span>
                    </div>
                    <div style={{ height: '8px', backgroundColor: theme.colors.background, borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{
                            width: `${progress}%`,
                            height: '100%',
                            backgroundColor: isReadyToBloom ? theme.colors.secondary.main : theme.colors.primary.main,
                            transition: 'width 0.3s ease'
                        }} />
                    </div>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ fontSize: '0.875rem', color: theme.colors.text.secondary, marginBottom: '0.5rem' }}>STATUS</div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Badge label="Bloomed" active={bud.isBloomed} />
                        <Badge label="Fruit" active={bud.isFruit} />
                    </div>
                </div>

                {!bud.isBloomed && (
                    <div style={{ borderTop: `1px solid ${theme.colors.border}`, paddingTop: '1.5rem' }}>
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
                                    placeholder="Enter essence (message)..."
                                    value={essence}
                                    onChange={(e) => setEssence(e.target.value)}
                                    style={{
                                        flex: 1,
                                        padding: '0.75rem',
                                        borderRadius: '6px',
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
                                        borderRadius: '6px',
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
            </div>
        </div>
    );
};

const Badge = ({ label, active }: { label: string, active: boolean }) => (
    <span style={{
        padding: '0.25rem 0.75rem',
        borderRadius: '999px',
        fontSize: '0.75rem',
        fontWeight: 'bold',
        backgroundColor: active ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 255, 255, 0.05)',
        color: active ? '#4caf50' : theme.colors.text.secondary,
        border: `1px solid ${active ? '#4caf50' : 'transparent'}`
    }}>
        {label}
    </span>
);
