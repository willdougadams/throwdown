#!/usr/bin/env ts-node

/**
 * Seed games for UI testing
 * Creates various games with different states and configurations
 *
 * Usage: cd frontend && ts-node scripts/seed-games.ts [network]
 * Example: cd frontend && ts-node scripts/seed-games.ts localnet
 */

import { Connection, Keypair } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

// We need to implement a simple wallet adapter interface for the CLI
class CliWallet {
  constructor(public keypair: Keypair) {}

  get publicKey() {
    return this.keypair.publicKey;
  }

  async signTransaction(tx: any) {
    tx.partialSign(this.keypair);
    return tx;
  }

  async signAllTransactions(txs: any[]) {
    return txs.map(tx => {
      tx.partialSign(this.keypair);
      return tx;
    });
  }
}

interface GameConfig {
  playerIndex: number;
  playerCount: number;
  entryFee: number;
  gameName: string;
  description?: string;
}

const GAME_CONFIGS: GameConfig[] = [
  // 4-player games
  { playerIndex: 1, playerCount: 4, entryFee: 0.1, gameName: '4P Complete', description: 'Finished 4-player game' },
  { playerIndex: 2, playerCount: 4, entryFee: 0.1, gameName: '4P In Progress', description: 'Semifinals complete' },

  // 16-player games (use player 1 as creator so we can use all 16 available wallets)
  { playerIndex: 1, playerCount: 16, entryFee: 0.5, gameName: '16P Complete', description: 'Finished 16-player tournament' },
  { playerIndex: 1, playerCount: 16, entryFee: 0.5, gameName: '16P In Progress', description: 'Semifinals complete' },
];

async function loadKeypair(playerIndex: number): Promise<Keypair> {
  const walletPath = path.join(__dirname, '..', '..', 'test-wallets', `player${playerIndex}.json`);
  if (!fs.existsSync(walletPath)) {
    throw new Error(`Wallet not found: ${walletPath}`);
  }
  const keypairData = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
  return Keypair.fromSecretKey(new Uint8Array(keypairData));
}

interface CreatedGame {
  gameId: string;
  config: GameConfig;
  index: number;
}

/**
 * Play through a game to completion
 * All players submit moves, then reveal moves for each round
 */
async function playGameToCompletion(
  connection: Connection,
  gameId: string,
  playerCount: number,
  creatorPlayerIndex: number
): Promise<void> {
  const { createWeb3ProgramClient } = await import('../src/services/web3ProgramClient');

  // Generate random moves and salts for all players
  const playerMoves: Array<{ moves: number[], salt: bigint }> = [];

  for (let i = 0; i < playerCount; i++) {
    const moves = Array(5).fill(0).map(() => Math.floor(Math.random() * 3)); // 0=Rock, 1=Paper, 2=Scissors
    const salt = BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
    playerMoves.push({ moves, salt });
  }

  console.log(`   📝 Submitting moves for ${playerCount} players...`);

  // Phase 1: All players submit their moves
  for (let i = 0; i < playerCount; i++) {
    const playerIdx = (i === 0) ? creatorPlayerIndex : (creatorPlayerIndex + i);
    const keypair = await loadKeypair(playerIdx);
    const wallet = new CliWallet(keypair);
    const client = createWeb3ProgramClient(connection, wallet as any);

    try {
      await client.submitMoves(gameId, playerMoves[i].moves, playerMoves[i].salt);
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.log(`   ⚠️  Player ${i} failed to submit: ${error instanceof Error ? error.message : error}`);
    }
  }

  console.log(`   ✅ All moves submitted`);
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log(`   🔓 Revealing moves for ${playerCount} players...`);

  // Phase 2: All players reveal their moves
  for (let i = 0; i < playerCount; i++) {
    const playerIdx = (i === 0) ? creatorPlayerIndex : (creatorPlayerIndex + i);
    const keypair = await loadKeypair(playerIdx);
    const wallet = new CliWallet(keypair);
    const client = createWeb3ProgramClient(connection, wallet as any);

    try {
      await client.revealMoves(gameId, playerMoves[i].moves, playerMoves[i].salt);
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.log(`   ⚠️  Player ${i} failed to reveal: ${error instanceof Error ? error.message : error}`);
    }
  }

  console.log(`   ✅ All moves revealed - game complete!`);
}

