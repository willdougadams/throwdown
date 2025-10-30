#!/bin/bash

# Setup test wallets for game testing
# Creates test wallets (if needed) and distributes SOL evenly
# Usage: ./setup-test-wallets.sh [network] [num_wallets]
# Example: ./setup-test-wallets.sh localnet 4
# Example: ./setup-test-wallets.sh localnet 16

NETWORK="${1:-devnet}"
NUM_WALLETS="${2:-4}"
WALLET_DIR="test-wallets"

# Set RPC URL based on network
if [ "$NETWORK" = "localnet" ]; then
    RPC_URL="http://127.0.0.1:8899"
elif [ "$NETWORK" = "devnet" ]; then
    RPC_URL="https://api.devnet.solana.com"
else
    echo "❌ Invalid network. Use 'localnet' or 'devnet'"
    exit 1
fi

echo "🎮 Setting up $NUM_WALLETS test wallets for Rock Paper Scissors game on $NETWORK..."
echo "   RPC URL: $RPC_URL"
echo ""

# Create wallet directory if it doesn't exist
mkdir -p "$WALLET_DIR"

# Create wallets if they don't exist
WALLETS=()
CREATED_COUNT=0
for ((i=1; i<=NUM_WALLETS; i++)); do
    WALLET_FILE="$WALLET_DIR/player$i.json"
    if [ ! -f "$WALLET_FILE" ]; then
        echo "Creating wallet for Player $i..."
        solana-keygen new --no-bip39-passphrase --outfile "$WALLET_FILE" > /dev/null 2>&1
        echo "✅ Player $i wallet created"
        ((CREATED_COUNT++))
    else
        echo "✅ Player $i wallet already exists"
    fi

    # Store wallet info
    PUBKEY=$(solana-keygen pubkey "$WALLET_FILE")
    WALLETS+=("$PUBKEY")
    echo "   Address: $PUBKEY"
done

echo ""
echo "📊 Current balances:"
TOTAL_BALANCE=0
for ((i=1; i<=NUM_WALLETS; i++)); do
    PUBKEY="${WALLETS[$i-1]}"
    BALANCE=$(solana balance "$PUBKEY" --url "$RPC_URL" 2>/dev/null | awk '{print $1}')
    echo "Player $i: $BALANCE SOL"
    TOTAL_BALANCE=$(echo "$TOTAL_BALANCE + $BALANCE" | bc -l)
done

echo ""
echo "Total SOL across all wallets: $TOTAL_BALANCE SOL"


echo "📥 Requesting SOL from $NETWORK faucet..."

# Request 5 SOL to player1 (or more for localnet)
PLAYER1_PUBKEY="${WALLETS[0]}"
AIRDROP_AMOUNT=5
if [ "$NETWORK" = "localnet" ]; then
    AIRDROP_AMOUNT=100
fi
echo "Requesting $AIRDROP_AMOUNT SOL for Player 1 (will redistribute)..."

# Try airdrop with retries
AIRDROP_SUCCESS=0
for attempt in {1..3}; do
    if solana airdrop "$AIRDROP_AMOUNT" "$PLAYER1_PUBKEY" --url "$RPC_URL" 2>/dev/null; then
        AIRDROP_SUCCESS=1
        echo "✅ Airdrop successful!"
        break
    else
        echo "⏳ Airdrop attempt $attempt failed, retrying..."
        sleep 5
    fi
done

if [ $AIRDROP_SUCCESS -eq 0 ]; then
    echo "⚠️  Airdrop failed after 3 attempts. Continuing with existing balances..."
else
    # Wait for airdrop to confirm
    echo "Waiting for airdrop to confirm..."
    sleep 5

    # Recalculate total balance
    TOTAL_BALANCE=0
    for ((i=1; i<=NUM_WALLETS; i++)); do
        PUBKEY="${WALLETS[$i-1]}"
        BALANCE=$(solana balance "$PUBKEY" --url "$RPC_URL" 2>/dev/null | awk '{print $1}')
        TOTAL_BALANCE=$(echo "$TOTAL_BALANCE + $BALANCE" | bc -l)
    done
    echo "New total balance: $TOTAL_BALANCE SOL"
