import React, { FC, ReactNode, useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import {
    WalletModalProvider
} from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import { useNetwork } from './contexts/NetworkContext';

import '@solana/wallet-adapter-react-ui/styles.css';

const WalletContextProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const { network } = useNetwork();

    const endpoint = useMemo(() => {
        // Return appropriate RPC endpoint based on selected network
        if (network === 'localnet') {
            return 'http://127.0.0.1:8899';
        } else if (network === 'devnet') {
            return clusterApiUrl(WalletAdapterNetwork.Devnet);
        } else if (network === 'mainnet-beta') {
            return clusterApiUrl(WalletAdapterNetwork.Mainnet);
        }
        return clusterApiUrl(WalletAdapterNetwork.Devnet);
    }, [network]);

    const wallets = useMemo(
        () => [
            new PhantomWalletAdapter(),
        ],
        []
    );

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>
                    {children}
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
};

export default WalletContextProvider;