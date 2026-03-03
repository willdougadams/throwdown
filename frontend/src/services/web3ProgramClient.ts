import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  Keypair
} from '@solana/web3.js';
import { getProgramId } from '../config/programIds';
import { TransactionPacker, AccountSizeCalculator, ChessTransactionPacker } from './transactionPacker';

export interface CreateChallengeParams {
  entryFee: number; // in SOL
  gameName: string;
  moves: number[];
  salt: bigint;
}

interface GameCreationResult {
  gameId: string;
  signature: string;
}

export class Web3ProgramClient {
  private connection: Connection;
  private wallet: any;
  private programId: PublicKey;

  constructor(connection: Connection, wallet: any, program: 'rps' | 'chess' = 'rps') {
    this.connection = connection;
    this.wallet = wallet;
    this.programId = getProgramId(program); // Auto-detect network & specified program

    console.log(`[Web3ProgramClient] Initialized for ${program} on ${this.connection.rpcEndpoint} with ID: ${this.programId.toBase58()}`);
  }

  async createChallenge(params: CreateChallengeParams): Promise<GameCreationResult> {
    if (!this.wallet.publicKey || !this.wallet.signTransaction) {
      throw new Error('Wallet not connected');
    }

    const gameKeypair = Keypair.generate();
    const gameAccount = gameKeypair.publicKey;

    // 1. Hash moves immediately
    const movesHash = TransactionPacker.hashMoves(params.moves as any, params.salt);
    const buyInLamports = BigInt(Math.floor(params.entryFee * 1_000_000_000));

    // 2. Pack CreateChallenge instruction
    const instructionData = TransactionPacker.packCreateChallenge(
      buyInLamports,
      movesHash,
      params.gameName
    );

    TransactionPacker.logInstruction('CreateChallenge', instructionData);

    const gameSpace = AccountSizeCalculator.calculateGameAccountSize();
    const gameRent = await this.connection.getMinimumBalanceForRentExemption(gameSpace);

    const instructions = [];

    // Create game account
    instructions.push(SystemProgram.createAccount({
      fromPubkey: this.wallet.publicKey,
      newAccountPubkey: gameAccount,
      lamports: gameRent,
      space: gameSpace,
      programId: this.programId,
    }));

    // Transfer buy-in
    instructions.push(SystemProgram.transfer({
      fromPubkey: this.wallet.publicKey,
      toPubkey: gameAccount,
      lamports: Number(buyInLamports),
    }));

    // Challenge instruction
    instructions.push(new TransactionInstruction({
      keys: [
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: false },
        { pubkey: gameAccount, isSigner: false, isWritable: true },
      ],
      programId: this.programId,
      data: Buffer.from(instructionData),
    }));

    try {
      const transaction = new Transaction();
      instructions.forEach(ix => transaction.add(ix));
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = this.wallet.publicKey;

      const signedTransaction = await this.wallet.signTransaction(transaction);
      signedTransaction.partialSign(gameKeypair);

      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());
      await this.connection.confirmTransaction(signature, 'confirmed');

