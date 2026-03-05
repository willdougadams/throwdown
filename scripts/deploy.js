const { exec, execWithCapture, rootPath } = require('./utils');
const fs = require('fs');
const path = require('path');

async function deploy() {
    const program = process.argv[2];
    const network = process.argv[3] || 'localnet';
    const forceNew = process.argv.includes('--force-new');

    // Check for custom URL
    const urlIdx = process.argv.indexOf('--url');
    const customUrl = urlIdx !== -1 ? process.argv[urlIdx + 1] : null;

    if (!program) {
        console.error('Usage: node deploy.js <program> [network] [--force-new] [--url <rpc-url>]');
        process.exit(1);
    }

    try {
        console.log(`🚀 Deploying ${program} to ${network}...`);

        // 1. Set cluster
        let rpcUrl = customUrl;
        if (!rpcUrl) {
            rpcUrl = 'http://127.0.0.1:8899';
            if (network === 'devnet') {
                rpcUrl = 'https://api.devnet.solana.com';
            } else if (network === 'mainnet') {
                rpcUrl = 'https://api.mainnet-beta.solana.com';
            }
        }
        console.log(`🌐 Cluster URL: ${rpcUrl}`);
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

        // 4. Resolve Signer
        function getSigner(network) {
            if (network === 'mainnet') {
                return 'usb://ledger?key=0';
            }
            // Use local keyfile for devnet and localnet
            // On Windows, the path is typically %AppData%\solana\id.json
            // But solana CLI usually handles ~/.config/solana/id.json in WSL
            const homeDir = process.env.HOME || process.env.USERPROFILE;
            return path.join(homeDir, '.config', 'solana', 'id.json');
        }

        const signer = getSigner(network);
        const keysDir = rootPath('keys');
        if (!fs.existsSync(keysDir)) {
            fs.mkdirSync(keysDir);
        }
        const keypairFile = path.join(keysDir, `${programDirName}-keypair.json`);

        if (network !== 'localnet' && existingId && existingId !== '11111111111111111111111111111111' && !forceNew) {
            console.log(`📦 Attempting to upgrade existing program: ${existingId}`);
            console.log(`🔑 Using signer: ${signer}`);
            try {
                await exec('solana', ['program', 'deploy', soFile, '--program-id', existingId, '--keypair', signer]);
                console.log('✅ Program upgraded successfully!');
                process.exit(0);
            } catch (err) {
                console.log('⚠️ Upgrade failed, attempting fresh deployment...');
            }
        }

        console.log('📦 Deploying fresh program...');
        let deployArgs = ['program', 'deploy', soFile, '--keypair', signer];

        if (network !== 'localnet') {
            if (!fs.existsSync(keypairFile)) {
                console.log('🔑 Generating program keypair...');
                await exec('solana-keygen', ['new', '-o', keypairFile, '--no-bip39-passphrase', '--silent']);
            }
            deployArgs.push('--program-id', keypairFile, '--max-len', '200000');
        }

        const deployResult = execWithCapture('solana', deployArgs);
        if (deployResult.stdout) console.log(deployResult.stdout);

        if (deployResult.status !== 0) {
            console.error('❌ Deployment failed!');
            if (deployResult.stderr) console.error(deployResult.stderr);
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
