const { exec, rootPath } = require('./utils');

async function build() {
    const target = process.argv[2];

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
    await exec('cargo', ['build-sbf', '--', '-Znext-lockfile-bump'], { cwd: programDir });
}

async function buildFrontend() {
    console.log('⚛️ Building frontend...');
    await exec('yarn', ['build'], { cwd: rootPath('frontend') });
}

build();
