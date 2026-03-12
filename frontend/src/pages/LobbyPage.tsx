import { useState, useEffect, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { createWeb3ProgramClient } from '../services/web3ProgramClient';
import { GameService } from '../services/gameService';
import { Swords, Zap, Wind, Sparkles, X, Circle, FileText, Scissors, Trophy, Users, ChevronRight, Computer, Info } from 'lucide-react';
import { theme } from '../theme';
import { generateReadableName } from '../utils/nameGenerator';
import { useToast } from '../contexts/ToastContext';
import { StrategySidebar } from '../components/StrategySidebar';

interface Challenge {
    id: string;
    creator: string;
    buyInSOL: number;
    players: string[];
    status: 'waiting' | 'in_progress' | 'completed';
    gameType: 'rps' | 'chess';
    winner?: string;
    lamports: number;
}

interface RPSGameModalProps {
    onClose: () => void;
    mode: 'create' | 'accept';
    challenge?: Challenge | null;
    onCreate?: (entryFee: number, moves: number[]) => void;
    onAccept?: (moves: number[]) => void;
    isMobile: boolean;
}

function RPSGameModal({
    onClose,
    mode,
    challenge,
    onCreate,
    onAccept,
    isMobile
}: RPSGameModalProps) {
    const { t } = useTranslation();
    const [entryFee, setEntryFee] = useState(0.1);
    const [moves, setMoves] = useState<number[]>([]);
    const [step, setStep] = useState<'config' | 'moves'>(mode === 'create' ? 'config' : 'moves');

    const handleMoveSelect = (index: number, move: number) => {
        const newMoves = [...moves];
        newMoves[index] = move;
        setMoves(newMoves);
    };

    const isCreate = mode === 'create';

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000,
            padding: '1rem', backdropFilter: 'blur(8px)'
        }}>
            <div style={{
                backgroundColor: theme.colors.surface, padding: '2rem',
                borderRadius: '16px', maxWidth: isMobile ? '500px' : '850px', width: '100%',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)', border: `1px solid ${theme.colors.border}`,
                display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '2rem',
                position: 'relative'
            }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                        <h2 style={{ color: theme.colors.text.primary, margin: 0 }}>
                            {isCreate ? t('rps.create_modal.title') : t('rps.accept_modal.title')}
                        </h2>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', color: theme.colors.text.secondary, cursor: 'pointer' }} aria-label={t('common.cancel')}>
                            <X size={24} />
                        </button>
                    </div>

                    {!isCreate && challenge && (
                        <p style={{ color: theme.colors.text.secondary, marginBottom: '2rem' }}>
                            {t('rps.accept_modal.intro', {
                                creator: generateReadableName(challenge.creator),
                                fee: challenge.buyInSOL
                            })}
                        </p>
                    )}

                    {isCreate && step === 'config' ? (
                        <div>
                            <label style={{ color: theme.colors.text.secondary, display: 'block', marginBottom: '0.5rem' }}>
                                {t('rps.create_modal.entry_fee')}
                            </label>
                            <input
                                type="number"
                                value={entryFee}
                                onChange={e => setEntryFee(parseFloat(e.target.value))}
                                style={{
                                    width: '100%', padding: '1rem', borderRadius: '8px',
                                    backgroundColor: theme.colors.background, border: `1px solid ${theme.colors.border}`,
                                    color: theme.colors.text.primary, fontSize: '1.1rem', marginBottom: '2rem'
                                }}
                            />
                            <button
                                onClick={() => setStep('moves')}
                                style={{
                                    width: '100%', padding: '1rem', backgroundColor: theme.colors.primary.main,
                                    color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer'
                                }}
                            >
                                {t('rps.create_modal.continue_moves')}
                            </button>
                        </div>
                    ) : (
                        <div>
                            <p style={{ color: theme.colors.text.secondary, marginBottom: '1.5rem' }}>
                                {isCreate ? t('rps.create_modal.select_moves') : t('rps.accept_modal.select_moves')}
                            </p>

                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginBottom: '2rem' }}>
                                {[0, 1, 2, 3, 4].map(i => (
                                    <div key={i} style={{
                                        width: '32px', height: '32px', borderRadius: '50%',
                                        backgroundColor: moves[i] !== undefined ? theme.colors.success : theme.colors.border,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.8rem'
                                    }}>
                                        {i + 1}
                                    </div>
                                ))}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
                                {(['rock', 'paper', 'scissors'] as const).map((m, idx) => {
                                    const Icon = m === 'rock' ? Circle : m === 'paper' ? FileText : Scissors;
                                    return (
                                        <button
                                            key={m}
                                            onClick={() => {
                                                if (moves.length < 5) handleMoveSelect(moves.length, idx);
                                            }}
                                            style={{
                                                aspectRatio: '1', display: 'flex', flexDirection: 'column',
                                                alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                                borderRadius: '12px', border: `2px solid ${theme.colors.border}`,
                                                backgroundColor: theme.colors.background, color: theme.colors.text.primary,
                                                cursor: moves.length < 5 ? 'pointer' : 'not-allowed',
                                                fontSize: '0.8rem', fontWeight: 'bold'
                                            }}
                                        >
                                            <Icon size={24} fill={m === 'rock' ? 'currentColor' : 'none'} />
                                            <span style={{ fontSize: '0.7rem' }}>{t(`rps.game.moves.${m}`)}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            <div style={{
                                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '2rem',
                                opacity: moves.length === 0 ? 0.4 : 1,
                                pointerEvents: moves.length === 0 ? 'none' : 'auto'
                            }}>
                                {(['fury', 'serenity', 'trickery'] as const).map((s, i) => {
                                    const Icon = s === 'fury' ? Zap : s === 'serenity' ? Wind : Sparkles;
                                    const idx = 3 + i;
                                    return (
                                        <button
                                            key={s}
                                            onClick={() => {
                                                if (moves.length < 5) handleMoveSelect(moves.length, idx);
                                            }}
                                            style={{
                                                aspectRatio: '1', display: 'flex', flexDirection: 'column',
                                                alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                                borderRadius: '12px', border: `2px solid ${theme.colors.border}`,
                                                backgroundColor: theme.colors.background, color: theme.colors.text.primary,
                                                cursor: moves.length < 5 ? 'pointer' : 'not-allowed',
                                                fontSize: '0.8rem', fontWeight: 'bold'
                                            }}
                                        >
                                            <Icon size={24} fill={s === 'fury' ? 'currentColor' : 'none'} />
                                            <span style={{ fontSize: '0.7rem' }}>{t(`rps.game.moves.${s}`)}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            <div style={{ display: 'flex', gap: '1rem' }}>
                                {isCreate ? (
                                    <>
                                        <button onClick={() => setStep('config')} style={{ flex: 1, padding: '1rem', borderRadius: '8px', border: `1px solid ${theme.colors.border}`, background: 'none', color: theme.colors.text.secondary, cursor: 'pointer' }}>
                                            {t('rps.create_modal.back')}
                                        </button>
                                        <button
                                            onClick={() => {
                                                onCreate?.(entryFee, moves);
                                            }}
                                            disabled={moves.length < 5}
                                            style={{
                                                flex: 2, padding: '1rem', backgroundColor: theme.colors.success,
                                                color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold',
                                                cursor: moves.length === 5 ? 'pointer' : 'not-allowed', opacity: moves.length === 5 ? 1 : 0.6
                                            }}
                                        >
                                            {t('rps.create_modal.create_for', { fee: entryFee })}
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => onAccept?.(moves)}
                                        disabled={moves.length < 5}
                                        style={{
                                            width: '100%', padding: '1rem', backgroundColor: theme.colors.primary.main,
                                            color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold',
                                            cursor: moves.length === 5 ? 'pointer' : 'not-allowed', opacity: moves.length === 5 ? 1 : 0.6
                                        }}
                                    >
                                        {t('rps.accept_modal.join_submit')}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
                <StrategySidebar isMobile={isMobile} />
            </div>
        </div>
    );
}

function CreateChessChallengeModal({ isOpen, onClose, onCreate }: {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (entryFee: number) => void;
}) {
    const { t } = useTranslation();
    const [entryFee, setEntryFee] = useState(0.1);

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
                    onClick={() => {
                        onCreate(entryFee);
                    }}
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

export default function LobbyPage() {
    const { publicKey, connected } = useWallet();
    const { connection } = useConnection();
    const wallet = useWallet();
    const { showToast, updateToast } = useToast();
    const navigate = useNavigate();
    const { t } = useTranslation();

    const [challenges, setChallenges] = useState<Challenge[]>([]);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Modal state for RPS
    const [rpsModalState, setRpsModalState] = useState<{
        isOpen: boolean;
        mode: 'create' | 'accept';
        challenge?: Challenge | null;
    }>({
        isOpen: false,
        mode: 'create',
        challenge: null
    });

    // Modal state for Chess
    const [showChessCreateModal, setShowChessCreateModal] = useState(false);

    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const refreshChallenges = useCallback(async () => {
        setIsRefreshing(true);
        try {
            const gameService = new GameService(connection);
            const [rpsGames, chessGames] = await Promise.all([
                gameService.getFormattedGamesForLobby('rps'),
                gameService.getFormattedGamesForLobby('chess')
            ]);

            const mappedRpsGames = rpsGames
                .filter(g => g.status === 'waiting' || (publicKey && g.players.includes(publicKey.toString())))
                .map(g => ({ ...g, gameType: 'rps' as const }));

            const mappedChessGames = chessGames
                .filter(g => g.status === 'waiting' || (g.status === 'in_progress' && publicKey && g.players.includes(publicKey.toString())))
                .map(g => ({ ...g, gameType: 'chess' as const }));

            // Merge and sort
            const allChallenges = [...mappedRpsGames, ...mappedChessGames];
            // Sort by waiting first, then by lamports/buyin amount descending
            allChallenges.sort((a, b) => {
                if (a.status === 'waiting' && b.status !== 'waiting') return -1;
                if (a.status !== 'waiting' && b.status === 'waiting') return 1;
                return b.buyInSOL - a.buyInSOL;
            });

            setChallenges(allChallenges as Challenge[]);
        } catch (e) {
            console.error('Failed to refresh challenges:', e);
        } finally {
            setIsRefreshing(false);
        }
    }, [connection, publicKey]);

    useEffect(() => {
        refreshChallenges();
        const interval = setInterval(refreshChallenges, 10000);
        return () => clearInterval(interval);
    }, [refreshChallenges]);

    const handleCreateRpsChallenge = async (fee: number, moves: number[]) => {
        if (!publicKey) {
            showToast(t('common.connect_wallet'), 'error');
            return;
        }
        const toastId = showToast(t('rps.toasts.creating'), 'loading');
        try {
            const client = createWeb3ProgramClient(connection, wallet, 'rps');
            const salt = BigInt(Math.floor(Math.random() * 1000000));

            const result = await client.createChallenge({
                entryFee: fee,
                moves: moves,
                salt: salt
            });

            const moveMapping = ['rock', 'paper', 'scissors', 'fury', 'serenity', 'trickery'];
            const key = `${publicKey.toString()}-${result.gameId}-0`;
            localStorage.setItem(key, JSON.stringify({
                moves: moves.map(m => moveMapping[m]),
                salt: salt.toString(),
                timestamp: Date.now()
            }));

            updateToast(toastId, t('rps.toasts.created'), 'success');
            setRpsModalState({ ...rpsModalState, isOpen: false });
            navigate(`/game/${result.gameId}`);
        } catch (e: any) {
            console.error(e);
            updateToast(toastId, e.message || t('rps.toasts.create_failed'), 'error');
        }
    };

    const handleAcceptRpsChallenge = async (moves: number[]) => {
        if (!publicKey || !rpsModalState.challenge) return;
        const toastId = showToast(t('rps.toasts.accepting'), 'loading');
        try {
            const client = createWeb3ProgramClient(connection, wallet, 'rps');
            await client.acceptChallenge(rpsModalState.challenge.id, moves);

            const moveMapping = ['rock', 'paper', 'scissors', 'fury', 'serenity', 'trickery'];
            const key = `${publicKey.toString()}-${rpsModalState.challenge.id}-0`;
            localStorage.setItem(key, JSON.stringify({
                moves: moves.map(m => moveMapping[m]),
                salt: "0",
                timestamp: Date.now()
            }));

            updateToast(toastId, t('rps.toasts.accepted'), 'success');
            setRpsModalState({ ...rpsModalState, isOpen: false });
            navigate(`/game/${rpsModalState.challenge.id}`);
        } catch (e: any) {
            console.error(e);
            updateToast(toastId, e.message || t('rps.toasts.accept_failed'), 'error');
        }
    };

    const handleCreateChessChallenge = async (fee: number) => {
        if (!connected) {
            showToast(t('common.connect_wallet'), 'error');
            return;
        }
        const toastId = showToast(t('chess.toasts.creating'), 'loading');
        try {
            const client = createWeb3ProgramClient(connection, wallet, 'chess');
            const result = await client.createChessChallenge({
                entryFee: fee
            });
            updateToast(toastId, t('chess.toasts.created'), 'success');
            setShowChessCreateModal(false);
            navigate(`/idiot-chess?gameId=${result.gameId}`);
        } catch (e: any) {
            console.error(e);
            updateToast(toastId, e.message || t('chess.toasts.create_failed'), 'error');
        }
    };

    const handleAcceptChessChallenge = async (challengeId: string) => {
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
        <div style={{ padding: isMobile ? '1rem' : '2rem', maxWidth: '1200px', margin: '0 auto', minHeight: '100vh', color: theme.colors.text.primary }}>
            {/* Header / Buttons Section */}
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
                        Lobby
                    </h1>
                    <p style={{ color: theme.colors.text.secondary, marginTop: '0.5rem', fontSize: '1.1rem' }}>
                        Browse open challenges for all 1v1 games.
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '1rem', width: isMobile ? '100%' : 'auto', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => setRpsModalState({ isOpen: true, mode: 'create', challenge: null })}
                        style={{
                            flex: isMobile ? '1 1 100%' : 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            padding: '1rem 1.5rem',
                            backgroundColor: theme.colors.primary.main,
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: `0 4px 15px ${theme.colors.primary.main}44`,
                        }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                        <Swords size={18} /> Play Rock Paper Scissors
                    </button>

                    <button
                        onClick={() => setShowChessCreateModal(true)}
                        style={{
                            flex: isMobile ? '1 1 45%' : 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            padding: '1rem 1.5rem',
                            backgroundColor: theme.colors.success,
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: `0 4px 15px ${theme.colors.success}44`,
                        }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                        <Swords size={18} /> Play Chess
                    </button>

                    <button
                        onClick={() => navigate('/idiot-chess?mode=practice')}
                        style={{
                            flex: isMobile ? '1 1 45%' : 1,
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
                        <Computer size={18} /> Practice Chess
                    </button>
                </div>
            </div>

            {/* Challenges List Section */}
            <div style={{ padding: '1rem', backgroundColor: theme.colors.surface, borderRadius: '12px', border: `1px solid ${theme.colors.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.5rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Users size={24} color={theme.colors.primary.main} /> Active Challenges
                    </h2>
                    {isRefreshing && <div style={{ fontSize: '0.8rem', color: theme.colors.text.secondary }}>{t('common.refreshing')}</div>}
                </div>

                {challenges.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '5rem 2rem', color: theme.colors.text.secondary, border: `1px dashed ${theme.colors.border}`, borderRadius: '20px' }}>
                        <Info size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                        <p style={{ fontSize: '1.2rem' }}>No open challenges right now.</p>
                        <p>Create one above to get started!</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: isMobile ? '1' : 'repeat(auto-fill, minmax(350px, 1fr))' }}>
                        {challenges.map(c => {
                            const isMyGame = publicKey && c.players.includes(publicKey.toString());
                            const isCreator = publicKey && c.creator === publicKey.toString();
                            const isWinner = publicKey && c.winner === publicKey.toString();
                            const isUnclaimed = c.lamports > 1000000;
                            const isWaiting = c.status === 'waiting';

                            return (
                                <div key={c.id} style={{
                                    padding: '1.5rem', borderRadius: '16px', backgroundColor: theme.colors.background,
                                    border: `1px solid ${isMyGame ? theme.colors.primary.main : theme.colors.border}`, display: 'flex', flexDirection: 'column', gap: '1rem',
                                    transition: 'all 0.2s', position: 'relative', overflow: 'hidden'
                                }}>
                                    {/* Game Type Ribbon */}
                                    <div style={{
                                        position: 'absolute', top: 0, right: 0, padding: '0.2rem 1rem', fontSize: '0.7rem', fontWeight: 'bold',
                                        backgroundColor: c.gameType === 'chess' ? theme.colors.success : theme.colors.primary.main,
                                        color: '#fff', borderBottomLeftRadius: '8px', textTransform: 'uppercase'
                                    }}>
                                        {c.gameType === 'chess' ? 'Chess' : 'RPS'}
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                                        <span style={{ color: theme.colors.warning, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <Trophy size={16} /> {c.buyInSOL} SOL
                                        </span>
                                        <span style={{ color: theme.colors.text.secondary, fontSize: '0.8rem' }} title={c.creator}>
                                            By {generateReadableName(c.creator)}
                                        </span>
                                    </div>

                                    <div style={{ display: 'flex', gap: '1.5rem', color: theme.colors.text.secondary, fontSize: '0.9rem' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <Users size={14} /> {c.players.length}/2 Players
                                        </span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', textTransform: 'capitalize' }}>
                                            {c.status.replace('_', ' ')}
                                        </span>
                                    </div>

                                    <button
                                        onClick={() => {
                                            if (c.gameType === 'rps') {
                                                if (c.status === 'waiting' && !isCreator) {
                                                    setRpsModalState({ isOpen: true, mode: 'accept', challenge: c });
                                                } else if (c.status === 'in_progress' && isCreator) {
                                                    navigate(`/game/${c.id}`);
                                                } else if (c.status === 'completed' && isWinner && isUnclaimed) {
                                                    navigate(`/game/${c.id}`);
                                                } else {
                                                    navigate(`/game/${c.id}`);
                                                }
                                            } else {
                                                if (isMyGame || !isWaiting) {
                                                    navigate(`/idiot-chess?gameId=${c.id}`);
                                                } else {
                                                    handleAcceptChessChallenge(c.id);
                                                }
                                            }
                                        }}
                                        style={{
                                            padding: '0.8rem 1.5rem',
                                            backgroundColor: (() => {
                                                if (c.gameType === 'rps') {
                                                    if (c.status === 'waiting' && !isCreator) return theme.colors.success;
                                                    if (c.status === 'in_progress' && isCreator) return theme.colors.primary.main;
                                                    if (c.status === 'completed' && isWinner && isUnclaimed) return '#d4af37';
                                                    return theme.colors.surface;
                                                } else {
                                                    if (isMyGame) return theme.colors.primary.main;
                                                    if (isWaiting) return theme.colors.success;
                                                    return theme.colors.surface;
                                                }
                                            })(),
                                            color: 'white',
                                            border: isWaiting || isMyGame || (c.status === 'completed' && isWinner && isUnclaimed) ? 'none' : `1px solid ${theme.colors.border}`,
                                            borderRadius: '8px',
                                            fontWeight: 'bold',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '0.5rem'
                                        }}
                                    >
                                        {(() => {
                                            if (c.gameType === 'rps') {
                                                if (c.status === 'waiting' && !isCreator) return 'Accept Challenge';
                                                if (c.status === 'in_progress' && isCreator) return 'Reveal Move';
                                                if (c.status === 'completed' && isWinner && isUnclaimed) return 'Claim Prize';
                                                return 'View Game';
                                            } else {
                                                if (isMyGame) return 'Resume Game';
                                                if (isWaiting) return 'Accept Challenge';
                                                return 'View Game';
                                            }
                                        })()}
                                        <ChevronRight size={18} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Modals */}
            {rpsModalState.isOpen && (
                <RPSGameModal
                    onClose={() => setRpsModalState({ ...rpsModalState, isOpen: false })}
                    mode={rpsModalState.mode}
                    challenge={rpsModalState.challenge}
                    onCreate={handleCreateRpsChallenge}
                    onAccept={handleAcceptRpsChallenge}
                    isMobile={isMobile}
                />
            )}

            <CreateChessChallengeModal
                isOpen={showChessCreateModal}
                onClose={() => setShowChessCreateModal(false)}
                onCreate={handleCreateChessChallenge}
            />
        </div>
    );
}
