import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { theme } from '../theme';
import { BanyanLogo } from '../components';
import Board from '../components/idiot_chess/Board';
import { IdiotChessEngine, GameState } from '../components/idiot_chess/GameEngine';
import { Circle, FileText, Scissors, Zap, Wind, Sparkles, Play, Volume2, VolumeX } from 'lucide-react';
import { TreeVisualizer } from '../components/great_banyan/TreeVisualizer';
import { TrustlessClient } from '../services/trustlessClient';
import { findBudPda, findChildBudPda } from '../components/great_banyan/utils';
import { BudData } from '../services/gameClient';
import { Connection, PublicKey } from '@solana/web3.js';

const DemoPage: React.FC = () => {
    // Audio state
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isStarted, setIsStarted] = useState(false);
    const [isMuted, setIsMuted] = useState(false);

    // Use Devnet for the banyan tree
    const devnetConnection = useMemo(() => new Connection('https://api.devnet.solana.com', 'confirmed'), []);
    const devnetClient = useMemo(() => new TrustlessClient(devnetConnection), [devnetConnection]);

    const [scene, setScene] = useState(0);
    const [timer, setTimer] = useState(0);

    // Scene durations
    const SCENE_DURATIONS = [5, 10, 5, 10, 5]; // total 35s

    useEffect(() => {
        if (!isStarted) return;

        const interval = setInterval(() => {
            setTimer(prev => {
                const next = prev + 1;

                // Determine scene based on timer
                let currentTotal = 0;
                let foundScene = 0;
                for (let i = 0; i < SCENE_DURATIONS.length; i++) {
                    currentTotal += SCENE_DURATIONS[i];
                    if (next < currentTotal) {
                        foundScene = i;
                        break;
                    }
                    if (i === SCENE_DURATIONS.length - 1) {
                        foundScene = 4;
                    }
                }

                if (foundScene !== scene) {
                    setScene(foundScene);
                }

                return next % 35; // Loop every 35s
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [scene, isStarted]);

    // Scene 2: Idiot Chess Logic
    const engineRef = useRef(new IdiotChessEngine());
    const [chessState, setChessState] = useState<GameState>(engineRef.current.getState());

    useEffect(() => {
        if (isStarted && scene === 1) {
            const chessInterval = setInterval(() => {
                engineRef.current.makeSmartMove(1);
                setChessState({ ...engineRef.current.getState() });
            }, 500);
            return () => clearInterval(chessInterval);
        } else {
            // Reset engine when not in scene
            engineRef.current = new IdiotChessEngine();
            setChessState(engineRef.current.getState());
        }
    }, [scene, isStarted]);

    // Scene 3: RPS Logic
    const [rpsIndex, setRpsIndex] = useState(0);
    useEffect(() => {
        if (isStarted && scene === 2) {
            const rpsInterval = setInterval(() => {
                setRpsIndex(prev => (prev + 1) % 5);
            }, 1000); // Speed up RPS animation (1s per move to fit 5 moves in 5s)
            return () => clearInterval(rpsInterval);
        }
    }, [scene, isStarted]);

    // Scene 4: Banyan Devnet Data Logic
    const [buds, setBuds] = useState<Map<string, BudData>>(new Map());
    const [rootAddress, setRootAddress] = useState<PublicKey | null>(null);
    const [isFetchingBanyan, setIsFetchingBanyan] = useState(false);

    const fetchBud = useCallback(async (address: PublicKey) => {
        try {
            const bud = await devnetClient.getBanyanBud(address.toString());
            if (!bud) return;

            setBuds(prev => new Map(prev).set(address.toString(), bud));

            if (bud.isBloomed) {
                const [left] = findChildBudPda(address, 'left');
                const [right] = findChildBudPda(address, 'right');
                fetchBud(left);
                fetchBud(right);
            }
        } catch (e) {
            console.error("Failed to fetch bud", address.toString(), e);
        }
    }, [devnetClient]);

    const fetchTreeData = useCallback(async () => {
        if (isFetchingBanyan) return;
        setIsFetchingBanyan(true);
        try {
            console.log("Fetching live Banyan tree from devnet...");
            const treePda = new PublicKey('gzp1aPJUi28WRX9ZiCLRnK94mQ922XLTob3UEtfYqa1');
            const [rootBudPda] = findBudPda(treePda, 'root');
            setRootAddress(rootBudPda);
            fetchBud(rootBudPda);
        } catch (e) {
            console.error("Failed to fetch devnet tree data", e);
        }
    }, [fetchBud, isFetchingBanyan]);

    useEffect(() => {
        if (!isStarted) return;
        // Start fetching early
        if (scene >= 0 && scene <= 3 && !rootAddress) {
            fetchTreeData();
        }
    }, [scene, fetchTreeData, rootAddress, isStarted]);

    const startDemo = () => {
        setIsStarted(true);
        if (audioRef.current) {
            audioRef.current.play().catch(e => console.error("Audio playback failed", e));
        }
    };

    const toggleMute = () => {
        const nextMuted = !isMuted;
        setIsMuted(nextMuted);
        if (audioRef.current) {
            audioRef.current.muted = nextMuted;
        }
    };

    const renderScene = () => {
        switch (scene) {
            case 0: // Logo Scene (0-5s)
                return (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100vh',
                        backgroundColor: '#000',
                        color: '#fff',
                        animation: 'fadeIn 1s ease-in-out'
                    }}>
                        <BanyanLogo size={200} />
                        <h1 style={{ fontSize: '4rem', fontWeight: 900, marginTop: '1rem', letterSpacing: '-0.05em' }}>SKRIM</h1>
                        <p style={{ fontSize: '1.5rem', opacity: 0.8 }}>Cooperation and conflict</p>
                    </div>
                );
            case 1: // Idiot Chess (5-15s)
                return (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100vh',
                        backgroundColor: theme.colors.background,
                        padding: '2rem',
                        animation: 'fadeIn 1s ease-in-out'
                    }}>
                        <h2 style={{
                            fontSize: '2.5rem',
                            fontWeight: 800,
                            marginBottom: '1.5rem',
                            color: theme.colors.primary.main,
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em'
                        }}>Idiot Chess</h2>
                        <div style={{ maxWidth: '450px', width: '100%' }}>
                            <Board
                                engine={engineRef.current}
                                state={chessState}
                                onMove={() => { }}
                                disabled={true}
                                perspective="white"
                            />
                        </div>
                        <div style={{
                            marginTop: '2rem',
                            padding: '1rem 2rem',
                            backgroundColor: 'rgba(0,0,0,0.7)',
                            borderRadius: '12px',
                            color: '#fff',
                            fontSize: '1.2rem',
                            textAlign: 'center',
                            zIndex: 10
                        }}>
                            The pawns are going hog wild! Capture all their kings to win
                        </div>
                    </div>
                );
            case 2: // RPS (15-25s)
                return (
                    <div style={{
                        height: '100vh',
                        backgroundColor: theme.colors.background,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        position: 'relative',
                        animation: 'fadeIn 1s ease-in-out'
                    }}>
                        <h2 style={{
                            fontSize: '2.5rem',
                            fontWeight: 800,
                            marginBottom: '2rem',
                            color: theme.colors.primary.main,
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            zIndex: 20
                        }}>Rock | Paper | Scissors</h2>
                        <div style={{
                            display: 'flex',
                            gap: '2rem',
                            padding: '2rem',
                            transform: `translateX(calc(50% - ${rpsIndex * 320 + 160}px))`,
                            transition: 'transform 1s ease-in-out',
                            width: 'max-content'
                        }}>
                            {[0, 1, 2, 3, 4].map((i) => (
                                <div key={i} style={{
                                    width: '300px',
                                    padding: '2rem',
                                    backgroundColor: theme.colors.card,
                                    borderRadius: '16px',
                                    border: `2px solid ${rpsIndex === i ? theme.colors.primary.main : theme.colors.border}`,
                                    textAlign: 'center',
                                    boxShadow: rpsIndex === i ? `0 0 20px ${theme.colors.primary.main}40` : 'none',
                                    transform: rpsIndex === i ? 'scale(1.05)' : 'scale(0.95)',
                                    transition: 'all 0.5s ease'
                                }}>
                                    <h3 style={{ marginBottom: '1rem' }}>Round {i + 1}</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                                        <Circle size={40} style={{ margin: 'auto', color: theme.colors.primary.main, opacity: rpsIndex === i ? 1 : 0.3 }} />
                                        <FileText size={40} style={{ margin: 'auto', color: theme.colors.secondary.main, opacity: rpsIndex === i ? 1 : 0.3 }} />
                                        <Scissors size={40} style={{ margin: 'auto', color: theme.colors.error, opacity: rpsIndex === i ? 1 : 0.3 }} />
                                        <Zap size={40} style={{ margin: 'auto', color: '#9c27b0', opacity: rpsIndex === i ? 1 : 0.3 }} />
                                        <Wind size={40} style={{ margin: 'auto', color: '#9c27b0', opacity: rpsIndex === i ? 1 : 0.3 }} />
                                        <Sparkles size={40} style={{ margin: 'auto', color: '#9c27b0', opacity: rpsIndex === i ? 1 : 0.3 }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div style={{
                            position: 'absolute',
                            bottom: '10%',
                            padding: '1.5rem 2rem',
                            backgroundColor: 'rgba(0,0,0,0.8)',
                            borderRadius: '16px',
                            color: '#fff',
                            maxWidth: '800px',
                            textAlign: 'center',
                            lineHeight: 1.4,
                            fontSize: '1.1rem'
                        }}>
                            Rock Paper Scissors: Channel your rage, find tranquility, or use trickery to outwit your opponent.
                        </div>
                    </div>
                );
            case 3: // Banyan (25-35s)
                return (
                    <div style={{
                        height: '100vh',
                        width: '100%',
                        position: 'relative',
                        animation: 'fadeIn 1s ease-in-out',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        <TreeVisualizer
                            rootBudAddress={rootAddress}
                            buds={buds}
                            onBudSelect={() => { }}
                        />
                        <div style={{
                            position: 'absolute',
                            bottom: '10%',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            padding: '1.5rem 2rem',
                            backgroundColor: 'rgba(0,0,0,0.7)',
                            borderRadius: '16px',
                            color: '#fff',
                            maxWidth: '800px',
                            textAlign: 'center',
                            zIndex: 20,
                            lineHeight: 1.4,
                            fontSize: '1.1rem'
                        }}>
                            Victory is just for one, but The Great Banyan is for all of us. Nurture the banyan and find its fruit
                        </div>
                        {!rootAddress && (
                            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'white', zIndex: 15 }}>
                                Fetching Devnet Tree...
                            </div>
                        )}
                    </div>
                );
            case 4: // Final Scene (35-40s)
                return (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100vh',
                        backgroundColor: '#000',
                        color: '#fff',
                        textAlign: 'center',
                        animation: 'fadeIn 1s ease-in-out'
                    }}>
                        <h2 style={{ fontSize: '3rem', fontWeight: 700, marginBottom: '0.5rem' }}>Scrimmage | Synergize | Succeed.</h2>
                        <p style={{ fontSize: '2rem', color: theme.colors.primary.main, fontWeight: 900 }}>skrim.xyz</p>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div style={{ width: '100%', height: '100vh', overflow: 'hidden', position: 'relative' }}>
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `}</style>

            <audio ref={audioRef} src="/audio/Ascension_of_the_Valiant.mp3" loop />

            {!isStarted ? (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100vh',
                    backgroundColor: '#000',
                    color: '#fff',
                    textAlign: 'center'
                }}>
                    <BanyanLogo size={200} />
                    <h1 style={{ fontSize: '3rem', margin: '2rem 0' }}>Skrim Demo</h1>
                    <button
                        onClick={startDemo}
                        style={{
                            padding: '1.5rem 3rem',
                            fontSize: '1.5rem',
                            backgroundColor: theme.colors.primary.main,
                            color: '#fff',
                            border: 'none',
                            borderRadius: '50px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            fontWeight: 700,
                            transition: 'transform 0.2s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        <Play size={24} fill="currentColor" />
                        Enter Demo
                    </button>
                </div>
            ) : (
                <>
                    {renderScene()}

                    {/* Mute Button */}
                    <button
                        onClick={toggleMute}
                        style={{
                            position: 'fixed',
                            top: '20px',
                            right: '20px',
                            backgroundColor: 'rgba(0,0,0,0.5)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: '50%',
                            width: '48px',
                            height: '48px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            zIndex: 1000,
                            color: '#fff'
                        }}
                    >
                        {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
                    </button>

                    {/* Progress Bar */}
                    <div style={{
                        position: 'fixed',
                        bottom: 0,
                        left: 0,
                        height: '4px',
                        width: `${(timer / 35) * 100}%`,
                        backgroundColor: theme.colors.primary.main,
                        transition: 'width 1s linear',
                        zIndex: 100
                    }} />
                </>
            )}
        </div>
    );
};

export default DemoPage;
