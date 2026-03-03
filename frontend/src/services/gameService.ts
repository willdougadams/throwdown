import { Connection, PublicKey } from '@solana/web3.js';
import { getProgramId, getCurrentNetwork } from '../config/programIds';
import { GameAccountDeserializer, WaitingAccountDeserializer, ChessGameAccountDeserializer } from './transactionPacker';

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
    player_addresses: string[];
}

export class GameService {
    constructor(private connection: Connection) {
        console.log(`[GameService] Initialized with RPC endpoint: ${this.connection.rpcEndpoint}`);
    }

    /**
     * Fetch all games using getProgramAccounts
     */
    async fetchAllGames(programType: 'rps' | 'chess' = 'rps'): Promise<GameIndexEntry[]> {
        try {
            const programId = getProgramId(programType);
            const dataSize = programType === 'chess' ? 272 : 528;

            console.log(`Fetching all ${programType} game accounts (size: ${dataSize})...`);

            const accounts = await this.connection.getProgramAccounts(programId, {
                commitment: 'confirmed',
                filters: [
                    { dataSize }
                ]
            });

            console.log(`[GameService] Found ${accounts.length} accounts owned by ${programId.toBase58()} with size ${dataSize}`);
            if (accounts.length > 0) {
                console.log(`[GameService] First account sample (truncated): ${accounts[0].account.data.slice(0, 32).toString('hex')}`);
            }

            const games: GameIndexEntry[] = [];

            for (const { pubkey, account } of accounts) {
                try {
                    let gameData;
                    if (programType === 'chess') {
                        gameData = ChessGameAccountDeserializer.deserialize(account.data);
                    } else {
                        gameData = GameAccountDeserializer.deserialize(account.data);
                    }

                    if (gameData) {
                        console.log(`[GameService] Deserialized game ${pubkey.toString().slice(0, 8)}: state=${gameData.state}, players=${gameData.players.length}`);
                        let winner: string | undefined;
                        if (gameData.state === 'Finished' && gameData.players) {
                            const winnerPlayer = gameData.players.find((p: any) => !p.eliminated);
                            winner = winnerPlayer?.pubkey;
                        }

                        const gameEntry: GameIndexEntry = {
                            game_address: pubkey.toString(),
                            creator: gameData.creator,
                            name: gameData.name || 'Unnamed Game',
                            description: gameData.description || '',
                            max_players: programType === 'chess' ? 2 : gameData.max_players,
                            current_players: gameData.players.length,
                            buy_in_lamports: BigInt(gameData.buy_in_lamports || 0),
                            stateValue: gameData.state === 'WaitingForPlayers' ? 0 :
                                gameData.state === 'InProgress' ? 1 : 2,
                            state: gameData.state || 'WaitingForPlayers',
                            created_at: Math.floor(Date.now() / 1000),
                            current_round: gameData.current_round,
                            total_rounds: gameData.total_rounds,
                            winner: winner,
                            player_addresses: gameData.players.map((p: any) => p.pubkey),
                        };

                        games.push(gameEntry);
                    }
                } catch (parseError: any) {
                    console.log(`Skipping account ${pubkey.toString().slice(0, 8)}... (parsing failed)`);
                }
            }

            games.sort((a, b) => a.game_address.localeCompare(b.game_address));
            return games;
        } catch (error) {
            console.error('Error fetching games:', error);
            return [];
        }
    }

    /**
     * Fetch the Quickplay waitlist pool (RPS Only)
     */
    async fetchWaitingPool(): Promise<Array<{ player: string, entry_fee: bigint, timestamp: number }>> {
        try {
            const programId = getProgramId('rps');
            const accounts = await this.connection.getProgramAccounts(programId, {
                commitment: 'confirmed',
                filters: [
                    { dataSize: 48 }
                ]
            });

            const pool = [];
            for (const { account } of accounts) {
                try {
                    const waitingData = WaitingAccountDeserializer.deserialize(account.data);
                    if (waitingData) {
                        pool.push(waitingData);
                    }
                } catch (e) { }
            }
            return pool;
        } catch (error) {
            console.error('Error fetching waiting pool:', error);
            return [];
        }
    }

    async fetchGameDetails(gameAddress: string, programType: 'rps' | 'chess' = 'rps'): Promise<any | null> {
        try {
            const gamePublicKey = new PublicKey(gameAddress);
            const accountInfo = await this.connection.getAccountInfo(gamePublicKey);

            if (!accountInfo) return null;

            if (programType === 'chess') {
                const result = ChessGameAccountDeserializer.deserialize(new Uint8Array(accountInfo.data));
                console.log('[GameService] fetchGameDetails (chess) result:', result);
                return result;
            } else {
                return GameAccountDeserializer.deserialize(new Uint8Array(accountInfo.data));
            }
        } catch (error) {
            console.error('Error fetching game details:', error);
            return null;
        }
    }

    async getFormattedGamesForLobby(programType: 'rps' | 'chess' = 'rps'): Promise<Array<{
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
        winner?: string;
    }>> {
        const games = await this.fetchAllGames(programType);

        return games.map(game => ({
            id: game.game_address,
            name: game.name,
            description: game.description,
            status: this.mapGameStateToStatus(game.state),
            players: game.player_addresses,
            maxPlayers: game.max_players,
            createdAt: new Date(game.created_at * 1000).toISOString().split('T')[0],
            buyInSOL: Number(game.buy_in_lamports) / 1_000_000_000,
            creator: game.creator,
            prizePool: (Number(game.buy_in_lamports) / 1_000_000_000) * game.max_players,
            winner: game.winner
        }));
    }

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
