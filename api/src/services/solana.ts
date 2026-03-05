import { Connection, PublicKey } from '@solana/web3.js';
import dotenv from 'dotenv';

dotenv.config();

const HELIUS_RPC_URL = process.env.HELIUS_RPC_URL || 'https://api.devnet.solana.com';

export const connection = new Connection(HELIUS_RPC_URL, 'confirmed');

export const programIds = {
    banyan: new PublicKey('8FkJUUZFMkhXkXHqcx3aLxvE54z89JofKJbvoxzKLmGg'),
    rps: new PublicKey('8KYGcmrzMW8bciXQCPn525GhPcb2hmeJs3SoHAHR3gGM'),
    chess: new PublicKey('6VKrJHfFC22zgY62JJRWmDs3jgHjEdeLaxzgN86xrmg5'),
};

// Simple TTL Cache
type CacheEntry<T> = { data: T; expiry: number };
const cacheMap = new Map<string, CacheEntry<any>>();

export async function withCache<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
    const entry = cacheMap.get(key);
    const now = Date.now();
    if (entry && entry.expiry > now) return entry.data;

    const freshData = await fetcher();
    cacheMap.set(key, { data: freshData, expiry: now + (ttlSeconds * 1000) });

    if (cacheMap.size > 1000) cacheMap.clear(); // Safety cleanup
    return freshData;
}

// Deserialization logic
export class Deserializer {
    static deserializeBud(data: Buffer): any {
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        let offset = 0;
        const parent = new PublicKey(data.subarray(offset, offset + 32));
        offset += 32;
        const vitalityCurrent = view.getBigUint64(offset, true);
        offset += 8;
        const vitalityRequired = view.getBigUint64(offset, true);
        offset += 8;
        const depth = data[offset]; offset += 1;
        const isBloomed = data[offset] !== 0; offset += 1;
        const isFruit = data[offset] !== 0; offset += 1;
        const contributionCount = data[offset]; offset += 1;
        const isPayoutComplete = data[offset] !== 0; offset += 1;
        offset += 3; // padding
        const contributions: any[] = [];
        for (let i = 0; i < 10; i++) {
            const pk = new PublicKey(data.subarray(offset, offset + 32));
            offset += 32;
            const amount = view.getBigUint64(offset, true);
            offset += 8;
            if (i < contributionCount) {
                contributions.push({ pubkey: pk.toString(), amount: amount.toString() });
            }
        }
        return {
            parent: parent.toString(),
            depth,
            vitalityCurrent: vitalityCurrent.toString(),
            vitalityRequired: vitalityRequired.toString(),
            isBloomed,
            isFruit,
            isPayoutComplete,
            contributionCount,
            contributions
        };
    }

    static deserializeTree(data: Buffer): any {
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        let offset = 0;
        const fruitFrequency = view.getBigUint64(offset, true);
        offset += 8;
        const authority = new PublicKey(data.subarray(offset, offset + 32));
        offset += 32;
        const vitalityRequiredBase = view.getBigUint64(offset, true);
        return {
            fruitFrequency: fruitFrequency.toString(),
            authority: authority.toString(),
            vitalityRequiredBase: vitalityRequiredBase.toString()
        };
    }

    static deserializeGameManager(data: Buffer): any {
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

    static deserializeRPSGame(data: Buffer, pubkey: string): any {
        const view = new DataView(data.buffer, data.byteOffset);
        let offset = 0;

        const creator = new PublicKey(data.subarray(offset, offset + 32)).toString();
        offset += 32;
        const name = new TextDecoder().decode(data.subarray(offset, offset + 64)).replace(/\0/g, '').trim();
        offset += 64;
        const description = new TextDecoder().decode(data.subarray(offset, offset + 256)).replace(/\0/g, '').trim();
        offset += 256;

        const max_players = view.getUint8(offset); offset += 1;
        const current_players = view.getUint8(offset); offset += 1;
        const state = view.getUint8(offset); offset += 1;
        offset += 5; // padding
        const last_action_timestamp = view.getBigInt64(offset, true); offset += 8;
        const buy_in_lamports = view.getBigUint64(offset, true); offset += 8;
        const prize_pool = view.getBigUint64(offset, true); offset += 8;

        const players = [];
        const playerSize = 72; // pubkey(32) + committed(32) + revealed(5) + eliminated(1) + padding(2)
        for (let i = 0; i < 2; i++) {
            const pOffset = offset + (i * playerSize);
            const pPkBytes = data.subarray(pOffset, pOffset + 32);
            if (!pPkBytes.every(b => b === 0)) {
                players.push({
                    pubkey: new PublicKey(pPkBytes).toString(),
                    eliminated: view.getUint8(pOffset + 69) !== 0
                });
            }
        }

        const stateNames = ['WaitingForPlayers', 'InProgress', 'Finished'];
        return {
            game_address: pubkey,
            creator,
            name,
            description,
            max_players,
            current_players: players.length,
            buy_in_lamports: buy_in_lamports.toString(),
            state: stateNames[state] || 'Unknown',
            prize_pool: prize_pool.toString(),
            last_action_timestamp: Number(last_action_timestamp),
            player_addresses: players.map(p => p.pubkey),
            winner: state === 2 ? players.find(p => !p.eliminated)?.pubkey : undefined
        };
    }

    static deserializeChessGame(data: Buffer, pubkey: string): any {
        const view = new DataView(data.buffer, data.byteOffset);
        let offset = 0;

        const creator = new PublicKey(data.subarray(offset, offset + 32)).toString();
        offset += 32;
        const name = new TextDecoder().decode(data.subarray(offset, offset + 64)).replace(/\0/g, '').trim();
        offset += 64;

        const last_action_timestamp = view.getBigInt64(offset, true); offset += 8;
        const buy_in_lamports = view.getBigUint64(offset, true); offset += 8;
        const prize_pool = view.getBigUint64(offset, true); offset += 8;
        const white_time = view.getBigInt64(offset, true); offset += 8;
        const black_time = view.getBigInt64(offset, true); offset += 8;

        const players = [];
        for (let i = 0; i < 2; i++) {
            const pOffset = offset + (i * 40);
            const pPkBytes = data.subarray(pOffset, pOffset + 32);
            if (!pPkBytes.every(b => b === 0)) {
                players.push({
                    pubkey: new PublicKey(pPkBytes).toString(),
                    eliminated: view.getUint8(pOffset + 32) !== 0
                });
            }
        }
        offset += 80;

        // Board and other fields simplified for lobby
        const winnerVal = view.getUint8(offset + 50 + 1); // offset + board(50) + turn(1)
        const state = winnerVal !== 0 ? 'Finished' : (players.length < 2 ? 'WaitingForPlayers' : 'InProgress');

        return {
            game_address: pubkey,
            creator,
            name,
            description: '',
            max_players: 2,
            current_players: players.length,
            buy_in_lamports: buy_in_lamports.toString(),
            state,
            prize_pool: prize_pool.toString(),
            last_action_timestamp: Number(last_action_timestamp),
            player_addresses: players.map(p => p.pubkey),
            winner: winnerVal !== 0 && winnerVal < 3 ? players[winnerVal - 1]?.pubkey : undefined
        };
    }
}