      return {
        gameId: gameAccount.toString(),
        signature
      };
    } catch (error) {
      console.error('CreateChallenge failed:', error);
      throw error;
    }
  }

  async joinRPSGame(gameId: string, moves: number[]): Promise<string> {
    console.log(`[Web3ProgramClient] joinRPSGame called for ${gameId}`);
    return this.acceptChallenge(gameId, moves);
  }

  async acceptChallenge(gameId: string, moves: number[]): Promise<string> {
    if (!this.wallet.publicKey || !this.wallet.signTransaction) {
      throw new Error('Wallet not connected');
    }

    const gameAccount = new PublicKey(gameId);
    const accountInfo = await this.connection.getAccountInfo(gameAccount);
    if (!accountInfo) throw new Error('Challenge not found');

    const buyInLamports = accountInfo.data.readBigUInt64LE(368);
    const instructionData = TransactionPacker.packAcceptChallenge(moves as any);

    const transaction = new Transaction();

    // 1. Transfer buy-in
    transaction.add(SystemProgram.transfer({
      fromPubkey: this.wallet.publicKey,
      toPubkey: gameAccount,
      lamports: Number(buyInLamports),
    }));

    // 2. Accept instruction
    transaction.add(new TransactionInstruction({
      keys: [
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: false },
        { pubkey: gameAccount, isSigner: false, isWritable: true },
      ],
      programId: this.programId,
      data: Buffer.from(instructionData),
    }));

    const { blockhash } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = this.wallet.publicKey;

    const signedTransaction = await this.wallet.signTransaction(transaction);
    const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());
    await this.connection.confirmTransaction(signature, 'confirmed');

    return signature;
  }

  async revealMoves(gameId: string, moves: number[], salt: bigint): Promise<string> {
    if (!this.wallet.publicKey || !this.wallet.signTransaction) {
      throw new Error('Wallet not connected');
    }

    const gameAccount = new PublicKey(gameId);

    const instructionData = TransactionPacker.packRevealMoves(moves as any, salt);

    const revealMovesInstruction = new TransactionInstruction({
      keys: [
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: gameAccount, isSigner: false, isWritable: true },
      ],
      programId: this.programId,
      data: Buffer.from(instructionData),
    });

    const transaction = new Transaction().add(revealMovesInstruction);
    const { blockhash } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = this.wallet.publicKey;

    const signedTransaction = await this.wallet.signTransaction(transaction);
    const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());
    await this.connection.confirmTransaction(signature, 'confirmed');

    return signature;
  }

  async claimPrize(gameId: string): Promise<string> {
    if (!this.wallet.publicKey || !this.wallet.signTransaction) {
      throw new Error('Wallet not connected');
    }

    const gameAccount = new PublicKey(gameId);

    const instructionData = TransactionPacker.packClaimPrize();

    const claimPrizeInstruction = new TransactionInstruction({
      keys: [
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: gameAccount, isSigner: false, isWritable: true },
        { pubkey: this.getTreasuryPDA(), isSigner: false, isWritable: true },
      ],
      programId: this.programId,
      data: Buffer.from(instructionData),
    });

    try {
      const transaction = new Transaction().add(claimPrizeInstruction);
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = this.wallet.publicKey;

      const signedTransaction = await this.wallet.signTransaction(transaction);
      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());
      await this.connection.confirmTransaction(signature, 'confirmed');

      return signature;
    } catch (error) {
      console.error('Error in claimPrize:', error);
      throw error;
    }
  }

  async getGameAccount(gameId: string) {
    try {
      const gameAccount = new PublicKey(gameId);
      const accountInfo = await this.connection.getAccountInfo(gameAccount);

      if (!accountInfo) {
        return null;
      }

      return {
        data: accountInfo.data,
        owner: accountInfo.owner.toString(),
        executable: accountInfo.executable,
        lamports: accountInfo.lamports,
      };
    } catch (error) {
      console.error('Error fetching game account:', error);
      return null;
    }
  }

  private getTreasuryPDA(): PublicKey {
    const banyanProgramId = getProgramId('banyan');
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from('manager')],
      banyanProgramId
    );
    return pda;
  }

  // --- Idiot Chess Methods ---

  async createChessChallenge(params: { entryFee: number; gameName: string }): Promise<GameCreationResult> {
    if (!this.wallet.publicKey || !this.wallet.signTransaction) {
      throw new Error('Wallet not connected');
    }

    const chessProgramId = getProgramId('chess');
    const gameKeypair = Keypair.generate();
    const gameAccount = gameKeypair.publicKey;

    const buyInLamports = BigInt(Math.floor(params.entryFee * 1_000_000_000));
    const chessInstructionData = ChessTransactionPacker.packCreateChallenge(buyInLamports, params.gameName);

    const gameSpace = 272;
    const gameRent = await this.connection.getMinimumBalanceForRentExemption(gameSpace);

    const instructions = [];

    instructions.push(SystemProgram.createAccount({
      fromPubkey: this.wallet.publicKey,
      newAccountPubkey: gameAccount,
      lamports: gameRent,
      space: gameSpace,
      programId: chessProgramId,
    }));

    instructions.push(SystemProgram.transfer({
      fromPubkey: this.wallet.publicKey,
      toPubkey: gameAccount,
      lamports: Number(buyInLamports),
    }));

    instructions.push(new TransactionInstruction({
      keys: [
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: false },
        { pubkey: gameAccount, isSigner: false, isWritable: true },
      ],
      programId: chessProgramId,
      data: Buffer.from(chessInstructionData),
    }));

    const transaction = new Transaction();
    instructions.forEach(ix => transaction.add(ix));
    const { blockhash } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = this.wallet.publicKey;

    const signedTransaction = await this.wallet.signTransaction(transaction);
    signedTransaction.partialSign(gameKeypair);

    const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());
    await this.connection.confirmTransaction(signature, 'confirmed');

    return {
      gameId: gameAccount.toString(),
      signature
    };
  }

  async acceptChessChallenge(gameId: string): Promise<string> {
    if (!this.wallet.publicKey || !this.wallet.signTransaction) {
      throw new Error('Wallet not connected');
    }

    const chessProgramId = getProgramId('chess');
    const gameAccount = new PublicKey(gameId);

    const accountInfo = await this.connection.getAccountInfo(gameAccount);
    if (!accountInfo) throw new Error('Game not found');

    // buy_in_lamports is at offset 112 in Chess GameAccount
    const buyInLamports = accountInfo.data.slice(112, 120).readBigUInt64LE(0);

    const instructionData = ChessTransactionPacker.packAcceptChallenge();

    const transaction = new Transaction();
    transaction.add(SystemProgram.transfer({
      fromPubkey: this.wallet.publicKey,
      toPubkey: gameAccount,
      lamports: Number(buyInLamports),
    }));

    transaction.add(new TransactionInstruction({
      keys: [
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: false },
        { pubkey: gameAccount, isSigner: false, isWritable: true },
      ],
      programId: chessProgramId,
      data: Buffer.from(instructionData),
    }));

    const { blockhash } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = this.wallet.publicKey;

    const signedTransaction = await this.wallet.signTransaction(transaction);
    const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());
    await this.connection.confirmTransaction(signature, 'confirmed');

    return signature;
  }

  async makeChessMove(gameId: string, fromX: number, fromY: number, toX: number, toY: number): Promise<string> {
    if (!this.wallet.publicKey || !this.wallet.signTransaction) {
      throw new Error('Wallet not connected');
    }

    const chessProgramId = getProgramId('chess');
    const gameAccount = new PublicKey(gameId);

    // Fetch game data to get player pubkeys for automatic prize distribution
    const accountInfo = await this.connection.getAccountInfo(gameAccount);
    if (!accountInfo) throw new Error('Game account not found');

    // Player White is at offset 144, Player Black is at offset 184 (40 bytes each: 32 for pubkey + 8 padding/status)
    const playerWhite = new PublicKey(accountInfo.data.slice(144, 176));
    const playerBlack = new PublicKey(accountInfo.data.slice(184, 216));

    const instructionData = ChessTransactionPacker.packMakeMove(fromX, fromY, toX, toY);

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: false },
        { pubkey: gameAccount, isSigner: false, isWritable: true },
        { pubkey: playerWhite, isSigner: false, isWritable: true },
        { pubkey: playerBlack, isSigner: false, isWritable: true },
        { pubkey: this.getTreasuryPDA(), isSigner: false, isWritable: true },
      ],
      programId: chessProgramId,
      data: Buffer.from(instructionData),
    });

    const transaction = new Transaction().add(instruction);
    const { blockhash } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = this.wallet.publicKey;

    const signedTransaction = await this.wallet.signTransaction(transaction);
    const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());
    await this.connection.confirmTransaction(signature, 'confirmed');

    return signature;
  }

  async claimChessPrize(gameId: string): Promise<string> {
    if (!this.wallet.publicKey || !this.wallet.signTransaction) {
      throw new Error('Wallet not connected');
    }

    const chessProgramId = getProgramId('chess');
    const gameAccount = new PublicKey(gameId);
    const instructionData = ChessTransactionPacker.packClaimPrize();

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: gameAccount, isSigner: false, isWritable: true },
        { pubkey: this.getTreasuryPDA(), isSigner: false, isWritable: true },
      ],
      programId: chessProgramId,
      data: Buffer.from(instructionData),
    });

    const transaction = new Transaction().add(instruction);
    const { blockhash } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = this.wallet.publicKey;

    const signedTransaction = await this.wallet.signTransaction(transaction);
    const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());
    await this.connection.confirmTransaction(signature, 'confirmed');

    return signature;
  }
}

// Factory function
export function createWeb3ProgramClient(connection: Connection, wallet: any, program: 'rps' | 'chess' = 'rps'): Web3ProgramClient {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error('Wallet must be connected and have signing capabilities');
  }

  return new Web3ProgramClient(connection, wallet, program);
}