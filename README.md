# Skrim - Rock Paper Scissors Arena

A Solana blockchain arena featuring 1v1 Rock Paper Scissors matches with SOL buy-ins and winner-takes-all payouts.

## Overview

This project demonstrates advanced Solana program development using Pinocchio, a zero-dependency library that optimizes compute unit usage. The full-featured implementation includes:

- **🥊 1v1 Matchups**: Quick, instant-on matches between two players
- **💰 SOL Buy-ins**: Configurable entry fees with automatic prize distribution  
- **🔒 Commit-Reveal Scheme**: Secure move submission prevents cheating
- **⚡ Efficient Execution**: Built with Pinocchio for optimized compute usage
- **🎮 Full-Stack dApp**: React frontend with TypeScript and wallet integration
- **🧪 Comprehensive Testing**: 19 tests covering all game mechanics

## Prerequisites

- [Rust](https://rustup.rs/) (latest stable version)
- [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools)
- [Node.js](https://nodejs.org/) (v18 or later)
- [Phantom Wallet](https://phantom.app/) (for frontend interaction)

## Project Structure

```
Skrim/
├── program/               # Solana program source
│   ├── src/
│   │   └── lib.rs        # Main program logic
│   └── Cargo.toml        # Program dependencies
├── frontend/             # React frontend
│   ├── src/
│   │   ├── App.tsx       # Main app component
│   │   ├── TokenCreator.tsx  # Token creation UI
│   │   └── WalletProvider.tsx # Wallet connection
│   └── package.json      # Frontend dependencies
├── build.sh              # Program build script
├── deploy.sh             # Testnet deployment script
└── Cargo.toml            # Workspace configuration
```

## Quick Start

### 1. Clone and Setup

```bash
cd skrim
```

### 2. Build the Program

```bash
./build.sh
```

This builds the Solana program using `cargo build-sbf`.

### 3. Deploy to Devnet

First, ensure you have a Solana wallet with devnet SOL:

```bash
# Generate a new wallet (if needed)
solana-keygen new

# Get devnet SOL
solana airdrop 2

# Deploy the program
./deploy.sh
```

### 4. Run the Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`.

## Program Features

### Token Creation

The program creates Token2022 tokens with the following features:

- **Metadata Support**: Uses the MetadataPointer extension
- **Custom Metadata**: Name, symbol, URI, and decimals
- **Proper Validation**: Input validation and error handling
- **Efficient Execution**: Built with Pinocchio for optimal compute usage

### Key Components

- **`CreateTokenArgs`**: Borsh-serializable instruction data structure
- **Process Instruction**: Main entrypoint with proper account validation
- **Error Handling**: Comprehensive validation and error messages

## Frontend Features

### Wallet Integration

- **Phantom Wallet**: Primary wallet adapter
- **Devnet Support**: Configured for devnet interaction
- **Auto-connect**: Automatic wallet reconnection

### User Interface

- **Token Creation Form**: Input fields for token metadata
- **Transaction Status**: Real-time feedback on token creation
- **Responsive Design**: Works on desktop and mobile

## Development

### Building the Program

```bash
# Build for development
cargo build-sbf --manifest-path program/Cargo.toml

# Build for release
cargo build-sbf --manifest-path program/Cargo.toml --release
```

## 🧪 Testing

This project includes comprehensive test coverage to ensure reliability and help with debugging:

### Quick Test Run

```bash
# Run all tests (Rust + Frontend)
./test.sh
```

### Individual Test Suites

```bash
# Rust unit tests (11 tests)
cd program && cargo test

# Frontend tests (8 tests) 
cd frontend && npm test
```

### Test Coverage

**Rust Tests (program/src/tests.rs)**:
- ✅ RPS winner logic with all move combinations
- ✅ Game state transitions and validation
- ✅ Tournament bracket size calculations (4, 8, 16, 32 players)
- ✅ Instruction serialization/deserialization
- ✅ Player data and game account structures
- ✅ Move enum values and array handling
- ✅ Hash verification for commit-reveal scheme

**Frontend Tests (frontend/src/__tests__/)**:
- ✅ Instruction buffer serialization (CreateGame, JoinGame)
- ✅ Tournament size validation
- ✅ Prize pool calculations  
- ✅ RPS game logic implementation
- ✅ SOL to Lamports conversion
- ✅ Tournament rounds calculation
- ✅ Move enum consistency

### Debugging with Tests

The tests help troubleshoot common issues:

```bash
# Run tests with verbose output
cd program && cargo test -- --nocapture
cd frontend && npm test -- --verbose

# Watch mode for continuous testing
cd frontend && npm run test:watch
```

### Local Development

For local development, you can use a local validator:

```bash
# Start local validator
solana-test-validator

# Deploy to local
solana program deploy target/deploy/skrim_token_program.so --url localhost
```

## Configuration

### Environment Variables

- **Frontend**: Configuration in `frontend/src/WalletProvider.tsx`
- **Network**: Currently set to devnet, can be changed to mainnet-beta

### Program ID

After deployment, the program ID is automatically updated in the frontend. You can also manually update it in `frontend/src/TokenCreator.tsx`.

## Best Practices

### Rust Development

- **Error Handling**: Comprehensive error validation
- **Security**: Input validation and account verification
- **Documentation**: Inline comments and clear function signatures
- **Testing**: Unit tests for core functionality

### Frontend Development

- **TypeScript**: Strict typing for better development experience
- **Component Structure**: Modular, reusable components
- **State Management**: React hooks for state management
- **Error Handling**: User-friendly error messages

## Troubleshooting

### Common Issues

1. **Build Errors**: Ensure you have the latest Rust and Solana CLI versions
2. **Deployment Fails**: Check wallet balance and network connectivity
3. **Frontend Connection**: Ensure Phantom wallet is installed and connected to devnet

### Debug Commands

```bash
# Check Solana config
solana config get

# Check wallet balance
solana balance

# View program logs
solana logs <program-id>
```

## TODOs

### Prize Distribution
**Current Implementation**: 99% to winner, 1% platform fee (remains in game account)
- Winner receives 99% of prize pool
- 1% platform fee stays in game account (TODO: add withdrawal mechanism for game creator)

**Future Modes**:

#### Consolation Prize Mode
Distribute prizes to runners-up instead of winner-takes-all:
- Example: 70% winner, 20% runner-up, 9% third place, 1% platform fee
- Requires tracking final placement/elimination order
- More engaging for casual tournaments, encourages participation
- Trade-off: Lower top prize vs. broader reward distribution

#### Trustful Mode (Durable Nonces for Auto-Reveal)
Use durable nonces to allow automatic move revelation without requiring players to be online:
- Players submit moves with durable nonce transactions
- Off-chain service or anyone can reveal moves using the nonce
- Eliminates need for players to return for reveal phase
- Benefits: Better UX, reduces game abandonment, enables async play
- Challenges: Requires off-chain infrastructure, nonce rent costs, potential griefing vectors
- Trade-off: Trustlessness vs. convenience

### Rent Management Optimization
**Current Implementation**: Creator pays all rent upfront for game account. Winner receives remaining balance minus 1% platform fee.

**Future Consideration**: Implement lazy account allocation:
- Benefits: Lower upfront cost for creator, scales better for large tournaments
- Challenges: Rent fluctuation risk, more complex accounting
- Trade-off: Complexity vs. capital efficiency for 1000+ player tournaments

## Resources

- [Pinocchio Documentation](https://github.com/firedancer-io/pinocchio)
- [Solana Documentation](https://docs.solana.com/)
- [Token2022 Guide](https://spl.solana.com/token-2022)
- [Helius Tutorial](https://www.helius.dev/blog/pinocchio)

## License

This project is open source and available under the MIT License.