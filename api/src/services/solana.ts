import { Connection, PublicKey } from '@solana/web3.js';
import dotenv from 'dotenv';

dotenv.config();

const network = process.env.NETWORK || 'devnet';
let rpcUrl = process.env.RPC_URL;

if (rpcUrl && network === 'devnet') {
    rpcUrl = rpcUrl.replace('mainnet', 'devnet');
}
if (!rpcUrl) {
    rpcUrl = network === 'mainnet-beta' ? 'https://api.mainnet-beta.solana.com' : 'https://api.devnet.solana.com';
}

export const connection = new Connection(rpcUrl, 'confirmed');

import { GameAccountDeserializer, ChessGameAccountDeserializer } from '@throwdown/shared';

import fs from 'fs';
import path from 'path';
import rawProgramIdsJson from '../../../scripts/program-ids.json';
const rawProgramIds: any = rawProgramIdsJson;

const networkKey = network === 'mainnet-beta' ? 'mainnet' : network;
const networkProgramIds = rawProgramIds[networkKey] || rawProgramIds.mainnet || rawProgramIds.devnet || {};

export const programIds = {
    banyan: new PublicKey(networkProgramIds.banyan),
    rps: new PublicKey(networkProgramIds.rps),
    chess: new PublicKey(networkProgramIds.chess),
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
        const game = GameAccountDeserializer.deserialize(new Uint8Array(data));
        if (!game) return null;
        
        return {
            game_address: pubkey,
            creator: game.creator,
            name: game.name || "",
            description: game.description || "",
            max_players: game.max_players,
            current_players: game.current_players,
            buy_in_lamports: game.buy_in_lamports.toString(),
            state: game.state,
            prize_pool: game.prize_pool.toString(),
            last_action_timestamp: game.last_action_timestamp,
            player_addresses: game.players.map((p: any) => p.pubkey),
            winner: game.state === 'Finished' ? game.players.find((p: any) => !p.eliminated)?.pubkey : undefined
        };
    }

    static deserializeChessGame(data: Buffer, pubkey: string): any {
        const game = ChessGameAccountDeserializer.deserialize(new Uint8Array(data));
        if (!game) return null;
        
        return {
            game_address: pubkey,
            creator: game.creator,
            name: game.name || "",
            description: game.description || "",
            max_players: game.max_players || 2,
            current_players: game.players.length,
            buy_in_lamports: game.buy_in_lamports.toString(),
            state: game.state,
            prize_pool: game.prize_pool.toString(),
            last_action_timestamp: game.last_action_timestamp,
            player_addresses: game.players.map((p: any) => p.pubkey),
            winner: game.winner === 1 ? game.players[0]?.pubkey : game.winner === 2 ? game.players[1]?.pubkey : undefined
        };
    }
}
