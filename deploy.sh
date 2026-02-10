#!/bin/bash

# Managed deployment script with Program ID tracking

set -e

NETWORK=${1:-devnet}
FORCE_NEW=${2:-false}

echo "🚀 Deploying RPS Bracket Program to $NETWORK..."

# Check if solana CLI is installed
if ! command -v solana &> /dev/null; then
    echo "❌ Error: Solana CLI is not installed."
    exit 1
fi

# Set cluster
echo "🌐 Setting cluster to $NETWORK..."
if [ "$NETWORK" = "localnet" ]; then
    solana config set --url http://127.0.0.1:8899
elif [ "$NETWORK" = "devnet" ]; then
    solana config set --url https://devnet.helius-rpc.com/?api-key=adaff95b-72b5-4898-b349-30a3c5a8f244
elif [ "$NETWORK" = "mainnet" ]; then
    solana config set --url https://api.mainnet-beta.solana.com
else
    echo "❌ Invalid network: $NETWORK (use: localnet, devnet, mainnet)"
    exit 1
fi

# Check balance
echo "💰 Checking wallet balance..."
solana balance

# Build program
echo "🔨 Building program..."
./build.sh

# Get existing program ID
EXISTING_ID=$(node scripts/program-id-manager.js get $NETWORK 2>/dev/null || echo "")

# Skip upgrade logic for localnet (validator gets reset every time)
if [ "$NETWORK" != "localnet" ] && [ -n "$EXISTING_ID" ] && [ "$EXISTING_ID" != "11111111111111111111111111111111" ] && [ "$FORCE_NEW" != "true" ]; then
    echo "📦 Attempting to upgrade existing program: $EXISTING_ID"

    # Check if program account exists
    PROGRAM_EXISTS=$(solana account $EXISTING_ID 2>&1)

    if echo "$PROGRAM_EXISTS" | grep -q "Account not found"; then
        echo "⚠️  Program account not found"
        echo "📦 Will deploy fresh program instead..."
    else
        # Try to upgrade existing program
        echo "🔄 Uploading program upgrade..."
        DEPLOY_OUTPUT=$(solana program deploy programs/rps/target/deploy/pinocchio_token_program.so --program-id $EXISTING_ID 2>&1)
        DEPLOY_EXIT_CODE=$?

        if [ $DEPLOY_EXIT_CODE -eq 0 ] && echo "$DEPLOY_OUTPUT" | grep -q "Program Id:"; then
            echo "✅ Program upgraded successfully!"
            echo "🆔 Program ID: $EXISTING_ID (unchanged)"
            echo ""
            echo "✨ Upgrade complete!"
            exit 0
        else
            echo "⚠️  Upgrade failed (program may need more space)"
            echo "💡 Common causes:"
            echo "   - Program binary size increased beyond allocated space"
            echo "   - Insufficient lamports in program account"
            echo ""
            echo "📦 Deploying fresh program instead..."
        fi
    fi
fi

# Deploy new program
echo "📦 Deploying fresh program..."
echo "📊 Program binary size: $(ls -lh programs/rps/target/deploy/pinocchio_token_program.so | awk '{print $5}')"

if [ "$NETWORK" = "localnet" ]; then
    # For localnet, use simple deployment
    echo "🔄 Uploading to localnet..."
    DEPLOY_OUTPUT=$(solana program deploy programs/rps/target/deploy/pinocchio_token_program.so 2>&1)
    DEPLOY_EXIT_CODE=$?
else
    # For devnet/mainnet, generate specific keypair to avoid buffer conflicts
    KEYPAIR_FILE="programs/rps/target/deploy/pinocchio_token_program-keypair.json"
    if [ ! -f "$KEYPAIR_FILE" ]; then
        echo "🔑 Generating program keypair..."
        solana-keygen new -o $KEYPAIR_FILE --no-bip39-passphrase --silent
    fi
    echo "🔄 Uploading to $NETWORK..."
    DEPLOY_OUTPUT=$(solana program deploy programs/rps/target/deploy/pinocchio_token_program.so --program-id $KEYPAIR_FILE --max-len 150000 2>&1)
    DEPLOY_EXIT_CODE=$?
fi

echo "$DEPLOY_OUTPUT"

# Check if deployment was successful
if [ $DEPLOY_EXIT_CODE -ne 0 ]; then
    echo ""
    echo "❌ Deployment failed!"
    echo "💡 Try:"
    echo "   1. Check your wallet balance: solana balance"
    echo "   2. Request airdrop if needed: solana airdrop 2"
    echo "   3. For localnet: Make sure validator is running"
    exit 1
fi

# Extract program ID from output
PROGRAM_ID=$(echo "$DEPLOY_OUTPUT" | grep -o 'Program Id: [A-Za-z0-9]\+' | cut -d' ' -f3)

if [ -z "$PROGRAM_ID" ]; then
    echo "❌ Could not extract Program ID from deployment output"
    echo "Output was: $DEPLOY_OUTPUT"
    exit 1
fi

# Save the new program ID
echo "💾 Saving Program ID to configuration..."
node scripts/program-id-manager.js set $NETWORK $PROGRAM_ID

echo ""
echo "✅ Program deployed successfully!"
echo "🆔 Program ID: $PROGRAM_ID"
echo "🌐 Network: $NETWORK"
echo "📝 Configuration updated"

echo ""
echo "🎉 Deployment complete!"
