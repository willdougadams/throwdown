import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction
} from '@solana/web3.js';
import { getProgramId } from '../config/programIds';
import { TransactionPacker, AccountSizeCalculator, ChessTransactionPacker } from './transactionPacker';

export interface CreateChallengeParams {
  entryFee: number; // in SOL
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
    this.programId = getProgramId(program);

    console.log(`[Web3ProgramClient] Initialized for ${program} on ${this.connection.rpcEndpoint} with ID: ${this.programId.toBase58()}`);
  }

  // --- Constants for Program Account Offsets ---
  private static readonly OFFSETS = {
    RPS: {
      BUY_IN_LAMPORTS: 48,
    },
    CHESS: {
      BUY_IN_LAMPORTS: 40,
      PLAYER_WHITE_PUBKEY: 136,
      PLAYER_BLACK_PUBKEY: 176,
    }
  };

  async createChallenge(params: CreateChallengeParams): Promise<GameCreationResult> {
    if (!this.wallet.publicKey || !this.wallet.signTransaction) {
      throw new Error('Wallet not connected');
    }

    const seed = `game_${Date.now()}`;
    const gameAccount = await PublicKey.createWithSeed(
      this.wallet.publicKey,
      seed,
      this.programId
    );

    const movesHash = TransactionPacker.hashMoves(params.moves as any, params.salt);
    const buyInLamports = BigInt(Math.floor(params.entryFee * 1_000_000_000));

    const instructionData = TransactionPacker.packCreateChallenge(
      buyInLamports,
      movesHash
    );

    TransactionPacker.logInstruction('CreateChallenge', instructionData);

    const gameSpace = AccountSizeCalculator.calculateGameAccountSize();
    console.log('[Web3ProgramClient] Creating challenge with seed:', {
      gameAccount: gameAccount.toBase58(),
      seed,
      space: gameSpace,
      buyIn: params.entryFee
    });
    const gameRent = await this.connection.getMinimumBalanceForRentExemption(gameSpace);

    const instructions = [];

    instructions.push(SystemProgram.createAccountWithSeed({
      fromPubkey: this.wallet.publicKey,
      newAccountPubkey: gameAccount,
      basePubkey: this.wallet.publicKey,
      seed: seed,
      lamports: gameRent,
      space: gameSpace,
      programId: this.programId,
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
      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());
      await this.connection.confirmTransaction(signature, 'confirmed');
      console.log('[Web3ProgramClient] Transaction confirmed:', signature);

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
    return this.acceptChallenge(gameId, moves);
  }

  async acceptChallenge(gameId: string, moves: number[]): Promise<string> {
    if (!this.wallet.publicKey || !this.wallet.signTransaction) {
      throw new Error('Wallet not connected');
    }

    const gameAccount = new PublicKey(gameId);
    const accountInfo = await this.connection.getAccountInfo(gameAccount);
    if (!accountInfo) throw new Error('Challenge not found');

    const buyInLamports = accountInfo.data.readBigUInt64LE(Web3ProgramClient.OFFSETS.RPS.BUY_IN_LAMPORTS);
    const instructionData = TransactionPacker.packAcceptChallenge(moves as any);

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

  async createChessChallenge(params: { entryFee: number }): Promise<GameCreationResult> {
    if (!this.wallet.publicKey || !this.wallet.signTransaction) {
      throw new Error('Wallet not connected');
    }

    const chessProgramId = getProgramId('chess');
    const buyInLamports = BigInt(Math.floor(params.entryFee * 1_000_000_000));

    const seed = `chess_${Date.now()}`;
    const gameAccount = await PublicKey.createWithSeed(
      this.wallet.publicKey,
      seed,
      chessProgramId
    );

    const instructionData = ChessTransactionPacker.packCreateChallenge(
      buyInLamports
    );
    const space = AccountSizeCalculator.calculateChessAccountSize();
    const rent = await this.connection.getMinimumBalanceForRentExemption(space);

    const transaction = new Transaction();
    transaction.add(
      SystemProgram.createAccountWithSeed({
        fromPubkey: this.wallet.publicKey,
        newAccountPubkey: gameAccount,
        basePubkey: this.wallet.publicKey,
        seed,
        lamports: rent,
        space,
        programId: chessProgramId
      })
    );
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: this.wallet.publicKey,
        toPubkey: gameAccount,
        lamports: Number(buyInLamports),
      })
    );
    transaction.add(
      new TransactionInstruction({
        keys: [
          { pubkey: this.wallet.publicKey, isSigner: true, isWritable: false },
          { pubkey: gameAccount, isSigner: false, isWritable: true },
        ],
        programId: chessProgramId,
        data: Buffer.from(instructionData),
      })
    );

    const { blockhash } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = this.wallet.publicKey;

    try {
      const signedTransaction = await this.wallet.signTransaction(transaction);
      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());
      await this.connection.confirmTransaction(signature, 'confirmed');
      return { gameId: gameAccount.toString(), signature };
    } catch (e) {
      console.error('CreateChessChallenge failed:', e);
      throw e;
    }
  }

  async acceptChessChallenge(gameId: string): Promise<string> {
    if (!this.wallet.publicKey || !this.wallet.signTransaction) {
      throw new Error('Wallet not connected');
    }

    const chessProgramId = getProgramId('chess');
    const gameAccount = new PublicKey(gameId);

    const accountInfo = await this.connection.getAccountInfo(gameAccount);
    if (!accountInfo) throw new Error('Game not found');

    const buyInLamports = accountInfo.data.slice(
      Web3ProgramClient.OFFSETS.CHESS.BUY_IN_LAMPORTS,
      Web3ProgramClient.OFFSETS.CHESS.BUY_IN_LAMPORTS + 8
    ).readBigUInt64LE(0);

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

    const accountInfo = await this.connection.getAccountInfo(gameAccount);
    if (!accountInfo) throw new Error('Game account not found');

    const playerWhite = new PublicKey(accountInfo.data.slice(
      Web3ProgramClient.OFFSETS.CHESS.PLAYER_WHITE_PUBKEY,
      Web3ProgramClient.OFFSETS.CHESS.PLAYER_WHITE_PUBKEY + 32
    ));
    const playerBlack = new PublicKey(accountInfo.data.slice(
      Web3ProgramClient.OFFSETS.CHESS.PLAYER_BLACK_PUBKEY,
      Web3ProgramClient.OFFSETS.CHESS.PLAYER_BLACK_PUBKEY + 32
    ));

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

export function createWeb3ProgramClient(connection: Connection, wallet: any, program: 'rps' | 'chess' = 'rps'): Web3ProgramClient {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error('Wallet must be connected and have signing capabilities');
  }

  return new Web3ProgramClient(connection, wallet, program);
}