import { Connection, Keypair, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../../.env') });
import { GAME_RULES } from '../src/config/gameRules';

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

    console.log(`🌿 Updating Tree on ${network}...`);
    console.log(`ProgID: ${PROGRAM_ID.toString()}`);

    let rpcUrl = "http://127.0.0.1:8899";
    if (network === 'devnet') {
        rpcUrl = process.env.HELIUS_DEVNET_RPC_URL || 'https://api.devnet.solana.com';
    } else if (network === 'mainnet') {
        rpcUrl = process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';
    }
    const connection = new Connection(rpcUrl, "confirmed");

    const home = process.env.HOME || process.env.USERPROFILE;
    const keyPath = path.join(home!, '.config/solana/id.json');

    let payer: Keypair;
    if (fs.existsSync(keyPath)) {
        const keyData = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
        payer = Keypair.fromSecretKey(new Uint8Array(keyData));
    } else {
        console.error("⚠️ No local wallet found.");
        process.exit(1);
    }

    console.log(`Wallet: ${payer.publicKey.toString()}`);

    const [managerPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("manager_v4")],
        PROGRAM_ID
    );

    // Fetch current epoch from Manager
    const managerInfo = await connection.getAccountInfo(managerPda);
    if (!managerInfo) {
        console.error("❌ Game Manager not initialized.");
        process.exit(1);
    }
    const view = new DataView(managerInfo.data.buffer, managerInfo.data.byteOffset, managerInfo.data.byteLength);
    const currentEpoch = view.getBigUint64(0, true);

    const epochBuffer = Buffer.alloc(8);
    epochBuffer.writeBigUInt64LE(currentEpoch);

    const [treePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("tree_v4"), epochBuffer],
        PROGRAM_ID
    );

    console.log(`Tree PDA (Epoch ${currentEpoch}): ${treePda.toString()}`);

    // Variant 5 is UpdateTree
    const fruitFreq = GAME_RULES.FRUIT_FREQUENCY;
    const vitalityReq = GAME_RULES.VITALITY_REQUIRED_BASE;

    const data = Buffer.alloc(1 + 8 + 8);
    let offset = 0;
    data.writeUInt8(5, offset); // Variant 5
    offset += 1;
    data.writeBigUInt64LE(fruitFreq, offset);
    offset += 8;
    data.writeBigUInt64LE(vitalityReq, offset);

    const tx = new Transaction().add({
        keys: [
            { pubkey: payer.publicKey, isSigner: true, isWritable: true },
            { pubkey: treePda, isSigner: false, isWritable: true },
        ],
        programId: PROGRAM_ID,
        data: data,
    });

    try {
        const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
        console.log(`✅ Tree updated successfully! Base vitality is now ${vitalityReq}. Tx: ${sig}`);
    } catch (e) {
        console.error("❌ Failed to update tree:", e);
    }
}

main().catch(console.error);
