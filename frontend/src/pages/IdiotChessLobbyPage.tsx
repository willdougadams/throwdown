import React, { useState, useEffect, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { createWeb3ProgramClient } from '../services/web3ProgramClient';
import { GameService } from '../services/gameService';
import { Swords, Trophy, Users, X, Info, ChevronRight, Play } from 'lucide-react';
import { theme } from '../theme';
import { useToast } from '../contexts/ToastContext';

interface Challenge {
    id: string;
    creator: string;
    name: string;
    buyInSOL: number;
    status: 'waiting' | 'in_progress' | 'completed';
    players: string[];
}

function PawnMoveDiagram() {
    const { t } = useTranslation();
    const cellSize = 44;
    return (
        <div style={{
            marginTop: '1.5rem',
            padding: '1rem',
            backgroundColor: 'rgba(255,255,255,0.03)',
            borderRadius: '12px',
            border: `1px solid ${theme.colors.border}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem'
        }}>
            <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(3, ${cellSize}px)`,
                gridTemplateRows: `repeat(2, ${cellSize}px)`,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '4px',
                overflow: 'hidden'
            }}>
                {[...Array(6)].map((_, i) => {
                    const row = Math.floor(i / 3);
                    const col = i % 3;
                    const isDark = (row + col) % 2 === 1;
                    const isPawnStart = row === 1 && col === 1;
                    const isMove = row === 0;

                    return (
                        <div key={i} style={{
                            width: cellSize,
                            height: cellSize,
                            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative'
                        }}>
                            {isPawnStart && (
                                <span style={{ fontSize: '24px', zIndex: 1 }}>♟</span>
                            )}
                            {isMove && (
                                <div style={{
                                    width: '10px',
                                    height: '10px',
                                    borderRadius: '50%',
                                    backgroundColor: col === 1 ? theme.colors.primary.main : theme.colors.success,
                                    boxShadow: `0 0 10px ${col === 1 ? theme.colors.primary.main : theme.colors.success}88`
                                }} />
                            )}
                        </div>
                    );
                })}
            </div>

            <div style={{ fontSize: '0.8rem', width: '100%', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: theme.colors.primary.main }} />
                    <span style={{ color: theme.colors.text.secondary }}>{t('chess.lobby.diagram.straight')}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: theme.colors.success }} />
                    <span style={{ color: theme.colors.text.secondary }}>{t('chess.lobby.diagram.diagonal')}</span>
                </div>
            </div>
        </div>
    );
}

function CreateChessChallengeModal({ isOpen, onClose, onCreate }: {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (entryFee: number, gameName: string) => void;
}) {
    const { t } = useTranslation();
    const [entryFee, setEntryFee] = useState(0.1);
    const [gameName, setGameName] = useState('');

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000,
            padding: '1rem', backdropFilter: 'blur(8px)'
        }}>
            <div style={{
                backgroundColor: theme.colors.surface, padding: '2rem',
                borderRadius: '16px', maxWidth: '400px', width: '100%',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)', border: `1px solid ${theme.colors.border}`
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <h2 style={{ color: theme.colors.text.primary, margin: 0 }}>{t('chess.create_modal.title')}</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: theme.colors.text.secondary, cursor: 'pointer' }} aria-label={t('common.cancel')}><X size={24} /></button>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ color: theme.colors.text.secondary, display: 'block', marginBottom: '0.5rem' }}>{t('chess.create_modal.game_name')}</label>
                    <input
                        type="text"
                        placeholder={t('chess.create_modal.game_name_placeholder')}
                        value={gameName}
                        onChange={e => setGameName(e.target.value)}
                        style={{
                            width: '100%', padding: '0.8rem', borderRadius: '8px',
                            backgroundColor: theme.colors.background, border: `1px solid ${theme.colors.border}`,
                            color: theme.colors.text.primary, fontSize: '1rem'
                        }}
                    />
                </div>

                <div style={{ marginBottom: '2rem' }}>
                    <label style={{ color: theme.colors.text.secondary, display: 'block', marginBottom: '0.5rem' }}>{t('chess.create_modal.entry_fee')}</label>
                    <input
                        type="number"
                        step="0.05"
                        min="0"
                        value={entryFee}
                        onChange={e => setEntryFee(parseFloat(e.target.value))}
                        style={{
                            width: '100%', padding: '0.8rem', borderRadius: '8px',
                            backgroundColor: theme.colors.background, border: `1px solid ${theme.colors.border}`,
                            color: theme.colors.text.primary, fontSize: '1.1rem'
                        }}
                    />
                </div>

                <button
                    onClick={() => onCreate(entryFee, gameName || `Chess Match`)}
                    style={{
                        width: '100%', padding: '1rem', backgroundColor: theme.colors.primary.main,
                        color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer',
                        transition: 'transform 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                    {t('common.create')}
                </button>
            </div>
        </div>
    );
}