fi

# Redistribute SOL evenly among all players
echo ""
echo "💸 Redistributing SOL evenly among all players..."

# Calculate target balance per player (leave some for fees)
# Account for: (NUM_WALLETS - 1) transfers at ~0.000005 SOL each, plus extra buffer
# Using 0.05 SOL per potential transfer to be safe
NUM_TRANSFERS=$(echo "scale=0; $NUM_WALLETS - 1" | bc -l)
FEE_BUFFER=$(echo "scale=6; 0.05 * $NUM_TRANSFERS" | bc -l)
TARGET_PER_PLAYER=$(echo "scale=6; ($TOTAL_BALANCE - $FEE_BUFFER) / $NUM_WALLETS" | bc -l)
echo "Target balance per player: $TARGET_PER_PLAYER SOL (reserved $FEE_BUFFER SOL for $NUM_TRANSFERS transfers)"

# Find the wallet with the most SOL to use as source
MAX_BALANCE=0
SOURCE_INDEX=0
for ((i=1; i<=NUM_WALLETS; i++)); do
    PUBKEY="${WALLETS[$i-1]}"
    BALANCE=$(solana balance "$PUBKEY" --url "$RPC_URL" 2>/dev/null | awk '{print $1}')
    if (( $(echo "$BALANCE > $MAX_BALANCE" | bc -l) )); then
        MAX_BALANCE=$BALANCE
        SOURCE_INDEX=$i
    fi
done

SOURCE_WALLET="$WALLET_DIR/player$SOURCE_INDEX.json"
echo "Using Player $SOURCE_INDEX as source (has $MAX_BALANCE SOL)"

# Transfer SOL to balance out wallets
for ((i=1; i<=NUM_WALLETS; i++)); do
    if [ $i -ne $SOURCE_INDEX ]; then
        RECIPIENT="${WALLETS[$i-1]}"
        CURRENT_BALANCE=$(solana balance "$RECIPIENT" --url "$RPC_URL" 2>/dev/null | awk '{print $1}')
        NEEDED=$(echo "scale=6; $TARGET_PER_PLAYER - $CURRENT_BALANCE" | bc -l)

        if (( $(echo "$NEEDED > 0.001" | bc -l) )); then
            echo "Sending $NEEDED SOL to Player $i..."

            if solana transfer "$RECIPIENT" "$NEEDED" \
                --from "$SOURCE_WALLET" \
                --url "$RPC_URL" \
                --allow-unfunded-recipient \
                --fee-payer "$SOURCE_WALLET" > /dev/null 2>&1; then
                echo "✅ Transfer successful"
            else
                echo "⚠️  Transfer failed (might be due to insufficient balance)"
            fi

            # Small delay to avoid rate limiting
            sleep 1
        else
            echo "Player $i already has sufficient balance"
        fi
    fi
done

echo ""
echo "📊 Final balances:"
echo "---"

# Show final balances
for ((i=1; i<=NUM_WALLETS; i++)); do
    PUBKEY="${WALLETS[$i-1]}"
    BALANCE=$(solana balance "$PUBKEY" --url "$RPC_URL" 2>/dev/null | awk '{print $1}')
    echo "Player $i: $BALANCE SOL ($PUBKEY)"
done

# Calculate final total
FINAL_TOTAL=0
for ((i=1; i<=NUM_WALLETS; i++)); do
    PUBKEY="${WALLETS[$i-1]}"
    BALANCE=$(solana balance "$PUBKEY" --url "$RPC_URL" 2>/dev/null | awk '{print $1}')
    FINAL_TOTAL=$(echo "$FINAL_TOTAL + $BALANCE" | bc -l)
done

echo ""
echo "Total SOL: $FINAL_TOTAL SOL"
echo ""
echo "✅ Test wallets ready!"
echo ""
echo "Wallet files:"
ls -la "$WALLET_DIR"/*.json 2>/dev/null | awk '{print "  " $9}'