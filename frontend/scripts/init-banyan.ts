import { Connection, Keypair, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import { deserialize, serialize } from 'borsh';

// Load Program ID
const ID_FILE = path.join(__dirname, '../../program-id-banyan.json');

async function main() {
    if (!fs.existsSync(ID_FILE)) {
        console.error("❌ Program ID file not found. Run deploy-banyan.sh first.");
        process.exit(1);
    }

    const ids = JSON.parse(fs.readFileSync(ID_FILE, 'utf8'));
    const programIdStr = ids.localnet;
    if (!programIdStr) {
        console.error("❌ No localnet account found in ID file.");
        process.exit(1);
    }
    const PROGRAM_ID = new PublicKey(programIdStr);

    console.log(`🌿 Initializing Great Banyan Tree on Localnet...`);
    console.log(`PAD: ${PROGRAM_ID.toString()}`);

    // Connection
    const connection = new Connection("http://127.0.0.1:8899", "confirmed");

    // Payer
    // Try to load default solana conf
    const home = process.env.HOME || process.env.USERPROFILE;
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

    console.log(`Wallet: ${payer.publicKey.toString()}`);

    // PDAs
    const [treePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("tree"), payer.publicKey.toBuffer()],
        PROGRAM_ID
    );
    const [rootBudPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("bud"), treePda.toBuffer(), Buffer.from("root")],
        PROGRAM_ID
    );

    console.log(`Tree PDA: ${treePda.toString()}`);
    console.log(`Root Bud PDA: ${rootBudPda.toString()}`);

    // Check if already initialized
    const info = await connection.getAccountInfo(treePda);
    if (info) {
        console.log("✅ Tree already initialized.");
        return;
    }

    // Initialize Instruction
    // struct InitializeTree { root: [u8;32], max_depth: u8, vitality_required_base: u64 }
    // Enum variant 0

    const rootHash = Buffer.alloc(32); // Empty root
    const maxDepth = 5;
    const vitalityReq = 100n; // u64

    // Manual serialization based on layout: [0 (variant), root(32), max_depth(1), vitality(8)]
    const data = Buffer.alloc(1 + 32 + 1 + 8);
    let offset = 0;
    data.writeUInt8(0, offset); // Variant
    offset += 1;
    rootHash.copy(data, offset);
    offset += 32;
    data.writeUInt8(maxDepth, offset);
    offset += 1;
    data.writeBigUInt64LE(vitalityReq, offset);

    const tx = new Transaction().add({
        keys: [
            { pubkey: payer.publicKey, isSigner: true, isWritable: true },
            { pubkey: treePda, isSigner: false, isWritable: true },
            { pubkey: rootBudPda, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data: data,
    });

    try {
        const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
        console.log(`✅ Tree Initialized! Tx: ${sig}`);
    } catch (e) {
        console.error("❌ Initialization failed:", e);
    }
}

main().catch(console.error);
