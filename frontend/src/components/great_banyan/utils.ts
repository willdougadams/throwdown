import { PublicKey } from '@solana/web3.js';

import programIds from '../../../../scripts/program-ids.json';
const netData = (programIds as any).localnet;
export const PROGRAM_ID = new PublicKey(typeof netData === 'string' ? netData : netData.banyan);

export const findGameManagerPda = (): [PublicKey, number] => {
    return PublicKey.findProgramAddressSync(
        [new TextEncoder().encode('manager')],
        PROGRAM_ID
    );
};

export const findTreePda = (epoch: bigint): [PublicKey, number] => {
    // epoch is u64, need 8 bytes le
    const epochBuffer = new Uint8Array(8);
    const view = new DataView(epochBuffer.buffer);
    view.setBigUint64(0, epoch, true);

    return PublicKey.findProgramAddressSync(
        [new TextEncoder().encode('tree'), epochBuffer],
        PROGRAM_ID
    );
};

export const findBudPda = (treePda: PublicKey, path: 'root' | 'left' | 'right' | string): [PublicKey, number] => {
    // If path is a specific string (like previous bud address), we might need different logic
    // For now assuming the structure from lib.rs:
    // root: [b"bud", tree_state.key(), b"root"]
    // child: [b"bud", parent_bud.key(), b"left" | b"right"]

    if (path === 'root') {
        return PublicKey.findProgramAddressSync(
            [new TextEncoder().encode('bud'), treePda.toBuffer(), new TextEncoder().encode('root')],
            PROGRAM_ID
        );
    }

    // For children, we need the parent public key. 
    // This helper might need to adjust signature to take parent + direction
    // Returning default for now to satisfy type, but logic regarding 'string' path is still a bit loose
    // In Game.tsx and TreeVisualizer.tsx we mostly use `findChildBudPda` for recursion.
    // usage of findBudPda is mainly for root.
    return [PublicKey.default, 0];
};

export const findChildBudPda = (parentBud: PublicKey, direction: 'left' | 'right'): [PublicKey, number] => {
    return PublicKey.findProgramAddressSync(
        [new TextEncoder().encode('bud'), parentBud.toBuffer(), new TextEncoder().encode(direction)],
        PROGRAM_ID
    );
}

export interface BudAccount {
    parent: PublicKey;
    depth: number;
    vitalityCurrent: bigint;
    vitalityRequired: bigint;
    isBloomed: boolean;
    isFruit: boolean;
    isPayoutComplete: boolean;
    contributionCount: number;
    contributions: [PublicKey, bigint][];
}

export interface TreeAccount {
    fruitFrequency: number; // u64
    authority: PublicKey;
    vitalityRequiredBase: number;
}

export interface GameManagerAccount {
    currentEpoch: bigint;
    prizePool: bigint;
    authority: PublicKey;
    lastFruitBud: PublicKey;
    lastFruitPrize: bigint;
    lastFruitEpoch: bigint;
    lastFruitDepth: number;
}
