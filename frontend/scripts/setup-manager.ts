import { Connection, Keypair, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

const ID_FILE = path.join(__dirname, '../../scripts/program-ids.json');

async function main() {
    console.log("Starting setup script for devnet...");
    const connection = new Connection('https://api.devnet.solana.com', "confirmed");
    const home = process.env.HOME || process.env.USERPROFILE;
    const keyPath = path.join(home!, '.config/solana/id.json');
    const keyData = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    const payer = Keypair.fromSecretKey(new Uint8Array(keyData));
    
    const ids = JSON.parse(fs.readFileSync(ID_FILE, 'utf8'));
    const PROGRAM_ID = new PublicKey(ids['devnet'].banyan);
    
    console.log(`Program ID: ${PROGRAM_ID.toString()}`);
    console.log(`Payer: ${payer.publicKey.toString()}`);

    const [managerPda] = PublicKey.findProgramAddressSync([Buffer.from("manager_v3")], PROGRAM_ID);
    console.log(`Manager PDA: ${managerPda.toString()}`);

    const data = Buffer.alloc(1);
    data.writeUInt8(0, 0); // InitializeGame

    const tx = new Transaction().add({
        keys: [
            { pubkey: payer.publicKey, isSigner: true, isWritable: true },
            { pubkey: managerPda, isSigner: false, isWritable: true },
            { pubkey: payer.publicKey, isSigner: false, isWritable: false }, // authority
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data
    });

    try {
        const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
        console.log(`✅ GameManager v3 Initialized! Sig: ${sig}`);
    } catch (e: any) {
        console.error(`❌ Initialization failed:`);
        if (e.logs) console.error("Logs:", e.logs.join("\n"));
        else console.error(e);
    }
}

main();
