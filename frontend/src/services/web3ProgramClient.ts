import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  Keypair
} from '@solana/web3.js';
import { getProgramId } from '../config/programIds';
import { TransactionPacker as TransactionPacker, AccountSizeCalculator } from './transactionPacker';

export interface CreateGameParams {
  entryFee: number; // in SOL
  gameName: string;
  description: string;
}

interface GameCreationResult {
  gameId: string;
  signature: string;
}

export class Web3ProgramClient {
  private connection: Connection;
  private wallet: any;
  private programId: PublicKey;

  constructor(connection: Connection, wallet: any) {
    this.connection = connection;
    this.wallet = wallet;
    this.programId = getProgramId(); // Auto-detect network

    console.log('Web3ProgramClient created with program ID:', this.programId.toString());
  }

  async createGame(params: CreateGameParams): Promise<GameCreationResult> {
    if (!this.wallet.publicKey || !this.wallet.signTransaction) {
      throw new Error('Wallet not connected');
    }

    // Use keypair accounts for simplicity
    const gameKeypair = Keypair.generate();
    const gameAccount = gameKeypair.publicKey;

    // No registry needed - games are discovered via getProgramAccounts

    // Use TransactionPacker for serialization
    const buyInLamports = BigInt(Math.floor(params.entryFee * 1_000_000_000));
    const instructionData = TransactionPacker.packCreateGame(
      buyInLamports,
      params.gameName,
      params.description
    );

    console.log('CreateGame data:', {
      buy_in_lamports: buyInLamports.toString()
    });
    TransactionPacker.logInstruction('CreateGame', instructionData);

    // Calculate space needed for the game account
    const gameSpace = AccountSizeCalculator.calculateGameAccountSize();
    const gameRent = await this.connection.getMinimumBalanceForRentExemption(gameSpace);

    const instructions = [];

    // Create game account owned by our program
    const createGameAccountIx = SystemProgram.createAccount({
      fromPubkey: this.wallet.publicKey,
      newAccountPubkey: gameAccount,
      lamports: gameRent,
      space: gameSpace,
      programId: this.programId, // Owned by our program so it can write data
    });
    instructions.push(createGameAccountIx);

    // Transfer creator's buy-in to the game account (creator auto-joins as player 1)
    const buyInTransferIx = SystemProgram.transfer({
      fromPubkey: this.wallet.publicKey,
      toPubkey: gameAccount,
      lamports: Number(buyInLamports),
    });
    instructions.push(buyInTransferIx);

    // Create the game instruction (no registry accounts needed)
    const createGameInstruction = new TransactionInstruction({
      keys: [
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: false },
        { pubkey: gameAccount, isSigner: false, isWritable: true },
      ],
      programId: this.programId,
      data: Buffer.from(instructionData),
    });

    instructions.push(createGameInstruction);

    try {
      // Create and send transaction
      const transaction = new Transaction();
      instructions.forEach(instruction => transaction.add(instruction));
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = this.wallet.publicKey;

      console.log('Signing transaction...');
      const signedTransaction = await this.wallet.signTransaction(transaction);

      // Add signature for the created game account
      signedTransaction.partialSign(gameKeypair);

      console.log('Sending transaction...');
      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());

      console.log('Confirming transaction...');
      await this.connection.confirmTransaction(signature, 'confirmed');

