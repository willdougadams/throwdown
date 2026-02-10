#!/bin/bash
set -e

# Default to localnet if no argument provided
NETWORK=${1:-localnet}

if [ "$NETWORK" == "localnet" ]; then
    RPC_URL="http://127.0.0.1:8899"
elif [ "$NETWORK" == "devnet" ]; then
    RPC_URL="https://api.devnet.solana.com"
elif [ "$NETWORK" == "mainnet" ]; then
    RPC_URL="https://api.mainnet-beta.solana.com"
else
    echo "❌ Unknown network: $NETWORK"
    echo "Usage: ./deploy-banyan.sh [localnet|devnet|mainnet]"
    exit 1
fi

PROGRAM_DIR="programs/great_banyan"
TARGET_DIR="$PROGRAM_DIR/target/deploy"
OUTPUT_FILE="program-id-banyan.json"

echo "🚀 Deploying Great Banyan to $NETWORK ($RPC_URL)..."

# 1. Build
echo "🔨 Building..."
cd $PROGRAM_DIR
cargo build-sbf
cd ../..

# 2. Deploy
echo "📦 Deploying..."
PROGRAM_SO="$TARGET_DIR/great_banyan.so"

if [ ! -f "$PROGRAM_SO" ]; then
    echo "❌ Program binary not found at $PROGRAM_SO"
    exit 1
fi

# Explicitly use the RPC URL to avoid accidental deployments to wrong cluster
DEPLOY_OUTPUT=$(solana program deploy $PROGRAM_SO --url $RPC_URL 2>&1)
echo "$DEPLOY_OUTPUT"

# 3. Extract ID
PROGRAM_ID=$(echo "$DEPLOY_OUTPUT" | grep -o 'Program Id: [A-Za-z0-9]\+' | cut -d' ' -f3)

if [ -z "$PROGRAM_ID" ]; then
    echo "❌ Failed to capture Program ID"
    exit 1
fi

echo "✅ Deployed Program ID: $PROGRAM_ID"

# 4. Save ID (Update or Create)
# We use a temporary python or node script to update JSON carefully, 
# or just simplistic overwrite for localnet for now if jq isn't available.
# To be safe and simple, we'll read existing if possible or just warn.
# Actually, let's just use a simple node one-liner if node is available, given this is a JS project context.

if command -v node &> /dev/null; then
    node -e "
    const fs = require('fs');
    const file = '$OUTPUT_FILE';
    let data = {};
    if (fs.existsSync(file)) {
        try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch(e){}
    }
    data['$NETWORK'] = '$PROGRAM_ID';
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    "
else
    # Fallback to simple overwrite for localnet mostly
    echo "{\" $NETWORK \": \"$PROGRAM_ID\"}" > $OUTPUT_FILE
fi

echo "💾 Saved to $OUTPUT_FILE"
