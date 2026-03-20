#!/bin/bash

# Build script for Skrim Token Program

set -e

echo "Building RPS Bracket Program..."

# Build in programs/rps directory - output goes to programs/rps/target/deploy/
cd programs/rps
cargo build-sbf

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo "📍 Binary location: programs/rps/target/deploy/rps.so"
    ls -lh target/deploy/rps.so
else
    echo "❌ Build failed!"
    exit 1
fi