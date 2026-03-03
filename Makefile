.PHONY: help test test-program test-frontend build build-program build-frontend deploy dev clean lint lint-program lint-frontend coverage coverage-program init-banyan banyan-bot

NETWORK ?= localnet

# Default target
help:
	@echo "🎮 Skrim - Available Commands"
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
	@echo "  make build-banyan      Build Great Banyan program"
	@echo "  make build-rps         Build RPS program"
	@echo "  make build-chess       Build Chess program"
	@echo "  make build-frontend    Build frontend for production"
	@echo ""
	@echo "Development:"
	@echo "  make dev               Start frontend dev server"
	@echo "  make deploy-banyan     Deploy Great Banyan to Solana"
	@echo "  make deploy-rps        Deploy RPS to Solana"
	@echo "  make deploy-chess      Deploy Chess to Solana"
	@echo ""
	@echo "Cleanup:"
	@echo "  make clean             Clean all build artifacts"
	@echo "  make clean-program     Clean Rust build artifacts"
	@echo "  make clean-frontend    Clean frontend build artifacts"

# Run all tests
test:
	@node scripts/test.js all

# Run Rust program tests
test-program:
	@node scripts/test.js rps

test-rps:
	@node scripts/test.js rps

test-banyan:
	@node scripts/test.js banyan

test-chess:
	@node scripts/test.js chess

# Run frontend tests
test-frontend:
	@node scripts/test.js frontend

# Build RPS program
build-rps:
	@node scripts/build.js rps

# Build Great Banyan
build-banyan:
	@node scripts/build.js banyan

# Build Chess program
build-chess:
	@node scripts/build.js chess

# Build everything
build:
	@node scripts/build.js all

# Build frontend for production
build-frontend:
	@node scripts/build.js frontend

# Deploy RPS
deploy-rps:
	@node scripts/deploy.js rps $(NETWORK)

# Deploy Great Banyan
deploy-banyan:
	@node scripts/deploy.js banyan $(NETWORK)

# Deploy Chess
deploy-chess:
	@node scripts/deploy.js chess $(NETWORK)

# Start frontend dev server
dev:
	@echo "🔥 Starting frontend dev server..."
	@cd frontend && yarn dev

# Clean all build artifacts
clean:
	@node scripts/clean.js all

# Clean Rust build artifacts
clean-program:
	@node scripts/clean.js all # Cleans all program targets

# Clean frontend build artifacts
clean-frontend:
	@node scripts/clean.js frontend

# Lint all code
lint:
	@node scripts/lint.js all

# Lint Rust code with clippy
lint-program:
	@node scripts/lint.js program

# Lint frontend code
lint-frontend:
	@node scripts/lint.js frontend

# Coverage (Keep as is if tools are present, or migrate if needed)
coverage:
	@cd programs/rps && cargo llvm-cov --html

coverage-program:
	@cd programs/rps && cargo llvm-cov --html

init-banyan:
	@echo "🌱 Initializing Banyan on $(NETWORK)..."
	@cd frontend && npx tsx scripts/init-banyan.ts $(NETWORK)

banyan-bot:
	@echo "🤖 Starting Banyan Bot on $(NETWORK)..."
	@cd frontend && npx tsx scripts/banyan-bot.ts $(NETWORK)

	