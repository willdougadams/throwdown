import React, { useEffect, useState, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { deserialize } from 'borsh';
import { theme } from '../../theme';
import { TreeVisualizer } from './TreeVisualizer';
import { BudModal } from './BudModal';
import {
    findTreePda,
    findBudPda,
    findChildBudPda,
    BudAccount,
    TreeAccount,
    PROGRAM_ID
} from './utils';

// Borsh Schemas
class TreeState {
    root: number[] = [];
    max_depth: number = 0;
    total_pot: number | bigint = 0;
    authority: number[] = [];
    vitality_required_base: number | bigint = 0;

    constructor(fields: any) {
        if (fields) {
            this.root = fields.root;
            this.max_depth = fields.max_depth;
            this.total_pot = fields.total_pot;
            this.authority = fields.authority;
            this.vitality_required_base = fields.vitality_required_base;
        }
    }
}

class Bud {
    parent: number[] = [];
    depth: number = 0;
    vitality_current: number | bigint = 0;
    vitality_required: number | bigint = 0;
    is_bloomed: boolean = false;
    is_fruit: boolean = false;
    nurturers: number[][] = [];

    constructor(fields: any) {
        if (fields) {
            this.parent = fields.parent;
            this.depth = fields.depth;
            this.vitality_current = fields.vitality_current;
            this.vitality_required = fields.vitality_required;
            this.is_bloomed = fields.is_bloomed;
            this.is_fruit = fields.is_fruit;
            this.nurturers = fields.nurturers;
        }
    }
}

const TreeSchema = new Map([
    [TreeState, {
        kind: 'struct',
        fields: [
            ['root', [32]],
            ['max_depth', 'u8'],
            ['total_pot', 'u64'],
            ['authority', [32]],
            ['vitality_required_base', 'u64']
        ]
    }]
]);

const BudSchema = new Map([
    [Bud, {
        kind: 'struct',
        fields: [
            ['parent', [32]],
            ['depth', 'u8'],
            ['vitality_current', 'u64'],
            ['vitality_required', 'u64'],
            ['is_bloomed', 'u8'], // bool as u8 in borsh used by pinocchio sometimes, or just bool? 
            // In lib.rs it is `bool`. Borsh handles bool as 1 byte usually.
            // Let's restart: Rust `bool` is `u8` (0 or 1).
            // HOWEVER, borsh-js sometimes has issues if we don't specify 'u8' explicitly for bools if simple 'bool' fails.
            // Standard borsh-js supports 'u8' for bools if mapped manually. 
            // Let's try standard types first.
            // Wait, standard borsh uses 'u8' for bool? No.
            ['is_fruit', 'u8'],
            ['nurturers', [[32]]] // Vec<[u8; 32]>
        ]
    }]
]);

// Actually, let's fix the schema. Rust `bool` -> `u8` mapping is safer for custom decoding if we encounter issues.
// But let's try to align with standard Borsh.
// Pinocchio might use standard Borsh.
// Let's use a simpler custom deserializer if needed or just `any` for now if schema is tricky.
// Actually, I can just use `borsh.deserialize` with a flexible schema.

// REVISED SCHEMAS
const TREE_SCHEMA = {
    struct: {
        root: { array: { type: 'u8', len: 32 } },
        max_depth: 'u8',
        total_pot: 'u64',
        authority: { array: { type: 'u8', len: 32 } },
        vitality_required_base: 'u64'
    }
};
// Managing schemas in JS manually is pain. Let's try to do manual parsing or simple buffer reading if struct is simple.
// Or use the `borsh` library correctly.
// Let's stick to the class-based approach which `borsh` library expects.

export const GreatBanyanGame: React.FC = () => {
    const { connection } = useConnection();
    const { publicKey, sendTransaction } = useWallet();

    const [treeState, setTreeState] = useState<TreeAccount | null>(null);
    const [buds, setBuds] = useState<Map<string, BudAccount>>(new Map());
    const [rootAddress, setRootAddress] = useState<PublicKey | null>(null);

    const [selectedBudAddress, setSelectedBudAddress] = useState<PublicKey | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // 1. Fetch Tree State
    // We need an authority to find the tree.
    // CAUTION: The authority is the deployer or a specific key.
    // If we don't know the authority, we can't find the PDA.
    // We might need to ask the user to input the authority or hardcode a "Game Master" key.
    // For now, let's assume the CURRENT USER is the authority for testing (if they deployed it).
    // OR we can't find it.

    // TEMPORARY: Use a hardcoded well-known authority or allow user to set it.
    // Let's fallback to current wallet for creating/viewing if they are the creator.
    // Or ask for input.
    // Better: Allow entering tree authority in UI if not found.
    const [authorityInput, setAuthorityInput] = useState('');
    const [treeAuthority, setTreeAuthority] = useState<PublicKey | null>(null);

    // Initial load try
    useEffect(() => {
        if (publicKey && !treeAuthority) {
            // Default to self for dev
            setTreeAuthority(publicKey);
            setAuthorityInput(publicKey.toString());
        }
    }, [publicKey]);

    const fetchTree = useCallback(async () => {
        if (!treeAuthority || !connection) return;

        try {
            const [treePda] = findTreePda(treeAuthority);
            const accountInfo = await connection.getAccountInfo(treePda);

            if (!accountInfo) {
                console.log("Tree account not found");
                return;
            }

            // Manual deserialize for now to avoid schema hell
            // Layout: 
            // root: 32
            // max_depth: 1
            // total_pot: 8
            // authority: 32
            // vitality_req: 8
            const data = accountInfo.data;
            const root = Array.from(data.subarray(0, 32));
            const maxDepth = data[32];
            // ... parsing is tedious. 
            // In a real app we'd use a proper IDL or schema.
            // Let's assume purely visual for now and not crash if parse fails

            setTreeState({
                root,
                maxDepth,
                totalPot: 0, // placeholder
                authority: treeAuthority,
                vitalityRequiredBase: 0 // placeholder
            });

            // Find Root Bud
            const [rootBudPda] = findBudPda(treePda, 'root');
            setRootAddress(rootBudPda);

            // Start fetching buds recursively?
            // Or just fetch root and let user expand?
            // Let's fetch root first.
            fetchBud(rootBudPda);

        } catch (e) {
            console.error("Failed to fetch tree", e);
        }
    }, [connection, treeAuthority]);

    // Fetch Bud Helper
    const fetchBud = async (address: PublicKey) => {
        if (!connection) return;
        try {
            const info = await connection.getAccountInfo(address);
            if (!info) return;

            const data = info.data;
            // Layout:
            // parent: 32
            // depth: 1
            // vitality_current: 8
            // vitality_required: 8
            // is_bloomed: 1
            // is_fruit: 1
            // nurturers: variable (u32 len + vec)

            let offset = 0;
            const parent = new PublicKey(data.subarray(offset, offset + 32));
            offset += 32;
            const depth = data[offset];
            offset += 1;
            const vitalityCurrent = Number(data.readBigUInt64LE(offset));
            offset += 8;
            const vitalityRequired = Number(data.readBigUInt64LE(offset));
            offset += 8;
            const isBloomed = data[offset] !== 0;
            offset += 1;
            const isFruit = data[offset] !== 0;
            offset += 1;

            // We ignore nurturers for visualization

            const budAcc: BudAccount = {
                parent,
                depth,
                vitalityCurrent,
                vitalityRequired,
                isBloomed,
                isFruit,
                nurturers: []
            };

            setBuds(prev => new Map(prev).set(address.toString(), budAcc));

            // If bloomed, fetch children
            if (isBloomed) {
                const [left] = findChildBudPda(address, 'left');
                const [right] = findChildBudPda(address, 'right');
                // Avoid infinite loops if already fetched
                if (!buds.has(left.toString())) fetchBud(left);
                if (!buds.has(right.toString())) fetchBud(right);
            }

        } catch (e) {
            console.error("Failed to fetch bud", address.toString(), e);
        }
    };

    // Refresh loop
    useEffect(() => {
        const interval = setInterval(() => {
            if (treeAuthority) fetchTree();
        }, 5000);
        return () => clearInterval(interval);
    }, [fetchTree, treeAuthority]);

    // Initial manual fetch
    useEffect(() => {
        if (treeAuthority) fetchTree();
    }, [treeAuthority]);


    const handleNurture = async (essence: string) => {
        if (!selectedBudAddress || !publicKey) return;
        setIsProcessing(true);
        try {
            // Construct Instruction manually
            // 4 bytes discriminator? No, standard borsh enum likely?
            // Rust enum `BanyanInstruction`:
            // InitializeTree = 0
            // NurtureBud = 1
            // BloomBud = 2

            // NurtureBud data: [1, essence_len, essence_bytes...]

            const essenceBytes = Buffer.from(essence, 'utf8');
            const data = Buffer.alloc(1 + 4 + essenceBytes.length);
            data.writeUInt8(1, 0); // Enum variant 1
            data.writeUInt32LE(essenceBytes.length, 1);
            data.write(essence, 5);

            // Accounts: nurturer, tree_state, bud, system_program
            const [treePda] = findTreePda(treeAuthority!);

            const tx = new Transaction().add({
                keys: [
                    { pubkey: publicKey, isSigner: true, isWritable: true },
                    { pubkey: treePda, isSigner: false, isWritable: true },
                    { pubkey: selectedBudAddress, isSigner: false, isWritable: true },
                    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                ],
                programId: PROGRAM_ID,
                data: data,
            });

            const sig = await sendTransaction(tx, connection);
            console.log("Nurture tx:", sig);

            // Optimistic update or wait for refresh
            await connection.confirmTransaction(sig, 'confirmed');
            fetchBud(selectedBudAddress);

        } catch (e) {
            console.error("Nurture failed", e);
            alert("Nurture failed: " + (e as any).message);
        } finally {
            setIsProcessing(false);
            // Don't close modal, just refresh
        }
    };

    const handleBloom = async () => {
        if (!selectedBudAddress || !publicKey) return;
        setIsProcessing(true);
        try {
            // bloom logic...
            // Variant 2
            // Needs proof... that's hard.
            // If tree is empty (root only), proof is empty?

            // For now, just try sending empty proof for testing if it's simpler
            // Or implement full Merkle proof generation on frontend (needs tree state)

            // Let's punt on Bloom for this first pass or just alert
            alert("Bloom requires Merkle Proof generation which is not yet implemented in frontend.");

        } catch (e) {
            console.error("Bloom failed", e);
        } finally {
            setIsProcessing(false);
        }
    }

    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Header / Controls */}
            <div style={{
                padding: '1rem',
                backgroundColor: theme.colors.surface,
                borderRadius: '8px',
                display: 'flex',
                gap: '1rem',
                alignItems: 'center'
            }}>
                <span style={{ color: theme.colors.text.primary, fontWeight: 'bold' }}>Game Authority:</span>
                <input
                    value={authorityInput}
                    onChange={(e) => setAuthorityInput(e.target.value)}
                    style={{
                        background: theme.colors.background,
                        border: `1px solid ${theme.colors.border}`,
                        color: theme.colors.text.primary,
                        padding: '0.5rem',
                        borderRadius: '4px',
                        flex: 1,
                        fontFamily: 'monospace'
                    }}
                />
                <button
                    onClick={() => {
                        try {
                            setTreeAuthority(new PublicKey(authorityInput));
                        } catch (e) {
                            alert("Invalid Public Key");
                        }
                    }}
                    style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: theme.colors.primary.main,
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    Load Tree
                </button>
            </div>

            {/* Visualization */}
            <TreeVisualizer
                rootBudAddress={rootAddress}
                buds={buds}
                onBudSelect={setSelectedBudAddress}
            />

            {/* Modal */}
            <BudModal
                isOpen={!!selectedBudAddress}
                onClose={() => setSelectedBudAddress(null)}
                bud={selectedBudAddress ? buds.get(selectedBudAddress.toString()) || null : null}
                budAddress={selectedBudAddress}
                onNurture={handleNurture}
                onBloom={handleBloom}
                isProcessing={isProcessing}
            />
        </div>
    );
};
