import { PublicKey } from '@solana/web3.js';

// TODO: Replace with actual program ID once deployed/configured
export const PROGRAM_ID = new PublicKey('11111111111111111111111111111111'); // Placeholder

export const findTreePda = (authority: PublicKey): [PublicKey, number] => {
    return PublicKey.findProgramAddressSync(
        [Buffer.from('tree'), authority.toBuffer()],
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
            [Buffer.from('bud'), treePda.toBuffer(), Buffer.from('root')],
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
        [Buffer.from('bud'), parentBud.toBuffer(), Buffer.from(direction)],
        PROGRAM_ID
    );
}

export interface BudAccount {
    parent: PublicKey;
    depth: number;
    vitalityCurrent: number;
    vitalityRequired: number;
    isBloomed: boolean;
    isFruit: boolean;
    nurturers: PublicKey[];
}

export interface TreeAccount {
    root: number[]; // [u8; 32]
    maxDepth: number;
    totalPot: number; // u64
    authority: PublicKey;
    vitalityRequiredBase: number;
}
