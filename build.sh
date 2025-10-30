#!/bin/bash

# Build script for Throwdown Token Program

set -e

echo "Building RPS Bracket Program..."

# Build in program directory - output goes to program/target/deploy/
cd program
cargo build-sbf -- -Znext-lockfile-bump

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo "📍 Binary location: program/target/deploy/throwdown_token_program.so"
    ls -lh target/deploy/throwdown_token_program.so
else
    echo "❌ Build failed!"
    exit 1
fi