export default function IdiotChessLobbyPage() {
    const { publicKey, connected } = useWallet();
    const wallet = useWallet();
    const { connection } = useConnection();
    const navigate = useNavigate();
    const { showToast, updateToast } = useToast();
    const { t } = useTranslation();

    const [challenges, setChallenges] = useState<Challenge[]>([]);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const refreshChallenges = useCallback(async () => {
        setIsRefreshing(true);
        try {
            const gameService = new GameService(connection);
            const allGames = await gameService.getFormattedGamesForLobby('chess');

            // Filter for games we can join or are already in
            setChallenges(allGames.filter(g =>
                g.status === 'waiting' ||
                (g.status === 'in_progress' && publicKey && g.players.includes(publicKey.toString()))
            ) as any);
        } catch (e) {
            console.error('Failed to fetch chess challenges:', e);
        } finally {
            setIsRefreshing(false);
        }
    }, [connection, publicKey]);

    useEffect(() => {
        refreshChallenges();
        const interval = setInterval(refreshChallenges, 8000);
        return () => clearInterval(interval);
    }, [refreshChallenges]);

    const handleCreateChallenge = async (fee: number, name: string) => {
        if (!connected) {
            showToast(t('common.connect_wallet'), 'error');
            return;
        }
        const toastId = showToast(t('chess.toasts.creating'), 'loading');
        try {
            const client = createWeb3ProgramClient(connection, wallet, 'chess');
            const result = await client.createChessChallenge({
                entryFee: fee,
                gameName: name
            });
            updateToast(toastId, t('chess.toasts.created'), 'success');
            setShowCreateModal(false);
            navigate(`/idiot-chess?gameId=${result.gameId}`);
        } catch (e: any) {
            console.error(e);
            updateToast(toastId, e.message || t('chess.toasts.create_failed'), 'error');
        }
    };

    const handleAcceptChallenge = async (challengeId: string) => {
        if (!connected) {
            showToast(t('common.connect_wallet'), 'error');
            return;
        }
        const toastId = showToast(t('chess.toasts.accepting'), 'loading');
        try {
            const client = createWeb3ProgramClient(connection, wallet, 'chess');
            await client.acceptChessChallenge(challengeId);
            updateToast(toastId, t('chess.toasts.accepted'), 'success');
            navigate(`/idiot-chess?gameId=${challengeId}`);
        } catch (e: any) {
            console.error(e);
            updateToast(toastId, e.message || t('chess.toasts.accept_failed'), 'error');
        }
    };

    return (
        <div style={{
            padding: isMobile ? '1rem' : '2rem',
            maxWidth: '1200px',
            margin: '0 auto',
            minHeight: '100vh',
            color: theme.colors.text.primary
        }}>
            {/* Header Section */}
            <div style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                justifyContent: 'space-between',
                alignItems: isMobile ? 'flex-start' : 'center',
                gap: '2rem',
                marginBottom: '3rem',
                background: `linear-gradient(135deg, ${theme.colors.surface} 0%, ${theme.colors.background} 100%)`,
                padding: '2.5rem',
                borderRadius: '24px',
                border: `1px solid ${theme.colors.border}`,
                boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
            }}>
                <div>
                    <h1 style={{
                        fontSize: isMobile ? '2rem' : '3rem',
                        margin: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        background: `linear-gradient(to right, ${theme.colors.primary.main}, ${theme.colors.success})`,
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        fontWeight: 800
                    }}>
                        {t('chess.lobby.title')}
                    </h1>
                    <p style={{ color: theme.colors.text.secondary, marginTop: '0.5rem', fontSize: '1.1rem' }}>
                        {t('chess.lobby.subtitle')}
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '1rem', width: isMobile ? '100%' : 'auto' }}>
                    <button
                        onClick={() => navigate('/idiot-chess?mode=practice')}
                        style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            padding: '1rem 1.5rem',
                            backgroundColor: 'transparent',
                            color: theme.colors.text.primary,
                            border: `2px solid ${theme.colors.border}`,
                            borderRadius: '12px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
                            e.currentTarget.style.borderColor = theme.colors.text.primary;
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.borderColor = theme.colors.border;
                        }}
                    >
                        <Play size={18} /> {t('chess.lobby.practice_mode')}
                    </button>

                    <button
                        onClick={() => setShowCreateModal(true)}
                        style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            padding: '1rem 2rem',
                            backgroundColor: theme.colors.primary.main,
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            boxShadow: `0 4px 15px ${theme.colors.primary.main}44`,
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                        <Swords size={18} /> {t('chess.lobby.new_challenge')}
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '3fr 1fr', gap: '2rem' }}>
                {/* Main Feed */}
                <section>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h2 style={{ fontSize: '1.5rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Users size={24} color={theme.colors.primary.main} /> {t('chess.lobby.active_challenges')}
                        </h2>
                        {isRefreshing && <div style={{ fontSize: '0.8rem', color: theme.colors.text.secondary }}>{t('common.refreshing')}</div>}
                    </div>

                    {challenges.length === 0 ? (
                        <div style={{
                            padding: '5rem 2rem',
                            textAlign: 'center',
                            backgroundColor: theme.colors.surface,
                            borderRadius: '20px',
                            border: `1px dashed ${theme.colors.border}`,
                            color: theme.colors.text.secondary
                        }}>
                            <Info size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                            <p style={{ fontSize: '1.2rem' }}>{t('chess.lobby.no_challenges')}</p>
                            <p>{t('chess.lobby.create_first')}</p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: '1rem' }}>
                            {challenges.map(challenge => {
                                const isMyGame = publicKey && challenge.players.includes(publicKey.toString());
                                const isWaiting = challenge.status === 'waiting';

                                return (
                                    <div key={challenge.id} style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '1.5rem',
                                        backgroundColor: theme.colors.surface,
                                        borderRadius: '16px',
                                        border: `1px solid ${isMyGame ? theme.colors.primary.main : theme.colors.border}`,
                                        transition: 'all 0.2s',
                                    }}>
                                        <div>
                                            <h3 style={{ margin: '0 0 0.5rem 0', color: theme.colors.text.primary }}>{challenge.name}</h3>
                                            <div style={{ display: 'flex', gap: '1.5rem', color: theme.colors.text.secondary, fontSize: '0.9rem' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                    <Trophy size={14} color={theme.colors.warning} /> {challenge.buyInSOL} SOL
                                                </span>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                    <Users size={14} /> {challenge.players.length}/2 {t('common.players')}
                                                </span>
                                                <span style={{ opacity: 0.7 }}>
                                                    By {challenge.creator.slice(0, 4)}...{challenge.creator.slice(-4)}
                                                </span>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => isMyGame ? navigate(`/idiot-chess?gameId=${challenge.id}`) : handleAcceptChallenge(challenge.id)}
                                            style={{
                                                padding: '0.8rem 1.5rem',
                                                backgroundColor: isMyGame ? theme.colors.primary.main : (isWaiting ? theme.colors.success : theme.colors.surface),
                                                color: 'white',
                                                border: isWaiting ? 'none' : `1px solid ${theme.colors.border}`,
                                                borderRadius: '8px',
                                                fontWeight: 'bold',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.5rem'
                                            }}
                                        >
                                            {isMyGame ? t('chess.lobby.resume_game') : (isWaiting ? t('chess.lobby.accept_challenge') : t('chess.lobby.view_game'))}
                                            <ChevronRight size={18} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* Sidebar / Rules */}
                <aside>
                    <div style={{
                        backgroundColor: 'rgba(255,165,0,0.05)',
                        padding: '1.5rem',
                        borderRadius: '16px',
                        border: '1px solid rgba(255,165,0,0.2)'
                    }}>
                        <h3 style={{ margin: '0 0 1rem 0', color: theme.colors.warning, fontSize: '1.1rem' }}>{t('chess.lobby.how_to_play.title')}</h3>
                        <ul style={{
                            paddingLeft: '1.2rem',
                            margin: 0,
                            color: theme.colors.text.secondary,
                            fontSize: '0.9rem',
                            lineHeight: '1.6'
                        }}>
                            <li>{t('chess.lobby.how_to_play.rule1')}</li>
                            <li>{t('chess.lobby.how_to_play.rule2')}</li>
                            <li>{t('chess.lobby.how_to_play.rule3')}</li>
                            <li>{t('chess.lobby.how_to_play.rule4')}</li>
                            <li>{t('chess.lobby.how_to_play.rule5')}</li>
                            <li>{t('chess.lobby.how_to_play.rule6')}</li>

                            <li>{t('chess.lobby.how_to_play.rule7')}</li>
                        </ul>

                        <PawnMoveDiagram />
                    </div>
                </aside>
            </div>

            <CreateChessChallengeModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onCreate={handleCreateChallenge}
            />
        </div>
    );
}
