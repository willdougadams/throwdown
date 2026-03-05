import { Connection, PublicKey } from '@solana/web3.js';
import { GameClient, GameListItem, BudData, GameManagerData, TreeData } from './gameClient';
import { GameService } from './gameService';
import { findGameManagerPda, findTreePda } from '../components/great_banyan/utils';

export class TrustlessClient implements GameClient {
    private gameService: GameService;

    constructor(private connection: Connection) {
        this.gameService = new GameService(connection);
    }

    async getLobbyGames(type: 'rps' | 'chess'): Promise<GameListItem[]> {
        return this.gameService.getFormattedGamesForLobby(type);
    }

    async getGameDetails(type: 'rps' | 'chess', address: string): Promise<any> {
        return this.gameService.fetchGameDetails(address, type);
    }

    async getBanyanManager(): Promise<GameManagerData | null> {
        const [managerPda] = findGameManagerPda();
        const info = await this.connection.getAccountInfo(managerPda);
        if (!info) return null;

        const data = info.data;
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

        return {
            currentEpoch: view.getBigUint64(0, true).toString(),
            prizePool: view.getBigUint64(8, true).toString(),
            authority: new PublicKey(data.subarray(16, 48)).toString(),
            lastFruitBud: new PublicKey(data.subarray(48, 80)).toString(),
            lastFruitPrize: view.getBigUint64(80, true).toString(),
            lastFruitEpoch: view.getBigUint64(88, true).toString(),
            lastFruitDepth: view.getUint8(96),
        };
    }

    async getBanyanTree(epoch: bigint): Promise<{ address: string; state: TreeData } | null> {
        const [treePda] = findTreePda(epoch);
        const accountInfo = await this.connection.getAccountInfo(treePda);
        if (!accountInfo) return null;

        const data = accountInfo.data;
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

        return {
            address: treePda.toString(),
            state: {
                fruitFrequency: view.getBigUint64(0, true).toString(),
                authority: new PublicKey(data.subarray(8, 40)).toString(),
                vitalityRequiredBase: view.getBigUint64(40, true).toString()
            }
        };
    }

    async getBanyanBud(address: string): Promise<BudData | null> {
        const info = await this.connection.getAccountInfo(new PublicKey(address));
        if (!info) return null;

        const data = info.data;
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

        let offset = 0;
        const parent = new PublicKey(data.subarray(offset, offset + 32)).toString();
        offset += 32;
        const vitalityCurrent = view.getBigUint64(offset, true).toString();
        offset += 8;
        const vitalityRequired = view.getBigUint64(offset, true).toString();
        offset += 8;
        const depth = data[offset]; offset += 1;
        const isBloomed = data[offset] !== 0; offset += 1;
        const isFruit = data[offset] !== 0; offset += 1;
        const contributionCount = data[offset]; offset += 1;
        const isPayoutComplete = data[offset] !== 0; offset += 1;
        offset += 3;

        const contributions: any[] = [];
        for (let i = 0; i < 10; i++) {
            const pk = new PublicKey(data.subarray(offset, offset + 32)).toString();
            offset += 32;
            const amount = view.getBigUint64(offset, true).toString();
            offset += 8;
            if (i < contributionCount) {
                contributions.push({ pubkey: pk, amount });
            }
        }

        return {
            parent,
            depth,
            vitalityCurrent,
            vitalityRequired,
            isBloomed,
            isFruit,
            isPayoutComplete,
            contributionCount,
            contributions
        };
    }
}
