#!/bin/bash

# Build script for Great Banyan Program

set -e

echo "Building Great Banyan Program..."

# Build in programs/great_banyan directory - output goes to programs/great_banyan/target/deploy/
cd programs/great_banyan
cargo build-sbf

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo "📍 Binary location: programs/great_banyan/target/deploy/great_banyan.so"
    ls -lh target/deploy/great_banyan.so
else
    echo "❌ Build failed!"
    exit 1
fi
