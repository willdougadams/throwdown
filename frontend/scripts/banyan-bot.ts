import { Connection, Keypair, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import { keccak_256 } from 'js-sha3';
import { GAME_RULES } from '../src/config/gameRules';

// --- Configuration ---
const ID_FILE = path.join(__dirname, '../../scripts/program-ids.json');

// --- Types ---
interface GameManagerAccount {
    currentEpoch: bigint;
    prizePool: bigint;
    authority: PublicKey;
    lastFruitBud: PublicKey;
    lastFruitPrize: bigint;
    lastFruitTotalPrize: bigint;
    lastFruitEpoch: bigint;
    lastFruitDepth: number;
}

interface TreeAccount {
    fruitFrequency: bigint;
    authority: PublicKey;
    vitalityRequiredBase: bigint;
}

interface BudAccount {
    address: PublicKey;
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

// --- Main Bot Logic ---

async function main() {
    const network = process.argv[2] || 'localnet';
    console.log(`🤖 Banyan Bot Starting on ${network}...`);

    // 1. Setup Connection
    let rpcUrl = "http://127.0.0.1:8899";
    if (network === 'devnet') {
        rpcUrl = 'https://api.devnet.solana.com';
    } else if (network === 'mainnet') {
        rpcUrl = 'https://api.mainnet-beta.solana.com';
    }
    const connection = new Connection(rpcUrl, "confirmed");

    // 2. Setup Wallet
    const home = process.env.HOME || process.env.USERPROFILE;
    const keyPath = path.join(home!, '.config/solana/id.json');
    let payer: Keypair;

    if (fs.existsSync(keyPath)) {
        const keyData = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
        payer = Keypair.fromSecretKey(new Uint8Array(keyData));
        console.log(`🔑 Using existing wallet: ${payer.publicKey.toString()}`);
    } else {
        payer = Keypair.generate();
        console.log(`🔑 Generated temporary wallet: ${payer.publicKey.toString()}`);
        if (network === 'localnet') {
            try {
                console.log("💧 Airdropping SOL...");
                const sig = await connection.requestAirdrop(payer.publicKey, 1_000_000_000); // 1 SOL
                await connection.confirmTransaction(sig);
                console.log("✅ Airdrop complete.");
            } catch (e) {
                console.error("❌ Airdrop failed. Is the validator running?");
                process.exit(1);
            }
        } else {
            console.error("❌ No local wallet found and not on localnet. Please provide a wallet at ~/.config/solana/id.json");
            process.exit(1);
        }
    }

    // 3. Load Program ID
    if (!fs.existsSync(ID_FILE)) {
        console.error(`❌ Program ID file not found at ${ID_FILE}`);
        process.exit(1);
    }
    const ids = JSON.parse(fs.readFileSync(ID_FILE, 'utf8'));
    const netData = ids[network];
    const programIdStr = typeof netData === 'string' ? netData : netData?.banyan;

    if (!programIdStr) {
        console.error(`❌ No ${network} account found in ID file.`);
        process.exit(1);
    }
    const PROGRAM_ID = new PublicKey(programIdStr);
    console.log(`📜 Program ID: ${PROGRAM_ID.toString()}`);

    // --- Helpers ---
    const findGameManagerPda = () =>
        PublicKey.findProgramAddressSync([Buffer.from("manager_v4")], PROGRAM_ID);

    const findTreePda = (epoch: bigint) => {
        const epochBuf = Buffer.alloc(8);
        epochBuf.writeBigUInt64LE(epoch);
        return PublicKey.findProgramAddressSync([Buffer.from("tree_v4"), epochBuf], PROGRAM_ID);
    };

    const findBudPda = (treePda: PublicKey, p: string) =>
        PublicKey.findProgramAddressSync(
            [Buffer.from("bud"), treePda.toBuffer(), Buffer.from(p)],
            PROGRAM_ID
        );

    const findChildBudPda = (parent: PublicKey, dir: 'left' | 'right') =>
        PublicKey.findProgramAddressSync(
            [Buffer.from("bud"), parent.toBuffer(), Buffer.from(dir)],
            PROGRAM_ID
        );

    // --- Game Logic ---

    async function fetchGameManager(): Promise<GameManagerAccount | null> {
        const [pda] = findGameManagerPda();
        const info = await connection.getAccountInfo(pda);
        if (!info) return null;
        const view = new DataView(info.data.buffer, info.data.byteOffset, info.data.byteLength);
        return {
            currentEpoch: view.getBigUint64(0, true),
            prizePool: view.getBigUint64(8, true),
            authority: new PublicKey(info.data.subarray(16, 16 + 32)),
            lastFruitBud: new PublicKey(info.data.subarray(48, 48 + 32)),
            lastFruitPrize: view.getBigUint64(80, true),
            lastFruitTotalPrize: view.getBigUint64(88, true),
            lastFruitEpoch: view.getBigUint64(96, true),
            lastFruitDepth: info.data[104],
        };
        // Note: Verify offset based on Rust struct
    }

    async function fetchTree(epoch: bigint): Promise<{ account: TreeAccount, address: PublicKey } | null> {
        const [pda] = findTreePda(epoch);
        const info = await connection.getAccountInfo(pda);
        if (!info) return null;

        const view = new DataView(info.data.buffer, info.data.byteOffset, info.data.byteLength);
        let offset = 0;
        const fruitFrequency = view.getBigUint64(offset, true); offset += 8;
        const authority = new PublicKey(info.data.subarray(offset, offset + 32)); offset += 32;
        const vitalityRequiredBase = view.getBigUint64(offset, true); offset += 8;

        return {
            address: pda,
            account: { fruitFrequency, authority, vitalityRequiredBase }
        };
    }

    async function fetchBud(address: PublicKey): Promise<BudAccount | null> {
        const info = await connection.getAccountInfo(address);
        if (!info) return null;

        const view = new DataView(info.data.buffer, info.data.byteOffset, info.data.byteLength);
        let offset = 0;
        const parent = new PublicKey(info.data.subarray(offset, offset + 32)); offset += 32;
        const vitalityCurrent = view.getBigUint64(offset, true); offset += 8;
        const vitalityRequired = view.getBigUint64(offset, true); offset += 8;
        const depth = info.data[offset]; offset += 1;
        const isBloomed = info.data[offset] !== 0; offset += 1;
        const isFruit = info.data[offset] !== 0; offset += 1;
        const contributionCount = info.data[offset]; offset += 1;
        const isPayoutComplete = info.data[offset] !== 0; offset += 1;

        offset += 3; // _padding [u8; 3]

        const contributions: [PublicKey, bigint][] = [];
        for (let i = 0; i < 10; i++) {
            const pk = new PublicKey(info.data.subarray(offset, offset + 32)); offset += 32;
            const amount = view.getBigUint64(offset, true); offset += 8;
            if (i < contributionCount) {
                contributions.push([pk, amount]);
            }
        }

        return { address, parent, depth, vitalityCurrent, vitalityRequired, isBloomed, isFruit, isPayoutComplete, contributionCount, contributions };
    }

    async function actionInitializeTree(epoch: bigint) {
        console.log(`🌱 Initializing Tree for epoch ${epoch}...`);
        const fruitFreq = GAME_RULES.FRUIT_FREQUENCY;
        const vitalityReqBase = GAME_RULES.VITALITY_REQUIRED_BASE;
        const nurtureCost = BigInt(GAME_RULES.NURTURE_COST_LAMPORTS);

        const [treePda] = findTreePda(epoch);
        const [rootBudPda] = findBudPda(treePda, 'root');
        const [leftPda] = findChildBudPda(rootBudPda, 'left');
        const [rightPda] = findChildBudPda(rootBudPda, 'right');
        const [managerPda] = findGameManagerPda();

        const data = Buffer.alloc(1 + 8 + 8 + 8);
        data.writeUInt8(1, 0); // InitializeTree
        data.writeBigUInt64LE(fruitFreq, 1);
        data.writeBigUInt64LE(vitalityReqBase, 9);
        data.writeBigUInt64LE(nurtureCost, 17);

        const tx = new Transaction().add({
            keys: [
                { pubkey: payer.publicKey, isSigner: true, isWritable: true },
                { pubkey: managerPda, isSigner: false, isWritable: true },
                { pubkey: treePda, isSigner: false, isWritable: true },
                { pubkey: rootBudPda, isSigner: false, isWritable: true },
                { pubkey: leftPda, isSigner: false, isWritable: true },
                { pubkey: rightPda, isSigner: false, isWritable: true },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            ],
            programId: PROGRAM_ID,
            data
        });

        try {
            const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
            console.log(`✅ Tree Initialized! Sig: ${sig}`);
        } catch (e: any) {
            console.error(`❌ Initialization failed:`);
            if (e.logs) {
                console.error("Program Logs:", e.logs.join("\n"));
            } else {
                console.error(e);
            }
        }
    }

    // Traverse tree to find actionable buds
    async function findActionableBuds(rootBudAddress: PublicKey): Promise<BudAccount[]> {
        const actionable: BudAccount[] = [];
        const queue = [rootBudAddress];
        const visited = new Set<string>();

        while (queue.length > 0) {
            const currentAddr = queue.shift()!;
            if (visited.has(currentAddr.toString())) continue;
            visited.add(currentAddr.toString());

            const bud = await fetchBud(currentAddr);
            if (!bud) continue;

            if (!bud.isBloomed && !bud.isFruit) {
                actionable.push(bud);
            } else if (bud.vitalityCurrent >= bud.vitalityRequired && !bud.isBloomed) {
                 actionable.push(bud);
            }

            if (bud.isBloomed) {
                const [left] = findChildBudPda(currentAddr, 'left');
                const [right] = findChildBudPda(currentAddr, 'right');
                queue.push(left, right);
            }
        }
        return actionable;
    }

    // Action: Nurture (Mine + Send)
    // Now handles auto-bloom if vitality requirement is met
    async function actionNurture(bud: BudAccount, epoch: bigint) {
        console.log(`⛏️  Mining for bud ${bud.address.toString().slice(0, 8)}... (Vit: ${bud.vitalityCurrent}/${bud.vitalityRequired})`);

        const essence = "water";
        const slot = await connection.getSlot();

        // Mining Loop
        let bestNonce = 0n;
        let bestGain = 0;

        const encoder = new TextEncoder();
        const essenceBytes = encoder.encode(essence);
        const budBytes = bud.address.toBuffer();
        const nurturerBytes = payer.publicKey.toBuffer();
        const slotBytes = Buffer.alloc(8); slotBytes.writeBigUInt64LE(BigInt(slot));

        const bufferLen = essenceBytes.length + 32 + 32 + 8 + 8;
        const buffer = Buffer.alloc(bufferLen);
        let offset = 0;
        buffer.set(essenceBytes, offset); offset += essenceBytes.length;
        buffer.set(budBytes, offset); offset += 32;
        buffer.set(nurturerBytes, offset); offset += 32;
        buffer.set(slotBytes, offset); offset += 8;
        // Nonce at end
        const nonceOffset = offset;

        for (let i = 0n; i < 5000n; i++) {
            buffer.writeBigUInt64LE(i, nonceOffset);
            const hash = keccak_256.array(new Uint8Array(buffer));
            const gain = (hash[0] % 3) + 3;

            if (gain > bestGain) {
                bestGain = gain;
                bestNonce = i;
                if (gain >= 5) break;
            }
        }

        console.log(`✨ Found nonce ${bestNonce} with gain ${bestGain}`);

        // Construct Tx
        // [2, nonce(8), mined_slot(8), essence_len(4), essence...]
        const data = Buffer.alloc(1 + 8 + 8 + 4 + essenceBytes.length);
        data.writeUInt8(2, 0);
        data.writeBigUInt64LE(bestNonce, 1);
        data.writeBigUInt64LE(BigInt(slot), 9);
        data.writeUInt32LE(essenceBytes.length, 17);
        data.set(essenceBytes, 21);

        const [managerPda] = findGameManagerPda();

        // Prepare extra accounts for auto-bloom
        const [treePda] = findTreePda(epoch);
        const [leftPda] = findChildBudPda(bud.address, 'left');
        const [rightPda] = findChildBudPda(bud.address, 'right');
        
        // Prepare next epoch accounts for auto-initialization
        const nextEpoch = epoch + 1n;
        const [nextTreePda] = findTreePda(nextEpoch);
        const [nextRootPda] = findBudPda(nextTreePda, 'root');
        const [nextLeftPda] = findChildBudPda(nextRootPda, 'left');
        const [nextRightPda] = findChildBudPda(nextRootPda, 'right');

        const tx = new Transaction().add({
            keys: [
                { pubkey: payer.publicKey, isSigner: true, isWritable: true },
                { pubkey: managerPda, isSigner: false, isWritable: true },
                { pubkey: bud.address, isSigner: false, isWritable: true },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                // Extra accounts for auto-bloom (always passed)
                { pubkey: treePda, isSigner: false, isWritable: false },
                { pubkey: leftPda, isSigner: false, isWritable: true },
                { pubkey: rightPda, isSigner: false, isWritable: true },
                // Extra accounts for next-epoch auto-initialization (always passed)
                { pubkey: nextTreePda, isSigner: false, isWritable: true },
                { pubkey: nextRootPda, isSigner: false, isWritable: true },
                { pubkey: nextLeftPda, isSigner: false, isWritable: true },
                { pubkey: nextRightPda, isSigner: false, isWritable: true },
            ],
            programId: PROGRAM_ID,
            data
        });

        try {
            const sig = await sendAndConfirmTransaction(connection, tx, [payer], { skipPreflight: true, commitment: 'confirmed' });
            console.log(`✅ Nurtured! Sig: ${sig}`);
        } catch (e: any) {
            console.error(`❌ Nurture failed for bud ${bud.address.toString().slice(0, 8)}:`);
            let logs = e.logs;
            const sig = e.signature;

            if (!logs && sig) {
                console.log(`🔍 Fetching logs for ${sig}...`);
                try {
                    const txInfo = await connection.getTransaction(sig, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });
                    logs = txInfo?.meta?.logMessages;
                } catch (fetchError) {
                    console.error("Failed to fetch transaction logs:", fetchError);
                }
            }

            if (logs) {
                console.error("Program Logs:\n" + logs.join("\n"));
            } else if (e.message) {
                console.error(e.message);
                if (sig) console.error(`Signature: ${sig}`);
            } else {
                console.error(e);
            }
        }
    }

    async function actionDistributeBatchReward(buds: BudAccount[]) {
        if (buds.length === 0) return;
        console.log(`💰 Batch Distributing rewards for ${buds.length} nodes...`);

        const [managerPda] = findGameManagerPda();
        const keys = [
            { pubkey: payer.publicKey, isSigner: true, isWritable: true },
            { pubkey: managerPda, isSigner: false, isWritable: true },
        ];

        // For each bud, we need: the bud account itself, and all its contributor accounts
        for (const bud of buds) {
            keys.push({ pubkey: bud.address, isSigner: false, isWritable: true });
            for (const [pk, _] of bud.contributions) {
                keys.push({ pubkey: pk, isSigner: false, isWritable: true });
            }
        }

        const data = Buffer.alloc(2);
        data.writeUInt8(4, 0); // DistributeBatchReward
        data.writeUInt8(buds.length, 1);

        const tx = new Transaction().add({
            keys,
            programId: PROGRAM_ID,
            data
        });

        try {
            const sig = await sendAndConfirmTransaction(connection, tx, [payer], { skipPreflight: true });
            console.log(`✅ Batch Distributed! Sig: ${sig}`);
        } catch (e: any) {
            console.error(`❌ Batch Distribution failed:`);
            if (e.logs) {
                console.error("Program Logs:", e.logs.join("\n"));
            } else if (e.message) {
                console.error(e.message);
                if (e.signature) console.error(`Signature: ${e.signature}`);
            } else {
                console.error(e);
            }
        }
    }

    // --- Loop ---

    while (true) {
        try {
            const manager = await fetchGameManager();
            if (!manager) {
                console.log("Waiting for game manager...");
                await new Promise(r => setTimeout(r, 2000));
                continue;
            }

            const tree = await fetchTree(manager.currentEpoch);
            if (!tree) {
                console.log(`🌱 Tree for epoch ${manager.currentEpoch} not found!`);
                
                // Fallback Initialization ONLY if the game got stuck or wasn't deployed
                // Under normal circumstances, NurtureBud transitions the epoch and initializes automatically
                if (manager.currentEpoch === 0n) {
                    await actionInitializeTree(manager.currentEpoch);
                }
                await new Promise(r => setTimeout(r, 2000));
                continue;
            }

            const [rootBud] = findBudPda(tree.address, 'root');

            // --- Reward Claiming (Previous Epochs) ---
            if (manager.lastFruitPrize > 0n && manager.lastFruitEpoch === manager.currentEpoch - BigInt(1)) {
                console.log(`🔍 Checking for unclaimed rewards in epoch ${manager.lastFruitEpoch}...`);

                let currentClaimAddr: PublicKey | null = manager.lastFruitBud;
                const batchBuds: BudAccount[] = [];

                while (currentClaimAddr && !currentClaimAddr.equals(PublicKey.default)) {
                    const bud = await fetchBud(currentClaimAddr);
                    if (!bud) break;

                    if (!bud.isPayoutComplete && bud.contributionCount > 0) {
                        batchBuds.push(bud);
                    }

                    if (bud.parent.equals(PublicKey.default) || bud.depth === 0) break;
                    currentClaimAddr = bud.parent;
                }

                if (batchBuds.length > 0) {
                    // Split into small batches to avoid account limits
                    // Each node can have up to 10 contributors + the node itself.
                    // Max accounts is usually 32. 2 nodes is safe (2 * 11 + 2 = 24).
                    for (let i = 0; i < batchBuds.length; i += 2) {
                        const chunk = batchBuds.slice(i, i + 2);
                        await actionDistributeBatchReward(chunk);
                    }
                }
            }

            // Just find one actionable thing and do it
            const actionable = await findActionableBuds(rootBud);

            if (actionable.length === 0) {
                console.log("😴 No actionable buds found. Sleeping...");
                await new Promise(r => setTimeout(r, 2000));
                continue;
            }

            // Pick random bud
            const target = actionable[Math.floor(Math.random() * actionable.length)];

            // Always nurture (handles bloom internally now)
            await actionNurture(target, manager.currentEpoch);

            // Small delay between actions
            await new Promise(r => setTimeout(r, 1000));

        } catch (e) {
            console.error("Loop Error:", e);
            await new Promise(r => setTimeout(r, 2000));
        }
    }
}

main();