      return {
        gameId: gameAccount.toString(),
        signature
      };
    } catch (error) {
      console.error('Transaction failed:', error);
      throw error;
    }
  }

  async joinGame(gameId: string, playerSlot: number = 0): Promise<string> {
    if (!this.wallet.publicKey || !this.wallet.signTransaction) {
      throw new Error('Wallet not connected');
    }

    const gameAccount = new PublicKey(gameId);

    // Fetch game account to get buy-in amount
    const accountInfo = await this.connection.getAccountInfo(gameAccount);
    if (!accountInfo) {
      throw new Error('Game account not found');
    }

    // Read buy-in from game account data (offset 368, 8 bytes little-endian)
    // New offset: 32 (creator) + 64 (name) + 256 (description) + 6 (metadata) + 2 (padding) + 8 (timestamp) = 368
    // Wait, recalculating based on lib.rs:
    // creator(32) + name(64) + desc(256) + max_players(1) + current(1) + state(1) + padding(3) + timestamp(8) = 366.
    // Let's use 368 to align with 8-byte boundary if needed, but in lib.rs it's:
    // const OFFSET_BUY_IN: usize = 368;
    const buyInLamports = accountInfo.data.readBigUInt64LE(368);
    console.log('Buy-in amount:', buyInLamports.toString(), 'lamports');
    console.log('Joining as player slot:', playerSlot);

    // Build instruction data for JoinGame using TransactionPacker
    const instructionData = TransactionPacker.packJoinGame(playerSlot);

    const transaction = new Transaction();

    // First: Transfer buy-in to game account
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: this.wallet.publicKey,
        toPubkey: gameAccount,
        lamports: Number(buyInLamports),
      })
    );

    // Second: Call join_game instruction
    transaction.add(
      new TransactionInstruction({
        keys: [
          { pubkey: this.wallet.publicKey, isSigner: true, isWritable: false },
          { pubkey: gameAccount, isSigner: false, isWritable: true },
        ],
        programId: this.programId,
        data: Buffer.from(instructionData),
      })
    );

    try {

      // Get fresh blockhash to avoid reprocessed transaction errors
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('finalized');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = this.wallet.publicKey;

      console.log('Signing transaction with blockhash:', blockhash);
      const signedTransaction = await this.wallet.signTransaction(transaction);

      // Send with additional options to avoid duplicate processing
      console.log('Sending transaction...');
      const signature = await this.connection.sendRawTransaction(
        signedTransaction.serialize(),
        {
          skipPreflight: false,
          preflightCommitment: 'processed',
          maxRetries: 0 // Prevent automatic retries that could cause duplicates
        }
      );

      console.log('Transaction sent, confirming...', signature);
      // Use the lastValidBlockHeight for more reliable confirmation
      await this.connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      }, 'confirmed');

      return signature;
    } catch (error: any) {
      console.error('Transaction error:', error);

      // Handle specific duplicate transaction error
      if (error.message && error.message.includes('already been processed')) {
        throw new Error('This transaction has already been processed. You may have already joined this game or the transaction was submitted multiple times.');
      }

      // Handle simulation errors that might indicate already joined
      if (error.message && error.message.includes('simulation failed')) {
        throw new Error('Transaction simulation failed. You may have already joined this game or the game may be full.');
      }

      throw error;
    }
  }

  async submitMoves(gameId: string, moves: number[], salt: bigint): Promise<string> {
    if (!this.wallet.publicKey || !this.wallet.signTransaction) {
      throw new Error('Wallet not connected');
    }

    const gameAccount = new PublicKey(gameId);

    // Hash the moves
    const movesHash = TransactionPacker.hashMoves(moves as any, salt);
    const instructionData = TransactionPacker.packSubmitMoves(movesHash);

    const submitMovesInstruction = new TransactionInstruction({
      keys: [
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: gameAccount, isSigner: false, isWritable: true },
      ],
      programId: this.programId,
      data: Buffer.from(instructionData),
    });

    const transaction = new Transaction().add(submitMovesInstruction);
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
    console.log('claimPrize called with gameId:', gameId);

    if (!this.wallet.publicKey || !this.wallet.signTransaction) {
      throw new Error('Wallet not connected');
    }

    const gameAccount = new PublicKey(gameId);
    console.log('Game account:', gameAccount.toString());

    const instructionData = TransactionPacker.packClaimPrize();
    console.log('Instruction data:', instructionData);

    const claimPrizeInstruction = new TransactionInstruction({
      keys: [
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: gameAccount, isSigner: false, isWritable: true },
      ],
      programId: this.programId,
      data: Buffer.from(instructionData),
    });
    console.log('Claim prize instruction created');

    try {
      const transaction = new Transaction().add(claimPrizeInstruction);
      console.log('Getting latest blockhash...');
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = this.wallet.publicKey;
      console.log('Transaction constructed, signing...');

      const signedTransaction = await this.wallet.signTransaction(transaction);
      console.log('Transaction signed, sending...');

      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());
      console.log('Transaction sent:', signature);
      console.log('Confirming transaction...');

      await this.connection.confirmTransaction(signature, 'confirmed');
      console.log('Transaction confirmed!');

      return signature;
    } catch (error) {
      console.error('Error in claimPrize:', error);
      throw error;
    }
  }

  async getWaitingAccountAddress(player: PublicKey): Promise<PublicKey> {
    const [address] = await PublicKey.findProgramAddress(
      [Buffer.from('waiting'), player.toBuffer()],
      this.programId
    );
    return address;
  }

  async joinPool(entryFee: number): Promise<string> {
    if (!this.wallet.publicKey || !this.wallet.signTransaction) {
      throw new Error('Wallet not connected');
    }

    const waitingAccount = await this.getWaitingAccountAddress(this.wallet.publicKey);
    const entryFeeLamports = BigInt(Math.floor(entryFee * 1_000_000_000));
    const instructionData = TransactionPacker.packJoinPool(entryFeeLamports);

    // Calculate rent for WaitingAccount (48 bytes)
    const space = 48;
    const rent = await this.connection.getMinimumBalanceForRentExemption(space);

    const transaction = new Transaction();

    // 1. Send rent + entry fee to the PDA address
    // The program will detect if it needs to initialize data.
    // NOTE: On Solana, we can't "send" to an address that doesn't exist and have it belong to a program
    // unless we create it. But we can't sign for the PDA here without the program.
    // Actually, for simple data initialization, we can just create the account here 
    // but the previous error was that the program failed to WRITE to it if it already existed?
    // Wait, the user said: "it fails because the player was never properly added to the pool"
    // and "leave fails because the player was never properly added to the pool".
    // If JoinPool didn't require a signature, it wouldn't be able to initialize the account if it's a PDA.

    // RE-EVALUATING: The PDA needs to be created.
    transaction.add(
      SystemProgram.createAccount({
        fromPubkey: this.wallet.publicKey,
        newAccountPubkey: waitingAccount,
        lamports: Number(BigInt(rent) + entryFeeLamports),
        space: space,
        programId: this.programId,
      })
    );

    // 2. Call JoinPool instruction to initialize data
    transaction.add(
      new TransactionInstruction({
        keys: [
          { pubkey: this.wallet.publicKey, isSigner: true, isWritable: false },
          { pubkey: waitingAccount, isSigner: false, isWritable: true },
        ],
        programId: this.programId,
        data: Buffer.from(instructionData),
      })
    );

    const { blockhash } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = this.wallet.publicKey;

    const signedTransaction = await this.wallet.signTransaction(transaction);
    const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());
    await this.connection.confirmTransaction(signature, 'confirmed');

    return signature;
  }

  async leavePool(): Promise<string> {
    if (!this.wallet.publicKey || !this.wallet.signTransaction) {
      throw new Error('Wallet not connected');
    }

    const waitingAccount = await this.getWaitingAccountAddress(this.wallet.publicKey);
    const instructionData = TransactionPacker.packLeavePool();

    const leavePoolInstruction = new TransactionInstruction({
      keys: [
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: waitingAccount, isSigner: false, isWritable: true },
      ],
      programId: this.programId,
      data: Buffer.from(instructionData),
    });

    const transaction = new Transaction().add(leavePoolInstruction);
    const { blockhash } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = this.wallet.publicKey;

    const signedTransaction = await this.wallet.signTransaction(transaction);
    const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());
    await this.connection.confirmTransaction(signature, 'confirmed');

    return signature;
  }

  async matchPlayer(waitingPlayer: string, gameName: string): Promise<GameCreationResult> {
    if (!this.wallet.publicKey || !this.wallet.signTransaction) {
      throw new Error('Wallet not connected');
    }

    const waitingPlayerPubkey = new PublicKey(waitingPlayer);
    const waitingAccount = await this.getWaitingAccountAddress(waitingPlayerPubkey);

    // Fetch info to get entry fee
    const accountInfo = await this.connection.getAccountInfo(waitingAccount);
    if (!accountInfo) throw new Error('Waiting player not found');
    // Offset in lib.rs for WaitingAccount is: player(32) + entry_fee(8) + timestamp(8) = 48 bytes
    // So entry_fee is at offset 32
    const entryFeeLamports = accountInfo.data.readBigUInt64LE(32);

    const gameKeypair = Keypair.generate();
    const gameAccount = gameKeypair.publicKey;
    const gameSpace = AccountSizeCalculator.calculateGameAccountSize();
    const gameRent = await this.connection.getMinimumBalanceForRentExemption(gameSpace);

    const instructionData = TransactionPacker.packMatchPlayer(gameName);

    const transaction = new Transaction();

    // 1. Create game account
    transaction.add(SystemProgram.createAccount({
      fromPubkey: this.wallet.publicKey,
      newAccountPubkey: gameAccount,
      lamports: gameRent,
      space: gameSpace,
      programId: this.programId,
    }));

    // 2. Transfer matcher's entry fee
    transaction.add(SystemProgram.transfer({
      fromPubkey: this.wallet.publicKey,
      toPubkey: gameAccount,
      lamports: Number(entryFeeLamports),
    }));

    // 3. MatchPlayer instruction
    transaction.add(new TransactionInstruction({
      keys: [
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true }, // Creator/Matcher
        { pubkey: gameAccount, isSigner: false, isWritable: true },
        { pubkey: waitingAccount, isSigner: false, isWritable: true },
        { pubkey: waitingPlayerPubkey, isSigner: false, isWritable: true }, // For rent refund
      ],
      programId: this.programId,
      data: Buffer.from(instructionData),
    }));

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

  async getGameAccount(gameId: string) {
    try {
      const gameAccount = new PublicKey(gameId);
      const accountInfo = await this.connection.getAccountInfo(gameAccount);

      if (!accountInfo) {
        return null;
      }

      // Parse the account data manually based on the GameAccount structure
      // This would need to match your Rust struct layout
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
}

// Factory function
export function createWeb3ProgramClient(connection: Connection, wallet: any): Web3ProgramClient {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error('Wallet must be connected and have signing capabilities');
  }

  return new Web3ProgramClient(connection, wallet);
}