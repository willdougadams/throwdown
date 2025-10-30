import React from 'react';
import { theme } from '../theme';
import { Gamepad2 } from 'lucide-react';
import GameRow from './GameRow';

interface GameListItem {
    id: string;
    name: string;
    description: string;
    status: 'waiting' | 'in_progress' | 'completed';
    players: string[];
    maxPlayers: number;
    createdAt: string;
    buyInSOL: number;
    creator: string;
    prizePool: number;
}

interface GameListProps {
    games: GameListItem[];
    error: string | null;
}

const GameList: React.FC<GameListProps> = ({ games, error }) => {
    return (
        <div style={{ marginTop: '1rem' }}>
            <div style={{ marginBottom: '1rem' }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.25rem', margin: 0, fontWeight: '600' }}>
                    <Gamepad2 size={24} /> Open Games
                </h2>
            </div>

            {error && (
                <div style={{
                    color: theme.colors.error,
                    padding: '0.75rem',
                    borderRadius: '6px',
                    marginBottom: '1rem',
                    border: `1px solid ${theme.colors.error}`,
                    fontSize: '0.9rem'
                }}>
                    {error}
                </div>
            )}

            {games.length === 0 ? (
                <div style={{
                    textAlign: 'center',
                    padding: '3rem 1rem',
                    borderRadius: '8px',
                    border: `2px dashed ${theme.colors.border}`,
                    backgroundColor: theme.colors.surface
                }}>
                    <Gamepad2 size={48} style={{ color: theme.colors.text.disabled, marginBottom: '1rem' }} />
                    <p style={{ color: theme.colors.text.secondary, fontSize: '1rem', margin: 0 }}>No games available</p>
                    <p style={{ color: theme.colors.text.disabled, fontSize: '0.85rem', margin: '0.5rem 0 0 0' }}>Create a new game to get started!</p>
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                    gap: '1rem'
                }}>
                    {games.map((game) => (
                        <GameRow key={game.id} game={game} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default GameList;