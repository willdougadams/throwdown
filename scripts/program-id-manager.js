#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const PROGRAM_IDS_FILE = path.join(__dirname, '..', 'program-ids.json');

function loadProgramIds() {
    if (!fs.existsSync(PROGRAM_IDS_FILE)) {
        return {
            localnet: "11111111111111111111111111111111",
            devnet: null,
            mainnet: null,
            last_updated: {}
        };
    }
    return JSON.parse(fs.readFileSync(PROGRAM_IDS_FILE, 'utf8'));
}

function saveProgramIds(programIds) {
    fs.writeFileSync(PROGRAM_IDS_FILE, JSON.stringify(programIds, null, 2));
}

function updateProgramId(network, programId) {
    const programIds = loadProgramIds();
    programIds[network] = programId;
    programIds.last_updated = programIds.last_updated || {};
    programIds.last_updated[network] = new Date().toISOString();
    saveProgramIds(programIds);
    console.log(`✅ Updated ${network} program ID: ${programId}`);
}

function getProgramId(network) {
    const programIds = loadProgramIds();
    return programIds[network];
}

// CLI usage
const [,, command, network, programId] = process.argv;

switch (command) {
    case 'get':
        if (!network) {
            console.error('Usage: node program-id-manager.js get <network>');
            process.exit(1);
        }
        const id = getProgramId(network);
        if (id) {
            console.log(id);
        } else {
            console.error(`No program ID found for ${network}`);
            process.exit(1);
        }
        break;
    
    case 'set':
        if (!network || !programId) {
            console.error('Usage: node program-id-manager.js set <network> <program-id>');
            process.exit(1);
        }
        updateProgramId(network, programId);
        break;
    
    case 'list':
        const programIds = loadProgramIds();
        console.log('📋 Current Program IDs:');
        Object.entries(programIds).forEach(([net, id]) => {
            if (net !== 'last_updated') {
                const updated = programIds.last_updated?.[net] || 'Never';
                console.log(`  ${net}: ${id || 'Not deployed'} (${updated})`);
            }
        });
        break;
    
    default:
        console.log('Usage:');
        console.log('  node program-id-manager.js get <network>');
        console.log('  node program-id-manager.js set <network> <program-id>');
        console.log('  node program-id-manager.js list');
        console.log('');
        console.log('Networks: localnet, devnet, mainnet');
        break;
}

module.exports = { loadProgramIds, getProgramId, updateProgramId };