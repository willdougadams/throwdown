const { exec, rootPath } = require('./utils');

async function lint() {
    const target = process.argv[2];

    try {
        if (!target || target === 'all') {
            await lintProgram('rps');
            await lintProgram('great_banyan');
            await lintProgram('idiot_chess');
            await lintFrontend();
        } else if (target === 'program') {
            await lintProgram('rps');
            await lintProgram('great_banyan');
            await lintProgram('idiot_chess');
        } else if (target === 'frontend') {
            await lintFrontend();
        } else {
            console.error(`Unknown lint target: ${target}`);
            process.exit(1);
        }
    } catch (err) {
        console.error(`❌ Linting failed: ${err.message}`);
        process.exit(1);
    }
}

async function lintProgram(name) {
    console.log(`🦀 Linting ${name} program...`);
    const programDir = rootPath('programs', name);
    await exec('cargo', ['clippy', '--all-targets', '--', '-W', 'clippy::all'], { cwd: programDir });
}

async function lintFrontend() {
    console.log('⚛️ Linting frontend...');
    await exec('yarn', ['lint'], { cwd: rootPath('frontend') }).catch(err => {
        console.log('⚠️ No lint script configured or linting failed (proceeding)');
    });
}

lint();
