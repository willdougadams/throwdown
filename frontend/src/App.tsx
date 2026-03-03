import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import WalletContextProvider from './WalletProvider';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { GamesProvider } from './contexts/GamesContext';
import { NetworkProvider } from './contexts/NetworkContext';
import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import RPSLobbyPage from './pages/RPSLobbyPage';
import IdiotChessLobbyPage from './pages/IdiotChessLobbyPage';
import GamePage from './pages/GamePage';
import IdiotChessPage from './pages/IdiotChessPage';
import GameDispatcher from './pages/GameDispatcher';
import GreatBanyanPage from './pages/GreatBanyanPage';
import AboutPage from './pages/AboutPage';

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
                                        <Route path="/rps-lobby" element={<RPSLobbyPage />} />
                                        <Route path="/game/:gameId" element={<GameDispatcher />} />
                                        <Route path="/rps-game/:gameId" element={<GamePage />} />
                                        <Route path="/idiot-chess-lobby" element={<IdiotChessLobbyPage />} />
                                        <Route path="/idiot-chess" element={<IdiotChessPage />} />
                                        <Route path="/chess-game/:gameId" element={<IdiotChessPage mode="live" />} />
                                        <Route path="/great-banyan" element={<GreatBanyanPage />} />
                                        <Route path="/about" element={<AboutPage />} />
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