import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Player } from './GameEngine';

interface GameOverOverlayProps {
    winner: Player | 'draw' | null;
    onReturnToLobby: () => void;
    playerColor: Player;
}

const Confetti: React.FC = () => {
    const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800', '#ff5722'];
    const particles = Array.from({ length: 50 });

    return (
        <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2000, overflow: 'hidden' }}>
            {particles.map((_, i) => (
                <motion.div
                    key={i}
                    initial={{
                        x: `${Math.random() * 100}%`,
                        y: '100%',
                        rotate: 0,
                        scale: Math.random() * 0.5 + 0.5
                    }}
                    animate={{
                        y: ['100%', `${Math.random() * 50}%`, '110%'],
                        x: [`${Math.random() * 100}%`, `${Math.random() * 100}%`],
                        rotate: 360 * 2,
                    }}
                    transition={{
                        duration: Math.random() * 2 + 3,
                        repeat: Infinity,
                        ease: "easeOut",
                        delay: Math.random() * 2
                    }}
                    style={{
                        position: 'absolute',
                        width: '10px',
                        height: '10px',
                        backgroundColor: colors[Math.floor(Math.random() * colors.length)],
                        borderRadius: i % 2 === 0 ? '50%' : '0'
                    }}
                />
            ))}
        </div>
    );
};

const Raincloud: React.FC = () => {
    const drops = Array.from({ length: 30 });

    return (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2000, overflow: 'hidden' }}>
            <motion.div
                initial={{ y: -120 }}
                animate={{ y: 0 }}
                transition={{ duration: 1, ease: "easeOut" }}
                style={{
                    position: 'absolute',
                    top: '20px',
                    left: '50%',
                    marginLeft: '-150px',
                    width: '300px',
                    height: '80px',
                    backgroundColor: '#555',
                    borderRadius: '40px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 2001
                }}
            >
                <div style={{ position: 'absolute', top: '-20px', left: '40px', width: '60px', height: '60px', backgroundColor: '#555', borderRadius: '50%' }} />
                <div style={{ position: 'absolute', top: '-30px', left: '90px', width: '80px', height: '80px', backgroundColor: '#555', borderRadius: '50%' }} />
                <div style={{ position: 'absolute', top: '-20px', left: '160px', width: '60px', height: '60px', backgroundColor: '#555', borderRadius: '50%' }} />
            </motion.div>

            {drops.map((_, i) => (
                <motion.div
                    key={i}
                    initial={{
                        x: `calc(50% - 130px + ${Math.random() * 260}px)`,
                        y: 80,
                        opacity: 0
                    }}
                    animate={{
                        y: [80, '100%'],
                        opacity: [0, 1, 0]
                    }}
                    transition={{
                        duration: Math.random() * 1 + 0.5,
                        repeat: Infinity,
                        ease: "linear",
                        delay: Math.random() * 2
                    }}
                    style={{
                        position: 'absolute',
                        width: '2px',
                        height: '15px',
                        backgroundColor: '#4faaff',
                        borderRadius: '1px'
                    }}
                />
            ))}
        </div>
    );
};

const GameOverOverlay: React.FC<GameOverOverlayProps> = ({ winner, onReturnToLobby, playerColor }) => {
    const { t } = useTranslation();
    const isWin = winner === playerColor;
    const isDraw = winner === 'draw';

    return (
        <AnimatePresence>
            {winner && (
                <>
                    {isWin ? <Confetti /> : (isDraw ? null : <Raincloud />)}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: 'rgba(0, 0, 0, 0.4)',
                            zIndex: 2100,
                            borderRadius: '4px',
                            backdropFilter: 'blur(2px)'
                        }}
                    >
                        <motion.h2
                            initial={{ scale: 0.5, y: -20 }}
                            animate={{ scale: 1, y: 0 }}
                            style={{
                                color: 'white',
                                fontSize: '3rem',
                                fontWeight: '900',
                                margin: '0 0 1.5rem 0',
                                textShadow: '0 4px 10px rgba(0,0,0,0.5)',
                                letterSpacing: '2px'
                            }}
                        >
                            {isWin ? t('chess.game.you_win') || 'YOU WIN!' : (isDraw ? t('chess.game.stalemate') || 'STALEMATE' : t('chess.game.you_lose') || 'YOU LOSE')}
                        </motion.h2>
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={onReturnToLobby}
                            style={{
                                padding: '1rem 2rem',
                                fontSize: '1.2rem',
                                fontWeight: 'bold',
                                backgroundColor: isWin ? '#4caf50' : (isDraw ? '#607d8b' : '#f44336'),
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                                transition: 'background-color 0.2s'
                            }}
                        >
                            {t('chess.game.return_to_lobby')}
                        </motion.button>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default GameOverOverlay;
