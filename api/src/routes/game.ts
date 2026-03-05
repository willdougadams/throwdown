import express from 'express';
import { connection, Deserializer, withCache } from '../services/solana';


import { PublicKey } from '@solana/web3.js';

const router = express.Router();

router.get('/:type/:address', async (req, res) => {
    const { type, address } = req.params;
    if (type !== 'rps' && type !== 'chess') {
        return res.status(400).json({ error: 'Invalid game type' });
    }

    try {
        const game = await withCache(`game_${type}_${address}`, 5, async () => {
            const pubkey = new PublicKey(address);
            const info = await connection.getAccountInfo(pubkey);
            if (!info) throw new Error('Game not found');

            if (type === 'chess') {
                return Deserializer.deserializeChessGame(info.data, address);
            } else {
                return Deserializer.deserializeRPSGame(info.data, address);
            }
        });
        res.json(game);
    } catch (error: any) {
        res.status(error.message === 'Game not found' ? 404 : 500).json({ error: error.message });
    }
});

export default router;
