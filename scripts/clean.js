const { exec, rootPath } = require('./utils');
const fs = require('fs');
const path = require('path');

async function clean() {
    const target = process.argv[2];

    try {
        if (!target || target === 'all') {
            await cleanProgram('rps');
            await cleanProgram('great_banyan');
            await cleanProgram('idiot_chess');
            await cleanFrontend();
        } else if (target === 'rps') {
            await cleanProgram('rps');
        } else if (target === 'banyan') {
            await cleanProgram('great_banyan');
        } else if (target === 'chess') {
            await cleanProgram('idiot_chess');
        } else if (target === 'frontend') {
            await cleanFrontend();
        } else {
            console.error(`Unknown clean target: ${target}`);
            process.exit(1);
        }
        console.log('🧹 Cleanup completed');
    } catch (err) {
        console.error(`❌ Cleanup failed: ${err.message}`);
        process.exit(1);
    }
}

async function cleanProgram(name) {
    console.log(`🧹 Cleaning ${name} program...`);
    const programDir = rootPath('programs', name);
    await exec('cargo', ['clean'], { cwd: programDir });

    // Also clean top-level target if it exists (for some mono-repo setups)
    const topTarget = rootPath('target');
    if (fs.existsSync(topTarget)) {
        // Use recursive delete for node 14+
        fs.rmSync(topTarget, { recursive: true, force: true });
    }
}

async function cleanFrontend() {
    console.log('🧹 Cleaning frontend...');
    const frontendDir = rootPath('frontend');
    const items = ['dist', 'node_modules/.cache', '.next'];
    for (const item of items) {
        const itemPath = path.join(frontendDir, item);
        if (fs.existsSync(itemPath)) {
            fs.rmSync(itemPath, { recursive: true, force: true });
        }
    }
}

clean();
