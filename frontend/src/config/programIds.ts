import { PublicKey } from '@solana/web3.js';
import programIds from '../../../scripts/program-ids.json';

type Network = 'localnet' | 'devnet' | 'mainnet-beta' | 'custom';

// Auto-detect network from localStorage or URL
function getCurrentNetwork(): Network {
  if (typeof window === 'undefined') return 'devnet';
  
  // First, check localStorage for user's network selection
  const stored = localStorage.getItem('solana-network');
  if (stored === 'localnet' || stored === 'devnet' || stored === 'mainnet-beta' || stored === 'custom') {
    return stored as Network;
  }

  // Fallback to hostname-based detection
  const hostname = window.location.hostname;
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    hostname.endsWith('.local')
  ) {
    return 'devnet';
  }

  return 'mainnet-beta';
}

export function getProgramId(program: 'banyan' | 'rps' | 'chess' = 'rps', network?: Network): PublicKey {
  const targetNetwork = network || getCurrentNetwork();

  // Map mainnet-beta to mainnet for the JSON lookup
  // Default 'custom' to 'devnet' for program ID lookups
  let jsonKey: string = targetNetwork;
  if (targetNetwork === 'mainnet-beta') jsonKey = 'mainnet';
  if (targetNetwork === 'custom') jsonKey = 'devnet';

  const netData = (programIds as any)[jsonKey];

  if (!netData) {
    console.error(`[getProgramId] No configuration found for network: ${targetNetwork}`);
    throw new Error(`No configuration found for network: ${targetNetwork}`);
  }

  // Handle nested structure or legacy string
  const programId = typeof netData === 'string' ? netData : (netData as any)[program];

  if (!programId || programId === "11111111111111111111111111111111") {
    // If we're on mainnet and ID is missing, fallback to devnet as a last resort
    if (targetNetwork === 'mainnet-beta') {
      console.warn(`[getProgramId] Program ${program} not found on mainnet-beta, falling back to devnet`);
      return getProgramId(program, 'devnet');
    }

    console.warn(`[getProgramId] No program ID configured for ${program} on ${targetNetwork}`);
    if (targetNetwork === 'localnet') {
      throw new Error(`Program ${program} not found on localnet. Did you run 'make deploy-${program}'?`);
    }
    throw new Error(`No program ID configured for ${program} on ${targetNetwork}`);
  }

  console.log(`[getProgramId] Using ${program} ID on ${targetNetwork}: ${programId}`);
  return new PublicKey(programId);
}