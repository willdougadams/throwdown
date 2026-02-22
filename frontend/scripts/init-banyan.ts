import { Connection, Keypair, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import { GAME_RULES } from '../src/config/gameRules';

// Load Program ID
// Use the main program-ids.json which is more reliable
const ID_FILE = path.join(__dirname, '../../scripts/program-ids.json');

async function main() {
    if (!fs.existsSync(ID_FILE)) {
        console.error("❌ Program ID file not found at " + ID_FILE);
        process.exit(1);
    }

    const ids = JSON.parse(fs.readFileSync(ID_FILE, 'utf8'));
    const localnet = ids.localnet;
    const programIdStr = typeof localnet === 'string' ? localnet : localnet.banyan;
    if (!programIdStr) {
        console.error("❌ No localnet account found in ID file.");
        process.exit(1);
    }
    const PROGRAM_ID = new PublicKey(programIdStr);

    console.log(`🌿 Initializing Great Banyan Global Singleton on Localnet...`);
    console.log(`ProgID: ${PROGRAM_ID.toString()} `);

    // Connection
    const connection = new Connection("http://127.0.0.1:8899", "confirmed");

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

    // 1. Initialize Game Manager
    // Seeds: "manager"
    const [managerPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("manager")],
        PROGRAM_ID
    );
    console.log(`Manager PDA: ${managerPda.toString()} `);

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
        [Buffer.from("tree"), epochBuffer],
        PROGRAM_ID
    );

    // Root bud for this tree
    const [rootBudPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("bud"), treePda.toBuffer(), Buffer.from("root")],
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

    const data = Buffer.alloc(1 + 8 + 8);
    let offset = 0;
    data.writeUInt8(1, offset); // Variant 1
    offset += 1;
    data.writeBigUInt64LE(fruitFreq, offset);
    offset += 8;
    data.writeBigUInt64LE(vitalityReq, offset);

    // Accounts for InitializeTree:
    // Payer, Manager, TreeState, RootBud, SystemProgram
    const tx = new Transaction().add({
        keys: [
            { pubkey: payer.publicKey, isSigner: true, isWritable: true },
            { pubkey: managerPda, isSigner: false, isWritable: true },
            { pubkey: treePda, isSigner: false, isWritable: true },
            { pubkey: rootBudPda, isSigner: false, isWritable: true },
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
