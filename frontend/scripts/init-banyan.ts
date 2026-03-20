import { Connection, Keypair, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../../.env') });
import { GAME_RULES } from '../src/config/gameRules';

// Load Program ID
// Use the main program-ids.json which is more reliable
const ID_FILE = path.join(__dirname, '../../scripts/program-ids.json');

async function main() {
    const network = process.argv[2] || 'localnet';

    if (!fs.existsSync(ID_FILE)) {
        console.error("❌ Program ID file not found at " + ID_FILE);
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

    console.log(`🌿 Initializing Great Banyan Global Singleton on ${network}...`);
    console.log(`ProgID: ${PROGRAM_ID.toString()} `);

    // Connection
    let rpcUrl = "http://127.0.0.1:8899";
    if (network === 'devnet') {
        rpcUrl = process.env.HELIUS_DEVNET_RPC_URL || 'https://api.devnet.solana.com';
    } else if (network === 'mainnet') {
        rpcUrl = process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';
    }
    const connection = new Connection(rpcUrl, "confirmed");

    // Payer
    const home = process.env.HOME || process.env.USERPROFILE;
    // Default solana config usually at ~/.config/solana/id.json
    const keyPath = path.join(home!, '.config/solana/id.json');

    let payer: Keypair;
    if (fs.existsSync(keyPath)) {
        const keyData = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
        payer = Keypair.fromSecretKey(new Uint8Array(keyData));
    } else {
        console.log("⚠️  No default wallet found. Generating temp wallet and airdropping...");
        payer = Keypair.generate();
        const sig = await connection.requestAirdrop(payer.publicKey, 1000000000); // 1 SOL
        await connection.confirmTransaction(sig);
    }

    console.log(`Wallet: ${payer.publicKey.toString()} `);

    const authorityStr = process.argv[3];
    const authorityPubkey = authorityStr ? new PublicKey(authorityStr) : payer.publicKey;

    // 1. Initialize Game Manager
    // Seeds: "manager_v4"
    const [managerPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("manager_v4")],
        PROGRAM_ID
    );
    console.log(`Manager PDA: ${managerPda.toString()} `);
    console.log(`Manager Authority: ${authorityPubkey.toString()} `);

    // Check if manager exists
    const managerInfo = await connection.getAccountInfo(managerPda);
    if (managerInfo) {
        console.log("✅ Game Manager already initialized.");
    } else {
        console.log("Creating Game Manager...");
        // Instruction: InitializeGame = 0 (Confirmed in lib.rs)
        const data = Buffer.alloc(1);
        data.writeUInt8(0, 0); // Enum variant 0

        const tx = new Transaction().add({
            keys: [
                { pubkey: payer.publicKey, isSigner: true, isWritable: true },
                { pubkey: managerPda, isSigner: false, isWritable: true },
                { pubkey: authorityPubkey, isSigner: false, isWritable: false }, // authority
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            ],
            programId: PROGRAM_ID,
            data: data,
        });

        try {
            const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
            console.log(`✅ Game Manager Initialized! Tx: ${sig} `);
        } catch (e) {
            console.error("❌ Manager Initialization failed:", e);
            // If manager failed, maybe it exists but we missed it? Proceed with caution.
            return;
        }
    }

    // 2. Initialize Tree for Epoch 0
    // We assume current epoch is 0 if just initialized. 
    // If it was already initialized, we should read it.
    let currentEpoch = 0n;
    // Re-fetch manager info just in case we just created it
    const updatedManagerInfo = await connection.getAccountInfo(managerPda);
    if (updatedManagerInfo) {
        // Layout: currentEpoch(8), prizePool(8)
        const view = new DataView(updatedManagerInfo.data.buffer, updatedManagerInfo.data.byteOffset, updatedManagerInfo.data.byteLength);
        currentEpoch = view.getBigUint64(0, true);
    }
    console.log(`Current Epoch: ${currentEpoch} `);

    const epochBuffer = Buffer.alloc(8);
    epochBuffer.writeBigUInt64LE(currentEpoch);

    const [treePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("tree_v4"), epochBuffer],
        PROGRAM_ID
    );

    // Root bud for this tree
    const [rootBudPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("bud"), treePda.toBuffer(), Buffer.from("root")],
        PROGRAM_ID
    );
    const [leftPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("bud"), rootBudPda.toBuffer(), Buffer.from("left")],
        PROGRAM_ID
    );
    const [rightPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("bud"), rootBudPda.toBuffer(), Buffer.from("right")],
        PROGRAM_ID
    );

    console.log(`Tree PDA(Epoch ${currentEpoch}): ${treePda.toString()} `);

    const treeInfo = await connection.getAccountInfo(treePda);
    if (treeInfo) {
        console.log("✅ Tree for current epoch already initialized.");
        return;
    }

    console.log("Initializing Tree for current epoch...");

    // Instruction: InitializeTree = 1 (Confirmed in lib.rs)
    // struct InitializeTree { root: [u8; 32], max_depth: u8, vitality_required_base: u64 }

    // Data Layout:
    // [0] = Variant (1)
    // [1..9] = Fruit Frequency (u64)
    // [9..17] = Vitality Required Base (u64)

    const fruitFreq = GAME_RULES.FRUIT_FREQUENCY;
    const vitalityReq = GAME_RULES.VITALITY_REQUIRED_BASE;
    const nurtureCost = BigInt(GAME_RULES.NURTURE_COST_LAMPORTS);

    const data = Buffer.alloc(1 + 8 + 8 + 8);
    let offset = 0;
    data.writeUInt8(1, offset); // Variant 1
    offset += 1;
    data.writeBigUInt64LE(fruitFreq, offset);
    offset += 8;
    data.writeBigUInt64LE(vitalityReq, offset);
    offset += 8;
    data.writeBigUInt64LE(nurtureCost, offset);

    // Accounts for InitializeTree:
    // Payer, Manager, TreeState, RootBud, LeftChild, RightChild, SystemProgram
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
        data: data,
    });

    try {
        const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
        console.log(`✅ Tree Initialized! Tx: ${sig} `);
    } catch (e) {
        console.error("❌ Tree Initialization failed:", e);
    }
}

main().catch(console.error);
