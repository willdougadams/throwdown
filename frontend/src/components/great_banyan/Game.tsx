import React, { useEffect, useState, useCallback } from 'react';
import { keccak_256 } from 'js-sha3';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { theme } from '../../theme';
import { GAME_RULES } from '../../config/gameRules';
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

            const data = info.data;
            const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

            // GameManager Layout (Rust):
            // current_epoch: u64 (0-8)
            // prize_pool: u64 (8-16)
            // authority: [u8; 32] (16-48)
            // last_fruit_bud: [u8; 32] (48-80)
            // last_fruit_prize: u64 (80-88)
            // last_fruit_epoch: u64 (88-96)
            // last_fruit_depth: u8 (96-97)

            setGameManager({
                currentEpoch: view.getBigUint64(0, true),
                prizePool: view.getBigUint64(8, true),
                authority: new PublicKey(data.subarray(16, 48)),
                lastFruitBud: new PublicKey(data.subarray(48, 80)),
                lastFruitPrize: view.getBigUint64(80, true),
                lastFruitEpoch: view.getBigUint64(88, true),
                lastFruitDepth: view.getUint8(96),
            });

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

            const data = accountInfo.data;
            const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

            let offset = 0;
            const fruitFrequency = Number(view.getBigUint64(offset, true));
            offset += 8;

            const authority = new PublicKey(data.subarray(offset, offset + 32));
            offset += 32;

            const vitalityRequiredBase = Number(view.getBigUint64(offset, true));

            setTreeState({
                fruitFrequency,
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
            const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

            // Bud Layout (Rust):
            // parent: 32 (0-32)
            // vitality_current: 8 (32-40)
            // vitality_required: 8 (40-48)
            // depth: 1 (48-49)
            // is_bloomed: 1 (49-50)
            // is_fruit: 1 (50-51)
            // contribution_count: 1 (51-52)
            // is_payout_complete: 1 (52-53)
            // _padding: 3 (53-56)
            // contributions: [Contribution; 10] (56-456) -> Each Contribution is { key: 32, vitality: 8 }

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

            const contributions: [PublicKey, bigint][] = [];
            for (let i = 0; i < 10; i++) {
                const pk = new PublicKey(data.subarray(offset, offset + 32));
                offset += 32;
                const amount = view.getBigUint64(offset, true);
                offset += 8;
                if (i < contributionCount) {
                    contributions.push([pk, amount]);
                }
            }

            const budAcc: BudAccount = {
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
                // @ts-ignore - Typing mismatch but works at runtime
                const hashParams = keccak_256.array(miningBuffer);
                // Calculate Gain: (h[0]%3) + 3
                const g = (hashParams[0] % 3) + 3;

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

            // Accounts: [payer, manager, bud, system_program, tree, left, right]
            const [managerPda] = findGameManagerPda();
            if (!gameManager) throw new Error("Game Manager not loaded");
            const [treePda] = findTreePda(gameManager.currentEpoch);
            const [leftPda] = findChildBudPda(selectedBudAddress, 'left');
            const [rightPda] = findChildBudPda(selectedBudAddress, 'right');

            const tx = new Transaction().add({
                keys: [
                    { pubkey: publicKey, isSigner: true, isWritable: true },
                    { pubkey: managerPda, isSigner: false, isWritable: true },
                    { pubkey: selectedBudAddress, isSigner: false, isWritable: true },
                    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                    // Extra accounts for auto-bloom
                    { pubkey: treePda, isSigner: false, isWritable: false },
                    { pubkey: leftPda, isSigner: false, isWritable: true },
                    { pubkey: rightPda, isSigner: false, isWritable: true },
                ],
                programId: PROGRAM_ID,
                data: Buffer.from(data),
            });

            const sig = await sendTransaction(tx, connection);
            console.log(`Nurture sent: ${sig}`);

            await connection.confirmTransaction(sig, 'confirmed');

            // Re-fetch everything
            fetchGameManager();
            await fetchBud(selectedBudAddress);

            // If it bloomed, fetch the new children too
            const updatedBud = buds.get(selectedBudAddress.toString());
            if (updatedBud?.isBloomed) {
                console.log("Bud bloomed! Fetching children...");
                fetchBud(leftPda);
                fetchBud(rightPda);
            }

            // Auto-close after 1 second
            setTimeout(() => {
                setSelectedBudAddress(null);
            }, 1000);

        } catch (e) {
            console.error("Nurture failed", e);
            if ((e as any).logs) {
                console.log("Transaction Logs:", (e as any).logs);
            }
            alert("Nurture failed: " + (e as any).message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDistributeReward = async () => {
        if (!selectedBudAddress || !publicKey || !gameManager) return;
        setIsProcessing(true);
        try {
            const [managerPda] = findGameManagerPda();
            const data = Buffer.from([3]); // DistributeNodeReward

            const bud = buds.get(selectedBudAddress.toString());
            if (!bud) throw new Error("Bud data not found");

            // Collect all contributor accounts in order
            const keys = [
                { pubkey: publicKey, isSigner: true, isWritable: true },
                { pubkey: managerPda, isSigner: false, isWritable: true },
                { pubkey: selectedBudAddress, isSigner: false, isWritable: true },
            ];

            // Add contributors
            for (const [pk, _] of bud.contributions) {
                keys.push({ pubkey: pk, isSigner: false, isWritable: true });
            }

            // ADD NURTURER (cranker) as the last account
            keys.push({ pubkey: publicKey, isSigner: false, isWritable: true });

            const tx = new Transaction().add({
                keys,
                programId: PROGRAM_ID,
                data
            });

            const sig = await sendTransaction(tx, connection);
            await connection.confirmTransaction(sig, 'confirmed');

            alert("Rewards distributed successfully!");
            await fetchBud(selectedBudAddress);
            await fetchGameManager();

        } catch (e) {
            console.error("Distribution failed", e);
            alert("Distribution failed: " + (e as any).message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleInitializeTree = async () => {
        if (!gameManager || !publicKey) return;
        setIsProcessing(true);
        try {
            // InitializeTree: Variant 1
            const fruitFreq = GAME_RULES.FRUIT_FREQUENCY;
            const vitalityReq = GAME_RULES.VITALITY_REQUIRED_BASE;

            const data = new Uint8Array(1 + 8 + 8);
            const view = new DataView(data.buffer);
            view.setUint8(0, 1);
            view.setBigUint64(1, fruitFreq, true);
            view.setBigUint64(9, vitalityReq, true);

            const [treePda] = findTreePda(gameManager.currentEpoch);
            const [rootBudPda] = findBudPda(treePda, 'root');
            const [managerPda] = findGameManagerPda();

            const tx = new Transaction().add({
                keys: [
                    { pubkey: publicKey, isSigner: true, isWritable: true },
                    { pubkey: managerPda, isSigner: false, isWritable: true },
                    { pubkey: treePda, isSigner: false, isWritable: true },
                    { pubkey: rootBudPda, isSigner: false, isWritable: true },
                    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                ],
                programId: PROGRAM_ID,
                data: Buffer.from(data),
            });

            const sig = await sendTransaction(tx, connection);
            await connection.confirmTransaction(sig, 'confirmed');

            alert("Tree Initialized for Epoch " + gameManager.currentEpoch.toString());
            fetchTree();
        } catch (e) {
            console.error("Initialization failed", e);
            alert("Initialization failed: " + (e as any).message);
        } finally {
            setIsProcessing(false);
        }
    };

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

                {publicKey && !treeState && (
                    <button
                        onClick={handleInitializeTree}
                        disabled={isProcessing}
                        style={{
                            padding: '0.5rem 1rem',
                            backgroundColor: theme.colors.primary.main,
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        {isProcessing ? 'Initializing...' : 'Initialize Tree for Epoch ' + (gameManager?.currentEpoch.toString() || '0')}
                    </button>
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
                gameManager={gameManager}
                onNurture={handleNurture}
                onDistributeReward={handleDistributeReward}
                isProcessing={isProcessing}
            />
        </div>
    );
};
