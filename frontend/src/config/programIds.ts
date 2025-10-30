import { PublicKey } from '@solana/web3.js';
import programIds from '../../../program-ids.json';

type Network = 'localnet' | 'devnet' | 'mainnet-beta';

// Auto-detect network from localStorage or URL
export function getCurrentNetwork(): Network {
  if (typeof window === 'undefined') return 'localnet';

  // First, check localStorage for user's network selection
  const stored = localStorage.getItem('solana-network');
  if (stored === 'localnet' || stored === 'devnet' || stored === 'mainnet-beta') {
    return stored as Network;
  }

  // Fallback to hostname-based detection
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'localnet';
  }

  return 'devnet';
}

export function getProgramId(network?: Network): PublicKey {
  const targetNetwork = network || getCurrentNetwork();

  // Map mainnet-beta to mainnet for the JSON lookup
  const jsonKey = targetNetwork === 'mainnet-beta' ? 'mainnet' : targetNetwork;
  const programId = programIds[jsonKey as keyof typeof programIds];

  if (!programId || programId === "11111111111111111111111111111111") {
    throw new Error(`No program ID configured for network: ${targetNetwork}`);
  }

  return new PublicKey(programId);
}