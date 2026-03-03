import React, { useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ThemeSelector from './ThemeSelector';
import NetworkSelector from './NetworkSelector';
import AirdropButton from './AirdropButton';
import { Home, Wallet, Swords, Grip, Trees, Info, ChevronDown, ChevronUp, Settings2 } from 'lucide-react';
import { theme } from '../theme';
import { BanyanLogo } from './index';

interface SidebarProps {
    isOpen: boolean;
    onToggle: () => void;
    isMobile?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, isMobile = false }) => {
    const { t } = useTranslation();
    const { publicKey } = useWallet();
    const { connection } = useConnection();
    const navigate = useNavigate();
    const [balance, setBalance] = useState<number | null>(null);
    const [isBottomPanelOpen, setIsBottomPanelOpen] = useState(false);

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

    const NavButton = ({ onClick, icon: Icon, label, active = false }: { onClick: () => void, icon: any, label: string, active?: boolean }) => (
        <button
            onClick={onClick}
            style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                cursor: 'pointer',
                marginBottom: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                fontSize: '0.9rem',
                border: 'none',
                backgroundColor: active ? theme.colors.primary.main : 'transparent',
                color: active ? 'white' : theme.colors.text.secondary,
                transition: 'all 0.2s',
                textAlign: 'left'
            }}
            onMouseEnter={(e) => {
                if (!active) {
                    e.currentTarget.style.backgroundColor = `${theme.colors.primary.main}15`;
                    e.currentTarget.style.color = theme.colors.text.primary;
                }
            }}
            onMouseLeave={(e) => {
                if (!active) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = theme.colors.text.secondary;
                }
            }}
        >
            <Icon size={18} aria-hidden="true" />
            <span style={{ fontWeight: active ? '600' : '400' }}>{label}</span>
        </button>
    );

    const currentPath = window.location.pathname;

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
                marginBottom: '1rem',
                padding: '0.5rem',
                textAlign: 'center'
            }}>
                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800', color: theme.colors.text.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.xs }}>
                    <BanyanLogo size={32} /> Skrim
                </h2>
            </div>

            {/* Wallet Section */}
            <div style={{
                marginBottom: '1.5rem',
                padding: '1rem',
                backgroundColor: theme.colors.card,
                borderRadius: '12px',
                border: `1px solid ${theme.colors.border}`
            }}>
                <WalletMultiButton style={{ width: '100%', fontSize: '0.85rem', height: '40px', lineHeight: '40px' }} />
            </div>

            {/* Navigation */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <NavButton
                    onClick={() => navigate('/')}
                    icon={Home}
                    label={t('sidebar.nav.home')}
                    active={currentPath === '/'}
                />
                <NavButton
                    onClick={() => navigate('/rps-lobby')}
                    icon={Swords}
                    label={t('sidebar.nav.rps')}
                    active={currentPath === '/rps-lobby' || currentPath.startsWith('/game/')}
                />
                <NavButton
                    onClick={() => navigate('/idiot-chess-lobby')}
                    icon={Grip}
                    label={t('sidebar.nav.chess')}
                    active={currentPath === '/idiot-chess-lobby' || currentPath.startsWith('/idiot-chess')}
                />
                <NavButton
                    onClick={() => navigate('/great-banyan')}
                    icon={Trees}
                    label={t('sidebar.nav.banyan')}
                    active={currentPath === '/great-banyan'}
                />
                <NavButton
                    onClick={() => navigate('/about')}
                    icon={Info}
                    label={t('sidebar.nav.about')}
                    active={currentPath === '/about'}
                />
            </div>

            {/* Spacer */}
            <div style={{ flex: 1 }}></div>

            {/* Bottom Controls */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                paddingTop: '1rem',
                borderTop: `1px solid ${theme.colors.border}`
            }}>
                {/* Collapsible Panel */}
                <div style={{
                    backgroundColor: theme.colors.card,
                    borderRadius: '8px',
                    border: `1px solid ${theme.colors.border}`,
                    overflow: 'hidden'
                }}>
                    <button
                        onClick={() => setIsBottomPanelOpen(!isBottomPanelOpen)}
                        style={{
                            width: '100%',
                            padding: '0.6rem 0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            backgroundColor: 'transparent',
                            border: 'none',
                            color: theme.colors.text.primary,
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: '600'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Settings2 size={16} />
                            {t('sidebar.bottom_panel.title', 'Network & Tools')}
                        </div>
                        {isBottomPanelOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    {isBottomPanelOpen && (
                        <div style={{
                            padding: '0 0.75rem 0.75rem 0.75rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.75rem',
                            borderTop: `1px solid ${theme.colors.border}`
                        }}>
                            {publicKey && (
                                <div style={{
                                    padding: '0.5rem',
                                    borderRadius: '6px',
                                    backgroundColor: theme.colors.surface,
                                    fontSize: '0.85rem',
                                    color: theme.colors.text.primary,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.4rem',
                                    marginTop: '0.75rem'
                                }}>
                                    <Wallet size={14} aria-hidden="true" />
                                    <strong>{balance !== null ? balance.toFixed(2) : '...'} SOL</strong>
                                </div>
                            )}
                            <NetworkSelector />
                            <AirdropButton />
                        </div>
                    )}
                </div>

                <ThemeSelector />
            </div>
        </div>
    );
};

export default Sidebar;