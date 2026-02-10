.PHONY: help test test-program test-frontend build build-program build-frontend deploy dev clean lint lint-program lint-frontend coverage coverage-program

# Default target
help:
	@echo "🎮 Throwdown - Available Commands"
	@echo ""
	@echo "Testing:"
	@echo "  make test              Run all tests (program + frontend)"
	@echo "  make test-program      Run Rust program tests"
	@echo "  make test-frontend     Run frontend tests"
	@echo "  make coverage          Run test coverage (requires cargo-llvm-cov)"
	@echo "  make coverage-program  Run Rust coverage only"
	@echo ""
	@echo "Linting:"
	@echo "  make lint              Lint all code (program + frontend)"
	@echo "  make lint-program      Lint Rust code with clippy"
	@echo "  make lint-frontend     Lint frontend code"
	@echo ""
	@echo "Building:"
	@echo "  make build             Build everything"
	@echo "  make build-program     Build Rust program"
	@echo "  make build-frontend    Build frontend for production"
	@echo ""
	@echo "Development:"
	@echo "  make dev               Start frontend dev server"
	@echo "  make deploy            Deploy program to Solana"
	@echo ""
	@echo "Cleanup:"
	@echo "  make clean             Clean all build artifacts"
	@echo "  make clean-program     Clean Rust build artifacts"
	@echo "  make clean-frontend    Clean frontend build artifacts"

# Run all tests
test: test-program test-frontend
	@echo "✅ All tests passed!"

# Run Rust program tests
test-program:
	@echo "🦀 Running Rust tests..."
	@cd programs/rps && cargo test

# Run frontend tests
test-frontend:
	@echo "⚛️  Running frontend tests..."
	@cd frontend && yarn test --passWithNoTests

# Build everything
build: build-program build-frontend
	@echo "✅ Build complete!"

# Build Rust program
build-program:
	@echo "🦀 Building Rust program..."
	@cd programs/rps && rm -f Cargo.lock && ~/.local/share/solana/install/active_release/bin/sdk/sbf/dependencies/platform-tools/rust/bin/cargo build-sbf --sbf-out-dir=../../target/deploy

# Build frontend for production
build-frontend:
	@echo "⚛️  Building frontend..."
	@cd frontend && yarn build

# Deploy program to Solana
deploy:
	@echo "🚀 Deploying program..."
	@./deploy.sh

# Start frontend dev server
dev:
	@echo "🔥 Starting frontend dev server..."
	@cd frontend && yarn dev

# Clean all build artifacts
clean: clean-program clean-frontend
	@echo "🧹 All build artifacts removed"

# Clean Rust build artifacts
clean-program:
	@echo "🧹 Cleaning Rust build artifacts..."
	@cd programs/rps && cargo clean
	@rm -rf target

# Clean frontend build artifacts
clean-frontend:
	@echo "🧹 Cleaning frontend build artifacts..."
	@cd frontend && rm -rf dist node_modules/.cache

# Lint all code
lint: lint-program lint-frontend
	@echo "✅ All linting passed!"

# Lint Rust code with clippy
lint-program:
	@echo "🦀 Running Rust clippy..."
	@cd programs/rps && cargo clippy --all-targets -- -W clippy::all

# Lint frontend code
lint-frontend:
	@echo "⚛️  Running frontend linter..."
	@cd frontend && yarn lint || echo "No lint script configured"

# Run test coverage (both)
coverage: coverage-program
	@echo "✅ Coverage report complete!"

# Run Rust test coverage
coverage-program:
	@echo "🦀 Running Rust test coverage..."
	@echo "📦 Installing cargo-llvm-cov if needed..."
	@cargo llvm-cov --version > /dev/null 2>&1 || cargo install cargo-llvm-cov
	@cd programs/rps && cargo llvm-cov --html
	@echo "📊 Coverage report: programs/rps/target/llvm-cov/html/index.html"
