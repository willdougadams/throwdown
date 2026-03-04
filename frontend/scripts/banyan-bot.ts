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
    lastFruitDepth: number;
    lastFruitEpoch: bigint;
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
        PublicKey.findProgramAddressSync([Buffer.from("manager_v1")], PROGRAM_ID);

    const findTreePda = (epoch: bigint) => {
        const epochBuf = Buffer.alloc(8);
        epochBuf.writeBigUInt64LE(epoch);
        return PublicKey.findProgramAddressSync([Buffer.from("tree"), epochBuf], PROGRAM_ID);
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
            lastFruitEpoch: view.getBigUint64(88, true),
            lastFruitDepth: view.getUint8(96),
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

        const [treePda] = findTreePda(epoch);
        const [rootBudPda] = findBudPda(treePda, 'root');
        const [managerPda] = findGameManagerPda();

        const data = Buffer.alloc(1 + 8 + 8);
        data.writeUInt8(1, 0); // InitializeTree
        data.writeBigUInt64LE(fruitFreq, 1);
        data.writeBigUInt64LE(vitalityReqBase, 9);

        const tx = new Transaction().add({
            keys: [
                { pubkey: payer.publicKey, isSigner: true, isWritable: true },
                { pubkey: managerPda, isSigner: false, isWritable: true },
                { pubkey: treePda, isSigner: false, isWritable: true },
                { pubkey: rootBudPda, isSigner: false, isWritable: true },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            ],
            programId: PROGRAM_ID,
            data
        });

        try {
            const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
            console.log(`✅ Tree Initialized! Sig: ${sig}`);
        } catch (e: any) {
            console.error(`❌ Initialization failed: ${e.message}`);
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
            const hash = keccak_256.array(buffer);
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
            ],
            programId: PROGRAM_ID,
            data
        });

        try {
            const sig = await sendAndConfirmTransaction(connection, tx, [payer], { skipPreflight: true });
            console.log(`✅ Nurtured! Sig: ${sig}`);
        } catch (e: any) {
            console.error(`❌ Nurture failed: ${e.message}`);
        }
    }

    async function actionDistributeNodeReward(bud: BudAccount) {
        console.log(`💰 Distributing rewards for node ${bud.address.toString().slice(0, 8)}...`);

        const [managerPda] = findGameManagerPda();
        await connection.getAccountInfo(managerPda).then(i => {
            if (!i) throw new Error("Manager not found");
        });

        // Collect all contributor accounts in order
        const keys = [
            { pubkey: payer.publicKey, isSigner: true, isWritable: true },
            { pubkey: managerPda, isSigner: false, isWritable: true },
            { pubkey: bud.address, isSigner: false, isWritable: true },
        ];

        // Add contributors
        for (const [pk, _] of bud.contributions) {
            keys.push({ pubkey: pk, isSigner: false, isWritable: true });
        }

        // Add nurturer (cranker) as the last account to receive bounty
        keys.push({ pubkey: payer.publicKey, isSigner: false, isWritable: true });

        const instructionData = Buffer.from([3]); // DistributeNodeReward

        const tx = new Transaction().add({
            keys,
            programId: PROGRAM_ID,
            data: instructionData
        });

        try {
            const sig = await sendAndConfirmTransaction(connection, tx, [payer], { skipPreflight: true });
            console.log(`✅ Distributed! Sig: ${sig}`);
        } catch (e: any) {
            console.error(`❌ Distribution failed: ${e.message}`);
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
                console.log(`🌱 Tree for epoch ${manager.currentEpoch} not found. Initializing...`);
                await actionInitializeTree(manager.currentEpoch);
                await new Promise(r => setTimeout(r, 2000));
                continue;
            }

            const [rootBud] = findBudPda(tree.address, 'root');

            // --- Reward Claiming (Previous Epochs) ---
            // If we have a lastFruitBud, check if we (the payer) are in that branch and haven't claimed
            if (manager.lastFruitPrize > 0n && manager.lastFruitEpoch === manager.currentEpoch - BigInt(1)) {
                console.log(`🔍 Checking for unclaimed rewards in epoch ${manager.lastFruitEpoch}...`);

                // We need to find our contributions in the winning branch. 
                // The bot would ideally have this cached, but for now we can scan 
                // actionable/visible buds or specific ones if we know the path.
                // Short-term: check the lastFruitBud itself and its ancestors.

                let currentClaimAddr: PublicKey | null = manager.lastFruitBud;
                while (currentClaimAddr && !currentClaimAddr.equals(PublicKey.default)) {
                    const bud = await fetchBud(currentClaimAddr);
                    if (!bud) break;

                    if (!bud.isPayoutComplete && bud.contributionCount > 0) {
                        await actionDistributeNodeReward(bud);
                    }

                    if (bud.parent.equals(PublicKey.default) || bud.depth === 0) break;
                    currentClaimAddr = bud.parent;
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
