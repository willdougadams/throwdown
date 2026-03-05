import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Network = 'localnet' | 'devnet' | 'mainnet-beta' | 'custom';

interface NetworkContextType {
  network: Network;
  customRpcUrl: string;
  setNetwork: (network: Network) => void;
  setCustomRpcUrl: (url: string) => void;
  applyCustomRpc: () => void;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [network, setNetworkState] = useState<Network>(() => {
    const stored = localStorage.getItem('solana-network');
    if (stored === 'localnet' || stored === 'devnet' || stored === 'mainnet-beta' || stored === 'custom') {
      return stored as Network;
    }

    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'localnet';
      }
    }

    return 'devnet';
  });

  const [customRpcUrl, setCustomRpcUrl] = useState<string>(() => {
    return localStorage.getItem('solana-custom-rpc-url') || '';
  });

  const setNetwork = (newNetwork: Network) => {
    console.log(`[NetworkContext] Switching network to ${newNetwork}`);
    setNetworkState(newNetwork);
    localStorage.setItem('solana-network', newNetwork);
    // Auto-reload for standard networks to ensure clean state
    if (newNetwork !== 'custom') {
      window.location.reload();
    }
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
      setNetwork,
      setCustomRpcUrl,
      applyCustomRpc
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
