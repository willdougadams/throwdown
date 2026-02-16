import React, { useEffect, useState, useCallback } from 'react';
import { keccak_256 } from 'js-sha3';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { theme } from '../../theme';
import { TreeVisualizer } from './TreeVisualizer';
import { BudModal } from './BudModal';
import {
    findTreePda,
    findBudPda,
    findChildBudPda,
    findGameManagerPda,
    BudAccount,
    TreeAccount,
    GameManagerAccount,
    PROGRAM_ID
} from './utils';

export const GreatBanyanGame: React.FC = () => {
    const { connection } = useConnection();
    const { publicKey, sendTransaction } = useWallet();

    const [gameManager, setGameManager] = useState<GameManagerAccount | null>(null);
    const [treeState, setTreeState] = useState<TreeAccount | null>(null);
    const [buds, setBuds] = useState<Map<string, BudAccount>>(new Map());
    const [rootAddress, setRootAddress] = useState<PublicKey | null>(null);

    const [selectedBudAddress, setSelectedBudAddress] = useState<PublicKey | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // 1. Fetch Game Manager
    const fetchGameManager = useCallback(async () => {
        if (!connection) return;
        try {
            const [managerPda] = findGameManagerPda();
            const info = await connection.getAccountInfo(managerPda);
            if (!info) {
                console.log("Game Manager not found (Game might not be initialized)");
                return;
            }

            // Layout: current_epoch (u64), prize_pool (u64)
            const data = info.data;
            const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
            const currentEpoch = view.getBigUint64(0, true);
            const prizePool = view.getBigUint64(8, true);

            setGameManager({ currentEpoch, prizePool });

        } catch (e) {
            console.error("Failed to fetch game manager", e);
        }
    }, [connection]);

    // 2. Fetch Tree State (depends on GameManager)
    const fetchTree = useCallback(async () => {
        if (!gameManager || !connection) return;

        try {
            const [treePda] = findTreePda(gameManager.currentEpoch);
            const accountInfo = await connection.getAccountInfo(treePda);

            if (!accountInfo) {
                console.log("Tree account not found for epoch", gameManager.currentEpoch.toString());
                return;
            }

            // Layout: 
            // root: 32
            // max_depth: 1
            // total_pot: 8 (Removed in refactor? No, TreeState struct might still have it or removed? 
            // Checked lib.rs: TreeState struct has: root, max_depth, authority, vitality_required_base. 
            // total_pot MOVED to GameManager.
            // Let's re-check lib.rs struct definition to be safe.
            // src/lib.rs:
            // pub struct TreeState {
            //     pub root: [u8; 32],
            //     pub max_depth: u8,
            //     pub authority: [u8; 32],
            //     pub vitality_required_base: u64,
            // }
            // So total_pot is GONE.

            const data = accountInfo.data;
            let offset = 0;
            const root = Array.from(data.subarray(offset, offset + 32));
            offset += 32;
            const maxDepth = data[offset];
            offset += 1;
            const authority = new PublicKey(data.subarray(offset, offset + 32));
            offset += 32;

            const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
            // offset is 32 + 1 + 32 = 65
            const vitalityRequiredBase = Number(view.getBigUint64(offset, true));

            setTreeState({
                root,
                maxDepth,
                totalPot: 0, // Field deprecated/moved
                authority,
                vitalityRequiredBase
            });

            // Find Root Bud
            const [rootBudPda] = findBudPda(treePda, 'root');
            setRootAddress(rootBudPda);

            fetchBud(rootBudPda);

        } catch (e) {
            console.error("Failed to fetch tree", e);
        }
    }, [connection, gameManager]);

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

            const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
            // Use BigUint64 for deserialization
            const vitalityCurrent = Number(view.getBigUint64(offset, true));
            offset += 8;
            const vitalityRequired = Number(view.getBigUint64(offset, true));
            offset += 8;
            const isBloomed = data[offset] !== 0;
            offset += 1;
            const isFruit = data[offset] !== 0;
            offset += 1;

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
            fetchGameManager();
            if (gameManager) fetchTree();
        }, 5000);
        return () => clearInterval(interval);
    }, [fetchGameManager, fetchTree, gameManager]);

    // Initial load
    useEffect(() => {
        fetchGameManager();
    }, [fetchGameManager]);

    useEffect(() => {
        if (gameManager) fetchTree();
    }, [gameManager, fetchTree]);


    const handleNurture = async (essence: string) => {
        if (!selectedBudAddress || !publicKey) return;
        setIsProcessing(true);
        try {
            // ... (inside handleNurture) ...

            // 1. Get Fresh Block/Slot for Mining
            const slot = await connection.getSlot();

            // 2. Mine! (Client-Side PoW)
            // Goal: Find nonce where Hash(essence + bud + nurturer + slot + nonce) has leading zeros.
            // Tier 0 (No zeros): 1 Vitality
            // Tier 1 (1 byte zero): 50 Vitality
            // Tier 2 (2 bytes zero): 500 Vitality

            let bestNonce = 0n;
            let bestGain = 1;
            const maxIterations = 100000; // 100k hashes is fast in JS

            // Pre-compute fixed parts of hash input to speed up mining
            // Input: essence(bytes) + bud(32) + nurturer(32) + slot(8) + nonce(8)
            const encoder = new TextEncoder();
            const essenceBytes = encoder.encode(essence);
            const budBytes = selectedBudAddress.toBuffer();
            const nurturerBytes = publicKey.toBuffer();
            const slotBytes = new Uint8Array(8);
            new DataView(slotBytes.buffer).setBigUint64(0, BigInt(slot), true); // LE

            const totalLen = essenceBytes.length + 32 + 32 + 8 + 8;
            const miningBuffer = new Uint8Array(totalLen);
            let offset = 0;
            miningBuffer.set(essenceBytes, offset); offset += essenceBytes.length;
            miningBuffer.set(budBytes, offset); offset += 32;
            miningBuffer.set(nurturerBytes, offset); offset += 32;
            miningBuffer.set(slotBytes, offset); offset += 8;
            // Nonce is at the end (last 8 bytes)

            console.log(`Mining for slot ${slot}...`);
            const miningView = new DataView(miningBuffer.buffer);
            const nonceOffset = totalLen - 8;

            const start = performance.now();
            for (let i = 0; i < maxIterations; i++) {
                const nonce = BigInt(i);
                miningView.setBigUint64(nonceOffset, nonce, true); // LE

                // Hash
                const hashParams = keccak_256.array(miningBuffer); // Returns number[]
                // Calculate Gain: (h[0]%3) + (h[1]%3) + 1
                const g = (hashParams[0] % 3) + (hashParams[1] % 3) + 1;

                if (g > bestGain) {
                    bestGain = g;
                    bestNonce = nonce;
                    if (g === 5) break; // Max possible, stop
                }
            }
            const end = performance.now();
            console.log(`Mining complete in ${(end - start).toFixed(2)}ms. Found Gain ${bestGain} with nonce ${bestNonce}`);

            // Construct Transaction Data
            // [2, nonce(8), mined_slot(8), essence_len(4), essence_bytes...]

            const dataLen = 1 + 8 + 8 + 4 + essenceBytes.length;
            const data = new Uint8Array(dataLen);
            const view = new DataView(data.buffer);

            view.setUint8(0, 2); // Variant 2 (Nurture)
            view.setBigUint64(1, bestNonce, true); // Nonce
            view.setBigUint64(9, BigInt(slot), true); // Mined Slot
            view.setUint32(17, essenceBytes.length, true); // Essence Len
            data.set(essenceBytes, 21);

            // Accounts: [payer, manager, bud, system_program]
            const [managerPda] = findGameManagerPda();

            const tx = new Transaction().add({
                keys: [
                    { pubkey: publicKey, isSigner: true, isWritable: true },
                    { pubkey: managerPda, isSigner: false, isWritable: true },
                    { pubkey: selectedBudAddress, isSigner: false, isWritable: true },
                    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                ],
                programId: PROGRAM_ID,
                data: data,
            });

            const sig = await sendTransaction(tx, connection);

            // Optimistic update
            await connection.confirmTransaction(sig, 'confirmed');

            // Re-fetch everything
            fetchGameManager();
            fetchBud(selectedBudAddress);

        } catch (e) {
            console.error("Nurture failed", e);
            alert("Nurture failed: " + (e as any).message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleBloom = async () => {
        if (!selectedBudAddress || !publicKey) return;
        setIsProcessing(true);
        try {
            // BloomBud: Variant 3
            // Data: [3, proof_len(u32), proof_items...]
            // For MVP/Expansion, we send empty proof (length 0)
            const data = new Uint8Array(1 + 4);
            const view = new DataView(data.buffer);
            view.setUint8(0, 3); // Variant 3
            view.setUint32(1, 0, true); // Proof len = 0

            const [managerPda] = findGameManagerPda();
            // We need treePda. We can get it from treeState logic or re-derive
            if (!gameManager) throw new Error("Game Manager not loaded");
            const [treePda] = findTreePda(gameManager.currentEpoch);

            // Derive children PDAs
            const [leftPda] = findChildBudPda(selectedBudAddress, 'left');
            const [rightPda] = findChildBudPda(selectedBudAddress, 'right');

            console.log("Bloom Debug:");
            console.log("Tree PDA:", treePda.toString());
            console.log("Selected Bud:", selectedBudAddress.toString());
            console.log("Left Child PDA:", leftPda.toString());
            console.log("Right Child PDA:", rightPda.toString());
            console.log("Manager PDA:", managerPda.toString());
            console.log("Program ID:", PROGRAM_ID.toString());

            const tx = new Transaction().add({
                keys: [
                    { pubkey: publicKey, isSigner: true, isWritable: true },
                    { pubkey: managerPda, isSigner: false, isWritable: true },
                    { pubkey: treePda, isSigner: false, isWritable: true }, // Read-only in Rust? No, mutable (lines 252, 262 borrow data?) actually tree_state is read to verify proof. But children creation doesn't mod tree. Wait, lib.rs line 251: next_account_info. 
                    // Rust: let tree_state_info = ...; let tree_state = TreeState::try_from_slice...
                    // It is NOT written to. So isWritable: false is fine? 
                    // Pinocchio `create_account` uses `invoke_signed`.
                    // Actually, let's look at `lib.rs`: "tree_state_info" is passed. 
                    // It is NOT mutable in the instruction processing for BloomBud (only read for root).
                    // So writable: false is correct.
                    { pubkey: selectedBudAddress, isSigner: false, isWritable: true },
                    { pubkey: leftPda, isSigner: false, isWritable: true },
                    { pubkey: rightPda, isSigner: false, isWritable: true },
                    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                ],
                programId: PROGRAM_ID,
                data: data,
            });

            const sig = await sendTransaction(tx, connection);
            await connection.confirmTransaction(sig, 'confirmed');

            alert("Bloomed! Children created.");
            fetchBud(selectedBudAddress); // Refresh parent
            fetchBud(leftPda); // Fetch new children
            fetchBud(rightPda);

        } catch (e) {
            console.error("Bloom failed", e);
            alert("Bloom failed: " + (e as any).message);
        } finally {
            setIsProcessing(false);
        }
    }

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Header / Stats */}
            <div style={{
                padding: '1rem',
                backgroundColor: theme.colors.surface,
                borderRadius: '8px',
                display: 'flex',
                gap: '2rem',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                <div style={{ display: 'flex', gap: '2rem' }}>
                    <div>
                        <span style={{ color: theme.colors.text.secondary, fontSize: '0.9rem' }}>Epoch</span>
                        <div style={{ color: theme.colors.text.primary, fontSize: '1.2rem', fontWeight: 'bold' }}>
                            {gameManager?.currentEpoch.toString() || '-'}
                        </div>
                    </div>
                    <div>
                        <span style={{ color: theme.colors.text.secondary, fontSize: '0.9rem' }}>Prize Pool</span>
                        <div style={{ color: theme.colors.primary.main, fontSize: '1.2rem', fontWeight: 'bold' }}>
                            {gameManager ? (Number(gameManager.prizePool) / 1e9).toFixed(4) : '-'} SOL
                        </div>
                    </div>
                </div>

                {!publicKey && (
                    <div style={{ color: theme.colors.text.secondary }}>
                        Connect wallet to play
                    </div>
                )}
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
