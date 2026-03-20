const { exec, rootPath } = require('./utils');
const fs = require('fs');
const path = require('path');

function generateTreasuries(network) {
    try {
        const { PublicKey } = require(path.join(rootPath(), 'frontend/node_modules/@solana/web3.js'));
        const programIds = require('./program-ids.json');
        
        const banyanIdStr = programIds[network]?.banyan;
        if (!banyanIdStr) {
            console.log(`⚠️ No Banyan program ID found for network ${network}, skipping treasury generation.`);
            return;
        }
        
        const banyanId = new PublicKey(banyanIdStr);
        const [pda] = PublicKey.findProgramAddressSync([Buffer.from('manager_v4')], banyanId);
        
        const rpsPath = rootPath('programs/rps/src/treasury.bin');
        const chessPath = rootPath('programs/idiot_chess/src/treasury.bin');
        
        fs.writeFileSync(rpsPath, pda.toBytes());
        fs.writeFileSync(chessPath, pda.toBytes());
        
        console.log(`🏦 Injected Banyan Treasury PDA for ${network}: ${pda.toBase58()}`);
    } catch (e) {
        console.log(`⚠️ Failed to generate treasury bins: ${e.message}`);
    }
}

async function build() {
    const target = process.argv[2];
    const network = process.argv[3] || 'localnet';

    generateTreasuries(network);

    try {
        if (!target || target === 'all') {
            await buildProgram('rps');
            await buildProgram('great_banyan');
            await buildProgram('idiot_chess');
            await buildFrontend();
        } else if (target === 'rps') {
            await buildProgram('rps');
        } else if (target === 'banyan') {
            await buildProgram('great_banyan');
        } else if (target === 'chess') {
            await buildProgram('idiot_chess');
        } else if (target === 'frontend') {
            await buildFrontend();
        } else {
            console.error(`Unknown build target: ${target}`);
            process.exit(1);
        }
        console.log('✅ Build completed successfully');
    } catch (err) {
        console.error(`❌ Build failed: ${err.message}`);
        process.exit(1);
    }
}

async function buildProgram(name) {
    console.log(`🦀 Building ${name} program...`);
    // Note: programs/great_banyan and programs/idiot_chess might have different folder names
    // based on original Makefile.
    const programDir = rootPath('programs', name === 'great_banyan' ? 'great_banyan' : (name === 'idiot_chess' ? 'idiot_chess' : name));
    await exec('cargo', ['build-sbf'], { cwd: programDir });
}

async function buildFrontend() {
    console.log('⚛️ Building frontend...');
    await exec('yarn', ['build'], { cwd: rootPath('frontend') });
}

build();
