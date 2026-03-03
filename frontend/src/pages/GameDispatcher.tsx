import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { getProgramId } from '../config/programIds';
import { theme } from '../theme';
import { Loader2 } from 'lucide-react';

const GameDispatcher: React.FC = () => {
    const { gameId } = useParams<{ gameId: string }>();
    const navigate = useNavigate();
    const { connection } = useConnection();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const dispatch = async () => {
            if (!gameId) {
                setError('No game ID provided');
                return;
            }

            try {
                const pubkey = new PublicKey(gameId);
                const accountInfo = await connection.getAccountInfo(pubkey);

                if (!accountInfo) {
                    setError('Game account not found');
                    return;
                }

                const owner = accountInfo.owner.toString();
                const rpsProgramId = getProgramId('rps', connection.rpcEndpoint.includes('devnet') ? 'devnet' : 'localnet').toString();
                const chessProgramId = getProgramId('chess', connection.rpcEndpoint.includes('devnet') ? 'devnet' : 'localnet').toString();

                if (owner === rpsProgramId) {
                    navigate(`/rps-game/${gameId}`);
                } else if (owner === chessProgramId) {
                    navigate(`/idiot-chess?gameId=${gameId}&mode=live`);
                } else {
                    setError('Unknown game type');
                }
            } catch (e: any) {
                console.error('[GameDispatcher] Error:', e);
                setError(e.message || 'Failed to resolve game type');
            }
        };

        dispatch();
    }, [gameId, connection, navigate]);

    if (error) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '60vh',
                color: theme.colors.error,
                gap: '1rem'
            }}>
                <h2>Error</h2>
                <p>{error}</p>
                <button
                    onClick={() => navigate('/')}
                    style={{
                        padding: '0.8rem 1.5rem',
                        backgroundColor: theme.colors.primary.main,
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer'
                    }}
                >
                    Back to Home
                </button>
            </div>
        );
    }

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '60vh',
            color: theme.colors.text.secondary,
            gap: '1rem'
        }}>
            <Loader2 className="animate-spin" size={48} color={theme.colors.primary.main} />
            <p>Resolving Game Type...</p>
        </div>
    );
};

export default GameDispatcher;