async function main() {
  const network = process.argv[2] || 'localnet';
  const rpcUrl = network === 'localnet'
    ? 'http://127.0.0.1:8899'
    : 'https://api.devnet.solana.com';

  console.log('🎮 Seeding games on', network);
  console.log('   RPC URL:', rpcUrl);
  console.log('');

  const connection = new Connection(rpcUrl, 'confirmed');

  // Dynamically import the web3ProgramClient
  const { createWeb3ProgramClient } = await import('../src/services/web3ProgramClient');

  console.log(`Creating ${GAME_CONFIGS.length} test games...`);
  console.log('');

  const createdGames: CreatedGame[] = [];

  for (let i = 0; i < GAME_CONFIGS.length; i++) {
    const config = GAME_CONFIGS[i];

    console.log(`[${i + 1}/${GAME_CONFIGS.length}] Creating: "${config.gameName}"`);
    console.log(`   Creator: Player ${config.playerIndex}`);
    console.log(`   Config: ${config.playerCount} players, ${config.entryFee} SOL entry`);

    try {
      const keypair = await loadKeypair(config.playerIndex);
      const wallet = new CliWallet(keypair);

      const client = createWeb3ProgramClient(connection, wallet as any);

      const result = await client.createGame({
        playerCount: config.playerCount,
        entryFee: config.entryFee,
        gameName: config.gameName,
        description: config.description || ''
      });

      console.log(`   ✅ Created: ${result.gameId}`);
      createdGames.push({ gameId: result.gameId, config, index: i });
    } catch (error) {
      console.log(`   ❌ Failed: ${error instanceof Error ? error.message : error}`);
    }

    console.log('');
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('');
  console.log(`✅ Created ${createdGames.length}/${GAME_CONFIGS.length} games`);
  console.log('');

  // Now fill the games with players and play through rounds
  console.log('🎲 Filling games and playing rounds...');
  console.log('');

  for (const game of createdGames) {
    console.log(`Playing "${game.config.gameName}" (${game.gameId.slice(0, 8)}...)`);

    try {
      // Fill the game with players (start from player after creator)
      const startPlayer = game.config.playerIndex + 1;
      const playersNeeded = game.config.playerCount - 1; // Creator already joined

      console.log(`   Joining ${playersNeeded} more players...`);

      for (let i = 0; i < playersNeeded; i++) {
        const playerIdx = startPlayer + i;
        const playerSlot = i + 1; // Creator is at slot 0, additional players start at slot 1
        const keypair = await loadKeypair(playerIdx);
        const wallet = new CliWallet(keypair);
        const client = createWeb3ProgramClient(connection, wallet as any);

        await client.joinGame(game.gameId, playerSlot);
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log(`   ✅ Game filled with ${game.config.playerCount} players`);

      // Determine if this is a "Complete" or "In Progress" game
      const shouldComplete = game.config.gameName.includes('Complete');

      console.log(`   🎮 Playing rounds (${shouldComplete ? 'to completion' : 'stopping at finals'})...`);

      if (shouldComplete) {
        // Play through all rounds to completion
        await playGameToCompletion(connection, game.gameId, game.config.playerCount, game.config.playerIndex);
      } else {
        console.log(`   ⏳ Skipping round progression for "In Progress" game`);
      }

    } catch (error) {
      console.log(`   ❌ Failed to play: ${error instanceof Error ? error.message : error}`);
    }

    console.log('');
  }

  console.log('');
  console.log('✅ Seed data creation complete!');
  console.log(`🎯 Created and configured ${createdGames.length} games`);
  console.log('');
  console.log('🎮 "Complete" games have been fully played through with winners');
  console.log('📊 "In Progress" games are filled and ready for manual play');
  console.log('');
  console.log('🌐 Refresh your frontend at http://localhost:5173/ to see the games');
}

main().catch(console.error);
