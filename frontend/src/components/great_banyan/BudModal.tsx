import React from 'react';
import { PublicKey } from '@solana/web3.js';
import { theme } from '../../theme';
import { BudData, GameManagerData } from '../../services/gameClient';


interface BudModalProps {
    isOpen: boolean;
    onClose: () => void;
    bud: BudData | null;
    budAddress: PublicKey | null;
    gameManager: GameManagerData | null;
    onNurture: (essence: string) => void;
    onDistributeReward: () => void;
    isProcessing: boolean;
}


export const BudModal: React.FC<BudModalProps> = ({
    isOpen,
    onClose,
    bud,
    gameManager,
    onNurture,
    onDistributeReward,
    isProcessing
}) => {

    if (!isOpen || !bud) return null;

    const [essence, setEssence] = React.useState('');

    const vitalityCurrent = BigInt(bud.vitalityCurrent);
    const vitalityRequired = BigInt(bud.vitalityRequired);
    const progress = Number(vitalityRequired > 0n ? (vitalityCurrent * 100n) / vitalityRequired : 0n);
    const isReadyToBloom = vitalityCurrent >= vitalityRequired;


    // Logic for showing Reward Distribution button:
    // 1. Bud is bloomed and is fruit (or part of winning branch in future)
    // 2. Payout is not complete
    // 3. We are in a subsequent epoch (or the program allows current epoch distribution)
    // Actually, per program logic: manager.last_fruit_epoch == manager.current_epoch - 1
    const showDistribute = bud.isBloomed && !bud.isPayoutComplete &&
        gameManager && BigInt(gameManager.lastFruitEpoch) === BigInt(gameManager.currentEpoch) - 1n &&
        (bud.isFruit || true);


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
                            {bud.vitalityCurrent} / {bud.vitalityRequired}
                        </div>

                    </div>
                </div>

                {!bud.isBloomed && (
                    <div style={{ paddingBottom: (bud.contributions && bud.contributions.length > 0) ? '1.5rem' : 0 }}>
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
                    </div>
                )}

                {showDistribute && (
                    <div style={{ paddingBottom: '1.5rem' }}>
                        <button
                            onClick={onDistributeReward}
                            disabled={isProcessing}
                            style={{
                                width: '100%',
                                padding: '1rem',
                                backgroundColor: '#FFD700', // Gold color for rewards
                                color: '#000',
                                border: 'none',
                                borderRadius: '6px',
                                fontWeight: 'bold',
                                cursor: isProcessing ? 'wait' : 'pointer',
                                opacity: isProcessing ? 0.7 : 1
                            }}
                        >
                            {isProcessing ? 'Processing...' : 'Claim / Distribute Rewards'}
                        </button>
                        <p style={{ fontSize: '0.75rem', color: theme.colors.text.secondary, marginTop: '0.5rem', textAlign: 'center' }}>
                            This bud is part of a winning branch! Distribute rewards to all contributors.
                        </p>
                    </div>
                )}

                {bud.isPayoutComplete && (
                    <div style={{ paddingBottom: '1.5rem', textAlign: 'center' }}>
                        <span style={{ color: theme.colors.secondary.main, fontWeight: 'bold' }}>✅ Rewards Distributed</span>
                    </div>
                )}

                {bud.contributions && bud.contributions.length > 0 && (
                    <div style={{ borderTop: `1px solid ${theme.colors.border}`, paddingTop: '1.5rem' }}>
                        <div style={{ fontSize: '0.875rem', color: theme.colors.text.secondary, marginBottom: '0.5rem' }}>nurtured by</div>
                        <div style={{ fontSize: '0.875rem', backgroundColor: theme.colors.background, padding: '0.5rem', borderRadius: '8px' }}>
                            <ul style={{ margin: 0, paddingLeft: '1.2rem', listStyle: 'circle' }}>
                                {bud.contributions.map(({ pubkey, amount }, idx) => (
                                    <li key={idx}>
                                        {pubkey.toString().slice(0, 4)}...{pubkey.toString().slice(-4)}: <strong>{amount.toString()}</strong>
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

