import { useTranslation } from 'react-i18next';
import { MatchupTile } from './MatchupTile';
import { Trophy } from 'lucide-react';
import { theme } from '../theme';
import { generateReadableName } from '../utils/nameGenerator';
import { Move, MatchState, GameState, Player, MatchupPlayerData, Matchup } from '../types/game';

interface GameData {
    id: string;
    state: GameState;
    players: Player[];
    maxPlayers: number;
    winner?: Player;
}

interface MatchupDisplayProps {
    gameData: GameData;
    rawGameData: any;
    currentUserPublicKey: string | null;
    onMatchupClick: () => void;
    onRefresh: () => void;
    isUserInGame: boolean;
    onClaimPrize: () => void;
    onJoin?: (slot: number) => void;
    gameAccountBalance?: number;
}

export function MatchupDisplay({
    gameData,
    rawGameData,
    currentUserPublicKey,
    onMatchupClick,
    onRefresh,
    isUserInGame,
    onJoin,
    onClaimPrize,
    gameAccountBalance
}: MatchupDisplayProps) {
    const { t } = useTranslation();

    // Helper to extract moves (now only one set of moves since MAX_ROUNDS = 1)
    const getPlayerMoves = (playerPubkey: string): Move[] | undefined => {
        if (!rawGameData?.players) return undefined;

        const player = rawGameData.players.find((p: any) =>
            (p.pubkey || p.toString()) === playerPubkey
        );

        if (!player || !player.moves_revealed) return undefined;

        const moves = player.moves_revealed.filter((m: any) => m !== null && m !== undefined);
        if (moves.length === 0) return undefined;

        return moves.map((m: number) => {
            if (m === 0) return 'rock';
            if (m === 1) return 'paper';
            if (m === 2) return 'scissors';
            return 'rock';
        }) as Move[];
    };

    const hasPlayerSubmittedMoves = (playerPubkey: string): boolean => {
        if (!rawGameData?.players) return false;
        const player = rawGameData.players.find((p: any) =>
            (p.pubkey || p.toString()) === playerPubkey
        );
        if (!player || !player.moves_committed) return false;

        const movesCommitted = Array.isArray(player.moves_committed)
            ? player.moves_committed
            : Array.from(player.moves_committed);

        return movesCommitted.some((byte: any) => {
            const byteValue = typeof byte === 'number' ? byte : parseInt(byte);
            return !isNaN(byteValue) && byteValue !== 0;
        });
    };

    const hasPlayerRevealedMoves = (playerPubkey: string): boolean => {
        if (!rawGameData?.players) return false;
        const player = rawGameData.players.find((p: any) =>
            (p.pubkey || p.toString()) === playerPubkey
        );
        // Correct check: moves_revealed is [u8; 5], non-null means revealed
        return !!(player && player.moves_revealed && player.moves_revealed.some((m: any) => m !== null));
    };

    const findPlayerBySlot = (slot: number): Player | undefined => {
        return gameData.players.find(p => p.slot === slot);
    };

    const buildPlayerData = (player: Player | undefined, slot: number): MatchupPlayerData => {
        if (!player) {
            return { player: undefined, moves: undefined, hasSubmitted: false, hasRevealed: false, isWinner: false, slot };
        }

        const moves = getPlayerMoves(player.publicKey);
        const hasSubmitted = hasPlayerSubmittedMoves(player.publicKey);
        const hasRevealed = hasPlayerRevealedMoves(player.publicKey);
        const isWinner = gameData.winner?.publicKey === player.publicKey;

        return { player, moves, hasSubmitted, hasRevealed, isWinner, slot: player.slot };
    };

    // 1v1 Matchup Logic
    const player1 = findPlayerBySlot(0);
    const player2 = findPlayerBySlot(1);

    let matchState: MatchState = 'waiting_for_players';
    if (player1 && player2) {
        if (gameData.state === 'in_progress') {
            const p1Submitted = hasPlayerSubmittedMoves(player1.publicKey);
            const p2Submitted = hasPlayerSubmittedMoves(player2.publicKey);
            const p1Revealed = hasPlayerRevealedMoves(player1.publicKey);
            const p2Revealed = hasPlayerRevealedMoves(player2.publicKey);

            if (!p1Submitted || !p2Submitted) {
                matchState = 'waiting_for_moves';
            } else if (!p1Revealed || !p2Revealed) {
                matchState = 'waiting_for_reveals';
            } else {
                matchState = 'completed';
            }
        } else if (gameData.state === 'completed') {
            matchState = 'completed';
        } else {
            matchState = 'ready_to_play';
        }
    }

    const isCurrentUserInMatch = !!(currentUserPublicKey && (
        player1?.publicKey === currentUserPublicKey ||
        player2?.publicKey === currentUserPublicKey
    ));

    const matchup: Matchup = {
        player1: buildPlayerData(player1, 0),
        player2: buildPlayerData(player2, 1),
        matchState,
        isCurrentUserInMatch,
        gameId: gameData.id,
        gameState: gameData.state
    };

    // Determine Prize Information
    const prizePool = rawGameData?.prize_pool || BigInt(0);
    const prizeAmountSOL = Number(prizePool) / 1_000_000_000;
    const prizeClaimed = gameAccountBalance !== undefined
        ? gameAccountBalance < (Number(prizePool) * 0.1)
        : false;

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: theme.spacing['2xl'],
            padding: theme.spacing.xl,
            minHeight: '60vh',
            justifyContent: 'center'
        }}>
            {/* 1v1 Matchup Tile */}
            <div style={{ maxWidth: '400px', width: '100%' }}>
                <MatchupTile
                    matchup={matchup}
                    currentUserPublicKey={currentUserPublicKey}
                    isUserInGame={isUserInGame}
                    onMatchupClick={onMatchupClick}
                    onRefresh={onRefresh}
                    onJoin={onJoin}
                />
            </div>

            {/* Podium - only show when game is completed */}
            {gameData.state === 'completed' && gameData.winner && (
                <div style={{
                    backgroundColor: theme.colors.card,
                    borderRadius: theme.borderRadius.xl,
                    padding: theme.spacing.xl,
                    boxShadow: '0 4px 16px rgba(255, 215, 0, 0.3)',
                    border: '2px solid #ffd700',
                    textAlign: 'center',
                    maxWidth: '400px',
                    width: '100%'
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: theme.spacing.sm,
                        color: '#ffd700',
                        marginBottom: theme.spacing.md,
                        fontWeight: 'bold',
                        fontSize: theme.fontSize.lg
                    }}>
                        <Trophy size={24} fill="#ffd700" />
                        {t('rps.game.match_winner')}
                    </div>
                    <div style={{
                        fontSize: theme.fontSize['2xl'],
                        fontWeight: theme.fontWeight.bold,
                        color: theme.colors.text.primary,
                        marginBottom: theme.spacing.sm
                    }}>
                        {gameData.winner.nickname || t('rps.game.player_label')}
                    </div>
                    <div style={{
                        fontSize: theme.fontSize.sm,
                        color: theme.colors.text.secondary,
                        fontFamily: 'monospace',
                        marginBottom: theme.spacing.lg
                    }} title={gameData.winner.publicKey}>
                        {generateReadableName(gameData.winner.publicKey)}
                    </div>

                    {currentUserPublicKey === gameData.winner.publicKey && (
                        <div>
                            {prizeClaimed ? (
                                <div style={{
                                    padding: theme.spacing.md,
                                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                                    borderRadius: theme.borderRadius.md,
                                    border: `2px solid ${theme.colors.success}`,
                                    color: theme.colors.success,
                                    fontWeight: 'bold'
                                }}>
                                    {t('rps.game.prize_claimed_sol', { amount: prizeAmountSOL.toFixed(4) })}
                                </div>
                            ) : (
                                <button
                                    onClick={onClaimPrize}
                                    style={{
                                        padding: `${theme.spacing.md} ${theme.spacing.xl}`,
                                        backgroundColor: '#ffd700',
                                        color: '#000',
                                        border: 'none',
                                        borderRadius: theme.borderRadius.md,
                                        cursor: 'pointer',
                                        fontSize: theme.fontSize.lg,
                                        fontWeight: theme.fontWeight.bold,
                                        width: '100%'
                                    }}
                                >
                                    {t('rps.game.claim_prize_sol', { amount: prizeAmountSOL.toFixed(4) })}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
