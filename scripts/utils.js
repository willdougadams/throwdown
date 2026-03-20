const { spawn, spawnSync } = require('child_process');
const path = require('path');

const isWindows = process.platform === 'win32';
const LINUX_TOOLS = ['solana', 'cargo', 'solana-keygen', 'bash'];

/**
 * Converts a Windows path to a WSL path.
 */
function toWslPath(pathStr) {
    if (!isWindows || !pathStr) return pathStr;

    // If it's already a Linux-style path or doesn't look like a Windows path, return as is
    if (pathStr.startsWith('/') || !pathStr.includes('\\') && !/^[A-Z]:/i.test(pathStr)) {
        return pathStr;
    }

    // Replace C:\ with /mnt/c/, D:\ with /mnt/d/, etc.
    let wslPath = pathStr.replace(/^([A-Za-z]):\\?/, (match, drive) => {
        return `/mnt/${drive.toLowerCase()}/`;
    });

    // Replace all remaining backslashes with forward slashes
    return wslPath.replace(/\\/g, '/');
}

/**
 * Handles command and argument transformation for WSL on Windows.
 */
function translateCommand(command, args) {
    if (isWindows && LINUX_TOOLS.includes(command)) {
        // We use 'bash -l -c' to ensure the user's WSL profile (and thus PATH) is loaded
        const escapedArgs = args.map(arg => {
            // Translate paths if they look like Windows paths
            let translatedArg = arg;
            if (/^[A-Za-z]:\\/.test(arg) || arg.includes('\\')) {
                translatedArg = toWslPath(arg);
            }

            if (translatedArg.includes(' ') || translatedArg.includes('"') || translatedArg.includes('$')) {
                return `'${translatedArg.replace(/'/g, "'\\''")}'`;
            }
            return translatedArg;
        }).join(' ');

        const fullBashCommand = `${command} ${escapedArgs}`;

        return {
            cmd: 'wsl',
            args: ['-d', 'Ubuntu', 'bash', '-l', '-c', fullBashCommand],
            useShell: false
        };
    }
    return {
        cmd: command,
        args: args,
        useShell: isWindows
    };
}

/**
 * Executes a command in a cross-platform way.
 */
function exec(command, args = [], options = {}) {
    const { cmd, args: finalArgs, useShell } = translateCommand(command, args);

    return new Promise((resolve, reject) => {
        const displayArgs = finalArgs.map(arg => arg.includes(' ') ? `"${arg}"` : arg).join(' ');
        console.log(`> ${cmd} ${displayArgs}`);

        const child = spawn(cmd, finalArgs, {
            stdio: 'inherit',
            shell: useShell,
            cwd: options.cwd || process.cwd(),
            env: { ...process.env, ...options.env }
        });

        child.on('close', (code) => {
            if (code === 0) resolve(code);
            else reject(new Error(`Command failed with code ${code}`));
        });
        child.on('error', reject);
    });
}

/**
 * Executes a command and captures its output.
 */
function execWithCapture(command, args = [], options = {}) {
    const { cmd, args: finalArgs, useShell } = translateCommand(command, args);

    const result = spawnSync(cmd, finalArgs, {
        encoding: 'utf8',
        shell: useShell,
        cwd: options.cwd || process.cwd(),
        env: { ...process.env, ...options.env }
    });

    return result;
}

/**
 * Executes a command, streams output to console, and captures it.
 */
function execStreamingCapture(command, args = [], options = {}) {
    const { cmd, args: finalArgs, useShell } = translateCommand(command, args);

    return new Promise((resolve) => {
        const displayArgs = finalArgs.map(arg => arg.includes(' ') ? `"${arg}"` : arg).join(' ');
        console.log(`> ${cmd} ${displayArgs}`);

        const child = spawn(cmd, finalArgs, {
            shell: useShell,
            cwd: options.cwd || process.cwd(),
            env: { ...process.env, ...options.env }
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            const str = data.toString();
            stdout += str;
            process.stdout.write(str);
        });

        child.stderr.on('data', (data) => {
            const str = data.toString();
            stderr += str;
            process.stderr.write(str);
        });

        child.on('close', (code) => resolve({ status: code, stdout, stderr }));
        child.on('error', (err) => resolve({ status: 1, stdout: '', stderr: err.message }));
    });
}

function rootPath(...parts) {
    return path.join(__dirname, '..', ...parts);
}

module.exports = { exec, execWithCapture, execStreamingCapture, rootPath, isWindows, toWslPath };
