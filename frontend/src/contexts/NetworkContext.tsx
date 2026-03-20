import { createContext, useContext, useState, useMemo, ReactNode } from 'react';

import { Connection } from '@solana/web3.js';
import { GameClient } from '../services/gameClient';
import { TrustlessClient } from '../services/trustlessClient';
import { TrustfulClient } from '../services/trustfulClient';


export type Network = 'localnet' | 'devnet' | 'mainnet-beta' | 'custom';

interface NetworkContextType {
  network: Network;
  customRpcUrl: string;
  trustfulMode: boolean;
  activeClient: GameClient;
  setNetwork: (network: Network) => void;
  setCustomRpcUrl: (url: string) => void;
  applyCustomRpc: () => void;
  setTrustfulMode: (enabled: boolean) => void;
  connection: Connection;
}


const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [network, setNetworkState] = useState<Network>(() => {
    const stored = localStorage.getItem('solana-network');
    
    // Migrate existing localnet configurations to devnet
    if (stored === 'localnet') {
      localStorage.setItem('solana-network', 'devnet');
      return 'devnet';
    }
    
    if (stored === 'devnet' || stored === 'mainnet-beta' || stored === 'custom') {
      return stored as Network;
    }

    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'devnet';
      }
    }

    return 'mainnet-beta';
  });

  const [customRpcUrl, setCustomRpcUrl] = useState<string>(() => {
    return localStorage.getItem('solana-custom-rpc-url') || '';
  });

  const [trustfulMode, setTrustfulModeState] = useState<boolean>(() => {
    const stored = localStorage.getItem('solana-trustful-mode');
    return stored === null ? true : stored === 'true';
  });

  const rpcUrl = useMemo(() => {
    if (network === 'localnet') return 'http://127.0.0.1:8899';
    if (network === 'devnet') return 'https://api.devnet.solana.com';
    if (network === 'mainnet-beta') return 'https://api.mainnet-beta.solana.com';
    return customRpcUrl || 'https://api.mainnet-beta.solana.com';
  }, [network, customRpcUrl]);

  const connection = useMemo(() => new Connection(rpcUrl, 'confirmed'), [rpcUrl]);

  const activeClient = useMemo(() => {
    if (trustfulMode) {
      return new TrustfulClient();
    }
    return new TrustlessClient(connection);
  }, [trustfulMode, connection]);

  const setNetwork = (newNetwork: Network) => {
    console.log(`[NetworkContext] Switching network to ${newNetwork}`);
    setNetworkState(newNetwork);
    localStorage.setItem('solana-network', newNetwork);
    if (newNetwork !== 'custom') {
      window.location.reload();
    }
  };

  const setTrustfulMode = (enabled: boolean) => {
    setTrustfulModeState(enabled);
    localStorage.setItem('solana-trustful-mode', enabled.toString());
  };

  const applyCustomRpc = () => {
    console.log(`[NetworkContext] Applying custom RPC: ${customRpcUrl}`);
    localStorage.setItem('solana-custom-rpc-url', customRpcUrl);
    window.location.reload();
  };


  return (
    <NetworkContext.Provider value={{
      network,
      customRpcUrl,
      trustfulMode,
      activeClient,
      setNetwork,
      setCustomRpcUrl,
      applyCustomRpc,
      setTrustfulMode,
      connection
    }}>
      {children}
    </NetworkContext.Provider>

  );
}

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (context === undefined) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
}
