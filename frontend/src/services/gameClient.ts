export interface GameListItem {
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
    lamports?: number;
}

export interface BudData {
    parent: string;
    depth: number;
    vitalityCurrent: string;
    vitalityRequired: string;
    isBloomed: boolean;
    isFruit: boolean;
    isPayoutComplete: boolean;
    contributionCount: number;
    contributions: Array<{ pubkey: string; amount: string }>;
}

export interface GameManagerData {
    currentEpoch: string;
    prizePool: string;
    authority: string;
    lastFruitBud: string;
    lastFruitPrize: string;
    lastFruitEpoch: string;
    lastFruitDepth: number;
}

export interface TreeData {
    fruitFrequency: string;
    authority: string;
    vitalityRequiredBase: string;
}

export interface GameClient {
    getLobbyGames(type: 'rps' | 'chess'): Promise<GameListItem[]>;
    getGameDetails(type: 'rps' | 'chess', address: string): Promise<any>;
    getBanyanManager(): Promise<GameManagerData | null>;
    getBanyanTree(epoch: bigint): Promise<{ address: string; state: TreeData } | null>;
    getBanyanBud(address: string): Promise<BudData | null>;
    onBanyanUpdate?(callback: (event: any) => void): () => void;
}
