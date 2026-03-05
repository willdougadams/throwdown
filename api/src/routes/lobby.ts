import express from 'express';
import { connection, programIds, Deserializer, withCache } from '../services/solana';



const router = express.Router();

router.get('/:type', async (req, res) => {
    const { type } = req.params;
    if (type !== 'rps' && type !== 'chess') {
        return res.status(400).json({ error: 'Invalid game type, use "rps" or "chess"' });
    }

    try {
        const games = await withCache(`lobby_${type}`, 10, async () => {
            const programId = programIds[type as keyof typeof programIds];
            const dataSize = type === 'chess' ? 272 : 528;

            const accounts = await connection.getProgramAccounts(programId, {
                commitment: 'confirmed',
                filters: [{ dataSize }]
            });

            return accounts.map(({ pubkey, account }) => {
                try {
                    if (type === 'chess') {
                        return Deserializer.deserializeChessGame(account.data, pubkey.toString());
                    } else {
                        return Deserializer.deserializeRPSGame(account.data, pubkey.toString());
                    }
                } catch (e) {
                    return null;
                }
            }).filter(g => g !== null);
        });

        res.json(games);
    } catch (error) {
        console.error(`Error fetching ${type} lobby:`, error);
        res.status(500).json({ error: 'Failed to fetch lobby' });
    }
});

export default router;
