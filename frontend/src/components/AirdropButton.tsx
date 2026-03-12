import React, { useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useNetwork } from '../contexts/NetworkContext';
import { useToast } from '../contexts/ToastContext';
import { theme } from '../theme';
import { Coins } from 'lucide-react';

const AirdropButton: React.FC = () => {
    const { connection } = useConnection();
    const { publicKey } = useWallet();
    const { network } = useNetwork();
    const { showToast, updateToast } = useToast();
    const [isRequesting, setIsRequesting] = useState(false);

    // Only show on devnet and localnet
    if (network === 'mainnet-beta') {
        return null;
    }

    const handleAirdrop = async () => {
        if (!publicKey) {
            showToast('Please connect your wallet first', 'error');
            return;
        }

        setIsRequesting(true);
        const toastId = showToast('Requesting airdrop...', 'loading');

        try {
            const signature = await connection.requestAirdrop(
                publicKey,
                2 * LAMPORTS_PER_SOL
            );

            // Wait for confirmation
            const latestBlockhash = await connection.getLatestBlockhash();
            await connection.confirmTransaction({
                signature,
                ...latestBlockhash
            });

            updateToast(toastId, 'Airdrop successful! +2 SOL', 'success');
        } catch (error) {
            console.error('Airdrop failed:', error);
            updateToast(toastId, 'Airdrop failed. Please try again later.', 'error');
        } finally {
            setIsRequesting(false);
        }
    };

    return (
        <button
            onClick={handleAirdrop}
            disabled={isRequesting || !publicKey}
            style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: theme.colors.card,
                color: publicKey ? theme.colors.text.primary : theme.colors.text.disabled,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '6px',
                cursor: (isRequesting || !publicKey) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                transition: 'all 0.2s ease',
                marginTop: '0.25rem'
            }}
            onMouseEnter={(e) => {
                if (!isRequesting && publicKey) {
                    e.currentTarget.style.backgroundColor = theme.colors.surface;
                    e.currentTarget.style.borderColor = theme.colors.primary.main;
                }
            }}
            onMouseLeave={(e) => {
                if (!isRequesting && publicKey) {
                    e.currentTarget.style.backgroundColor = theme.colors.card;
                    e.currentTarget.style.borderColor = theme.colors.border;
                }
            }}
        >
            <Coins size={16} color={publicKey ? theme.colors.primary.main : theme.colors.text.disabled} />
            {isRequesting ? 'Requesting...' : 'Request Airdrop'}
        </button>
    );
};

export default AirdropButton;
