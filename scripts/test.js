const { exec, rootPath } = require('./utils');

async function test() {
    const target = process.argv[2];

    try {
        if (!target || target === 'all') {
            await testProgram('rps');
            await testProgram('great_banyan');
            await testProgram('idiot_chess');
            await testFrontend();
        } else if (target === 'rps') {
            await testProgram('rps');
        } else if (target === 'banyan') {
            await testProgram('great_banyan');
        } else if (target === 'chess') {
            await testProgram('idiot_chess');
        } else if (target === 'frontend') {
            await testFrontend();
        } else {
            console.error(`Unknown test target: ${target}`);
            process.exit(1);
        }
        console.log('✅ Tests completed successfully');
    } catch (err) {
        console.error(`❌ Tests failed: ${err.message}`);
        process.exit(1);
    }
}

async function testProgram(name) {
    console.log(`🦀 Running tests for ${name}...`);
    const programDir = rootPath('programs', name);
    await exec('cargo', ['test'], { cwd: programDir });
}

async function testFrontend() {
    console.log('⚛️ Running frontend tests...');
    await exec('yarn', ['test', '--passWithNoTests'], { cwd: rootPath('frontend') });
}

test();
