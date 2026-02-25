const { exec, execWithCapture, rootPath } = require('./utils');
const fs = require('fs');
const path = require('path');

async function deploy() {
    const program = process.argv[2];
    const network = process.argv[3] || 'localnet';
    const forceNew = process.argv[4] === 'true';

    if (!program) {
        console.error('Usage: node deploy.js <program> [network] [forceNew]');
        process.exit(1);
    }

    try {
        console.log(`🚀 Deploying ${program} to ${network}...`);

        // 1. Set cluster
        let rpcUrl = 'http://127.0.0.1:8899';
        if (network === 'devnet') {
            rpcUrl = 'https://api.devnet.solana.com';
        } else if (network === 'mainnet') {
            rpcUrl = 'https://api.mainnet-beta.solana.com';
        }
        await exec('solana', ['config', 'set', '--url', rpcUrl]);

        // 2. Build program
        console.log('🔨 Building program...');
        const programDirName = program === 'banyan' ? 'great_banyan' : (program === 'chess' ? 'idiot_chess' : program);
        const programPath = rootPath('programs', programDirName);
        await exec('cargo', ['build-sbf', '--', '-Znext-lockfile-bump'], { cwd: programPath });

        const soFile = path.join(programPath, 'target', 'deploy', `${programDirName.replace(/-/g, '_')}.so`);

        // 3. Managed deployment logic
        let existingId = '';
        const managerResult = execWithCapture('node', [rootPath('scripts', 'program-id-manager.js'), 'get', network, program]);
        if (managerResult.status === 0) {
            existingId = managerResult.stdout.trim();
        }

        if (network !== 'localnet' && existingId && existingId !== '11111111111111111111111111111111' && !forceNew) {
            console.log(`📦 Attempting to upgrade existing program: ${existingId}`);
            try {
                await exec('solana', ['program', 'deploy', soFile, '--program-id', existingId]);
                console.log('✅ Program upgraded successfully!');
                process.exit(0);
            } catch (err) {
                console.log('⚠️ Upgrade failed, attempting fresh deployment...');
            }
        }

        console.log('📦 Deploying fresh program...');
        let deployArgs = ['program', 'deploy', soFile];

        if (network !== 'localnet') {
            const keypairFile = path.join(programPath, 'target', 'deploy', `${programDirName}-keypair.json`);
            if (!fs.existsSync(keypairFile)) {
                console.log('🔑 Generating program keypair...');
                await exec('solana-keygen', ['new', '-o', keypairFile, '--no-bip39-passphrase', '--silent']);
            }
            deployArgs.push('--program-id', keypairFile, '--max-len', '200000');
        }

        const deployResult = execWithCapture('solana', deployArgs);
        console.log(deployResult.stdout);

        if (deployResult.status !== 0) {
            console.error('❌ Deployment failed!');
            console.error(deployResult.stderr);
            process.exit(1);
        }

        const match = deployResult.stdout.match(/Program Id: ([A-Za-z0-9]+)/);
        if (match && match[1]) {
            const newId = match[1];
            await exec('node', [rootPath('scripts', 'program-id-manager.js'), 'set', network, program, newId]);
            console.log(`✅ Deployed! Program ID: ${newId}`);
        }

    } catch (err) {
        console.error(`❌ Deployment failed: ${err.message}`);
        process.exit(1);
    }
}

deploy();
