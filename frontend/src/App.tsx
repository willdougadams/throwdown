import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import WalletContextProvider from './WalletProvider';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { GamesProvider } from './contexts/GamesContext';
import { NetworkProvider } from './contexts/NetworkContext';
import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import GamePage from './pages/GamePage';

function App() {
    return (
        <ThemeProvider>
            <NetworkProvider>
                <WalletContextProvider>
                    <ToastProvider>
                        <GamesProvider>
                            <Router>
                                <Layout>
                                    <Routes>
                                        <Route path="/" element={<LandingPage />} />
                                        <Route path="/game/:gameId" element={<GamePage />} />
                                    </Routes>
                                </Layout>
                            </Router>
                        </GamesProvider>
                    </ToastProvider>
                </WalletContextProvider>
            </NetworkProvider>
        </ThemeProvider>
    );
}

export default App;