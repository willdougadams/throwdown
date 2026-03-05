import { GameClient, GameListItem, GameManagerData, TreeData, BudData } from './gameClient';

export class TrustfulClient implements GameClient {
    private baseUrl: string;

    constructor(baseUrl: string = window.location.hostname === 'localhost' ? 'http://localhost:3001' : '/api') {
        this.baseUrl = baseUrl;
    }

    async getLobbyGames(type: 'rps' | 'chess'): Promise<GameListItem[]> {
        const response = await fetch(`${this.baseUrl}/lobby/${type}`);
        if (!response.ok) throw new Error('Failed to fetch lobby');
        const data = await response.json();
        return data.map((g: any) => ({
            ...g,
            buyInSOL: Number(g.buy_in_lamports) / 1_000_000_000,
            prizePool: Number(g.prize_pool) / 1_000_000_000,
            status: g.state === 'WaitingForPlayers' ? 'waiting' :
                g.state === 'Finished' ? 'completed' : 'in_progress',
            createdAt: new Date(g.last_action_timestamp * 1000).toISOString().split('T')[0],
            players: g.player_addresses,
            id: g.game_address
        }));
    }

    async getGameDetails(type: 'rps' | 'chess', address: string): Promise<any> {
        const response = await fetch(`${this.baseUrl}/game/${type}/${address}`);
        if (!response.ok) throw new Error('Failed to fetch game details');
        const data = await response.json();

        // Re-format to match direct RPC response (simplified)
        return {
            ...data,
            players: data.player_addresses.map((pk: string, i: number) => ({
                pubkey: pk,
                slot: i,
                eliminated: data.winner ? pk !== data.winner : false
            }))
        };
    }

    async getBanyanManager(): Promise<GameManagerData | null> {
        const response = await fetch(`${this.baseUrl}/banyan/manager`);
        if (!response.ok) return null;
        return response.json();
    }

    async getBanyanTree(epoch: bigint): Promise<{ address: string; state: TreeData } | null> {
        const response = await fetch(`${this.baseUrl}/banyan/tree/${epoch}`);
        if (!response.ok) return null;
        return response.json();
    }

    async getBanyanBud(address: string): Promise<BudData | null> {
        const response = await fetch(`${this.baseUrl}/banyan/bud/${address}`);
        if (!response.ok) return null;
        return response.json();
    }
}
