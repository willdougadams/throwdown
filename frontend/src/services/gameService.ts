import { Connection, PublicKey } from '@solana/web3.js';
import { getProgramId, getCurrentNetwork } from '../config/programIds';
import { GameAccountDeserializer } from './transactionPacker';

interface GameIndexEntry {
    game_address: string;
    creator: string;
    name: string;
    description: string;
    max_players: number;
    current_players: number;
    buy_in_lamports: bigint;
    state: string;
    stateValue: number;
    created_at: number;
    current_round?: number;
    total_rounds?: number;
    winner?: string;
}

export class GameService {
    private programId: PublicKey;

    constructor(private connection: Connection) {
        this.programId = getProgramId(); // Auto-detect network
    }


    /**
     * Fetch all games using getProgramAccounts (no registry needed!)
     */
    async fetchAllGames(): Promise<GameIndexEntry[]> {
        try {
            console.log('Fetching all game accounts using getProgramAccounts...');

            // Get all accounts owned by our program (no size filter - let's see all of them)
            const accounts = await this.connection.getProgramAccounts(this.programId, {
                commitment: 'confirmed'
                // Remove size filter to see all accounts
            });

            console.log(`Found ${accounts.length} accounts owned by program`);

            const games: GameIndexEntry[] = [];

            for (const { pubkey, account } of accounts) {
                try {
                    // Try to parse as game account
                    const gameData = GameAccountDeserializer.deserialize(account.data);

                    if (gameData) {
                        // Find winner for completed games
                        let winner: string | undefined;
                        if (gameData.state === 'Finished' && gameData.players) {
                            const winnerPlayer = gameData.players.find((p: any) => !p.eliminated);
                            winner = winnerPlayer?.pubkey;
                        }

                        // Convert to GameIndexEntry format
                        const gameEntry: GameIndexEntry = {
                            game_address: pubkey.toString(),
                            creator: gameData.creator,
                            name: gameData.name || 'Unnamed Game',
                            description: gameData.description || '',
                            max_players: gameData.max_players,
                            current_players: gameData.players.length,
                            buy_in_lamports: BigInt(gameData.buy_in_lamports || 0),
                            stateValue: gameData.state === 'WaitingForPlayers' ? 0 :
                                       gameData.state === 'InProgress' ? 1 : 2,
                            state: gameData.state || 'WaitingForPlayers',
                            created_at: Math.floor(Date.now() / 1000), // Approximate since we don't store creation time
                            current_round: gameData.current_round,
                            total_rounds: gameData.total_rounds,
                            winner: winner,
                        };

                        games.push(gameEntry);
                        console.log('Found game:', {
                            address: pubkey.toString().slice(0, 8) + '...',
                            creator: gameData.creator.slice(0, 8) + '...',
                            players: `${gameData.players.length}/${gameData.max_players}`,
                            state: gameData.state
                        });
                    }
                } catch (parseError: any) {
                    // Skip accounts that aren't game accounts
                    console.log(`Skipping account ${pubkey.toString().slice(0, 8)}... (parsing failed)`, {
                        error: parseError?.message || 'Unknown error',
                        dataSize: account.data.length,
                        firstBytes: Array.from(account.data.slice(0, 10)).map(b => b.toString(16)).join(' ')
                    });
                }
            }

            console.log(`Successfully parsed ${games.length} game accounts`);

            // Sort by address (since we don't have creation time)
            games.sort((a, b) => a.game_address.localeCompare(b.game_address));

            return games;
        } catch (error) {
            console.error('Error fetching games with getProgramAccounts:', error);
            return [];
        }
    }

    /**
     * Fetch detailed game data for a specific game
     */
    async fetchGameDetails(gameAddress: string): Promise<any | null> {
        try {
            const gamePublicKey = new PublicKey(gameAddress);
            const accountInfo = await this.connection.getAccountInfo(gamePublicKey);

            if (!accountInfo) {
                return null;
            }

            return GameAccountDeserializer.deserialize(new Uint8Array(accountInfo.data));
        } catch (error) {
            console.error('Error fetching game details:', error);
            return null;
        }
    }

    /**
     * Get formatted games for the lobby
     */
    async getFormattedGamesForLobby(): Promise<Array<{
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
        currentRound?: number;
        totalRounds?: number;
        winner?: string;
    }>> {
        console.log('Getting formatted games for lobby using getProgramAccounts...');
        console.log('Current network:', getCurrentNetwork());
        console.log('Using program ID:', this.programId.toString());

        const games = await this.fetchAllGames();
        console.log(`Found ${games.length} games, formatting for display`);

        return games.map(game => ({
            id: game.game_address,
            name: game.name,
            description: game.description,
            status: this.mapGameStateToStatus(game.state),
            players: new Array(game.current_players).fill(''), // Create array with correct length for display
            maxPlayers: game.max_players,
            createdAt: new Date(game.created_at * 1000).toISOString().split('T')[0],
            buyInSOL: GameAccountDeserializer.lamportsToSol(game.buy_in_lamports),
            creator: game.creator,
            prizePool: GameAccountDeserializer.lamportsToSol(game.buy_in_lamports) * game.max_players,
            currentRound: game.current_round,
            totalRounds: game.total_rounds,
            winner: game.winner
        }));
    }

    /**
     * Map game state to lobby status
     */
    private mapGameStateToStatus(state: string): 'waiting' | 'in_progress' | 'completed' {
        switch (state) {
            case 'WaitingForPlayers':
                return 'waiting';
            case 'Finished':
                return 'completed';
            default:
                return 'in_progress';
        }
    }
}