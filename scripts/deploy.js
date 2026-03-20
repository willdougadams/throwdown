const { exec, execWithCapture, rootPath } = require('./utils');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

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
                rpcUrl = process.env.HELIUS_DEVNET_RPC_URL || 'https://api.devnet.solana.com';
            } else if (network === 'mainnet') {
                rpcUrl = process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';
            }
        }
        console.log(`🌐 Cluster URL: ${rpcUrl}`);
        await exec('solana', ['config', 'set', '--url', rpcUrl]);

        // 2. Build program
        console.log('🔨 Building program...');
        const programDirName = program === 'banyan' ? 'great_banyan' : (program === 'chess' ? 'idiot_chess' : program);
        const programPath = rootPath('programs', programDirName);
        await exec('cargo', ['build-sbf'], { cwd: programPath });

        const soFile = path.join(programPath, 'target', 'deploy', `${programDirName.replace(/-/g, '_')}.so`);

        // 3. Managed deployment logic
        let existingId = '';
        const managerResult = execWithCapture('node', [rootPath('scripts', 'program-id-manager.js'), 'get', network, program]);
        if (managerResult.status === 0) {
            existingId = managerResult.stdout.trim();
        }

        // 4. Resolve Signer
        function getSigner(network) {
            // For all networks (including mainnet), use a local keyfile for deployment.
            // Note: Deploying with a Ledger requires hundreds of manual button presses.
            // Best practice is to deploy with a local keypair and transfer the upgrade authority later.
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
            console.log(`🔑 Using fee payer: ${signer}`);
            try {
                if (network === 'mainnet') {
                    console.log('🔗 Uploading buffer with local wallet (NO Ledger prompts required)...');
                    const writeRes = execWithCapture('solana', ['program', 'write-buffer', soFile, '--keypair', signer, '--with-compute-unit-price', '100000', '--max-sign-attempts', '1000', '--use-rpc']);
                    
                    if (writeRes.status !== 0) {
                        console.error('❌ Failed to write buffer:', writeRes.stderr || writeRes.stdout);
                        process.exit(1);
                    }
                    
                    const match = writeRes.stdout.match(/Buffer: ([A-Za-z0-9]+)/);
                    if (!match || !match[1]) {
                        console.error('❌ Could not parse Buffer ID from output:\n', writeRes.stdout);
                        process.exit(1);
                    }
                    
                    const bufferId = match[1];
                    console.log(`✅ Buffer uploaded securely: ${bufferId}`);
                    
                    console.log(`🔗 Handing over buffer authority to your Ledger...`);
                    await exec('solana', ['program', 'set-buffer-authority', bufferId, '--new-buffer-authority', 'usb://ledger?key=0', '--keypair', signer]);
                    
                    console.log(`🔗 Please approve the ONE FINAL upgrade transaction on your Ledger device!`);
                    await exec('solana', ['program', 'deploy', '--buffer', bufferId, '--program-id', existingId, '--keypair', signer, '--upgrade-authority', 'usb://ledger?key=0']);
                    console.log('✅ Program upgraded successfully!');
                    process.exit(0);
                } else {
                    await exec('solana', ['program', 'deploy', soFile, '--program-id', existingId, '--keypair', signer]);
                    console.log('✅ Program upgraded successfully!');
                    process.exit(0);
                }
            } catch (err) {
                if (network === 'mainnet') {
                    console.error('\n❌ Upgrade failed on mainnet!');
                    console.error('   Stopping here to prevent accidentally deploying a brand new program (which costs ~3 SOL) just because the upgrade failed.');
                    console.error('   Note: If your Ledger is already the upgrade authority, this script cannot auto-upgrade it without specific ledger signing commands.');
                    process.exit(1);
                }
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

            // Post-deployment logic for mainnet
            if (network === 'mainnet') {
                const ledgerKeyFile = rootPath('keys', 'ledger-pubkey.txt');
                if (fs.existsSync(ledgerKeyFile)) {
                    const ledgerPubkey = fs.readFileSync(ledgerKeyFile, 'utf8').trim();
                    if (ledgerPubkey) {
                        console.log(`\n🔒 Transferring Upgrade Authority to Ledger: ${ledgerPubkey} ...`);
                        try {
                            await exec('solana', [
                                'program', 'set-upgrade-authority', newId,
                                '--new-upgrade-authority', ledgerPubkey,
                                '--keypair', signer,
                                '-u', rpcUrl,
                                '--skip-new-upgrade-authority-signer-check'
                            ]);
                            console.log('✅ Upgrade authority transferred securely to Ledger!');
                        } catch (transferErr) {
                            console.error('⚠️ Failed to transfer upgrade authority:', transferErr.message);
                        }

                        if (program === 'banyan') {
                            console.log(`\n🌱 Automatically Initializing Game with Ledger as Fee Collector ...`);
                            try {
                                await exec('npx', ['tsx', 'scripts/init-banyan.ts', 'mainnet', ledgerPubkey], { cwd: rootPath('frontend') });
                                console.log('✅ Game initialized with Ledger authority!');
                            } catch (initErr) {
                                console.error('⚠️ Failed to initialize game:', initErr.message);
                            }
                        }
                    }
                }
            }
        }

    } catch (err) {
        console.error(`❌ Deployment failed: ${err.message}`);
        process.exit(1);
    }
}

deploy();
