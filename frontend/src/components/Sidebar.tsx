import React, { useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useNavigate } from 'react-router-dom';
import ThemeSelector from './ThemeSelector';
import NetworkSelector from './NetworkSelector';
import { Gamepad2, Home, Wallet } from 'lucide-react';
import { theme } from '../theme';

interface SidebarProps {
    isOpen: boolean;
    onToggle: () => void;
    isMobile?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, isMobile = false }) => {
    const { publicKey } = useWallet();
    const { connection } = useConnection();
    const navigate = useNavigate();
    const [balance, setBalance] = useState<number | null>(null);

    const fetchBalance = async () => {
        if (!connection || !publicKey) {
            setBalance(null);
            return;
        }

        try {
            const lamports = await connection.getBalance(publicKey);
            setBalance(lamports / 1_000_000_000); // Convert lamports to SOL
        } catch (error) {
            console.error('Error fetching balance:', error);
            setBalance(null);
        }
    };

    useEffect(() => {
        fetchBalance();
    }, [connection, publicKey]);

    if (isMobile && !isOpen) {
        return null;
    }

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '240px',
            height: '100vh',
            backgroundColor: theme.colors.sidebar,
            borderRight: `1px solid ${theme.colors.border}`,
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            padding: '0.75rem',
            overflowY: 'auto',
            transform: isMobile && !isOpen ? 'translateX(-100%)' : 'translateX(0)',
            transition: 'transform 0.3s ease'
        }}>
            {/* Header */}
            <div style={{
                marginBottom: '0.75rem',
                paddingBottom: '0.75rem',
                borderBottom: `1px solid ${theme.colors.border}`,
                textAlign: 'center'
            }}>
                <h2 style={{ margin: 0, fontSize: theme.fontSize.md, color: theme.colors.text.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.xs }}>
                    <Gamepad2 size={18} /> RPS
                </h2>
            </div>

            {/* Wallet Section */}
            <div style={{
                marginBottom: '0.75rem',
                padding: '0.75rem',
                backgroundColor: theme.colors.card,
                borderRadius: '6px',
                border: `1px solid ${theme.colors.border}`
            }}>
                <WalletMultiButton style={{ width: '100%', fontSize: '0.85rem' }} />

                {publicKey && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: theme.colors.text.secondary, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Wallet size={12} />
                        <strong>{balance !== null ? balance.toFixed(2) : '...'} SOL</strong>
                    </div>
                )}
            </div>

            {/* Navigation */}
            <button
                onClick={() => navigate('/')}
                className="primary"
                style={{
                    width: '100%',
                    padding: '0.6rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    marginBottom: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    fontSize: '0.9rem'
                }}
            >
                <Home size={16} /> Lobby
            </button>

            {/* Spacer */}
            <div style={{ flex: 1 }}></div>

            {/* Network Selector */}
            <NetworkSelector />

            {/* Theme Selector */}
            <ThemeSelector />
        </div>
    );
};

export default Sidebar;