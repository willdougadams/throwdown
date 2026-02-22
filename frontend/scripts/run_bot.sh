#!/bin/bash
# Wrapper script to run the bot in WSL
echo "🚀 Starting Banyan Bot wrapper..."
cd /home/will/skrim/frontend

# Check if node is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found in path"
    echo "PATH: $PATH"
    # Try Source nvm if it exists
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
fi

echo "📂 CWD: $(pwd)"
echo "🔧 Node: $(node -v)"
echo "📦 NPM: $(npm -v)"

# Helper to run tsx
./node_modules/.bin/tsx scripts/banyan-bot.ts
