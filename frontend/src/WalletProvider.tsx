import { FC, ReactNode, useMemo } from 'react';
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
    const { network, customRpcUrl } = useNetwork();

    const endpoint = useMemo(() => {
        // Return appropriate RPC endpoint based on selected network
        let ep = 'https://api.mainnet-beta.solana.com';
        if (network === 'localnet') {
            ep = 'http://127.0.0.1:8899';
        } else if (network === 'devnet') {
            ep = clusterApiUrl(WalletAdapterNetwork.Devnet);
        } else if (network === 'mainnet-beta') {
            ep = 'https://api.mainnet-beta.solana.com';
        } else if (network === 'custom') {
            ep = customRpcUrl || 'https://api.mainnet-beta.solana.com';
        }
        console.log(`[WalletProvider] Network: ${network}, Endpoint: ${ep}`);
        return ep;
    }, [network, customRpcUrl]);

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