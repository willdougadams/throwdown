import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Network = 'localnet' | 'devnet' | 'mainnet-beta';

interface NetworkContextType {
  network: Network;
  setNetwork: (network: Network) => void;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [network, setNetworkState] = useState<Network>(() => {
    // Load from localStorage or default to localnet
    const stored = localStorage.getItem('solana-network');
    if (stored === 'localnet' || stored === 'devnet' || stored === 'mainnet-beta') {
      return stored as Network;
    }

    // Auto-detect based on hostname
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'localnet';
      }
    }

    return 'devnet';
  });

  const setNetwork = (newNetwork: Network) => {
    setNetworkState(newNetwork);
    localStorage.setItem('solana-network', newNetwork);
    // Reload the page to ensure clean state with new network
    window.location.reload();
  };

  return (
    <NetworkContext.Provider value={{ network, setNetwork }}>
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
