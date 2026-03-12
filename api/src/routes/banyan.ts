import express from 'express';
import { connection, programIds, Deserializer, withCache } from '../services/solana';
import { subscriptionManager } from '../services/subscriptionManager';

import { PublicKey } from '@solana/web3.js';

const router = express.Router();

router.get('/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // flush the headers to establish SSE connection

    // Send an initial connected event
    res.write('data: {"type": "connected"}\n\n');

    // Add this client to the subscription manager
    subscriptionManager.addClient(res);

    req.on('close', () => {
        res.end();
    });
});

router.get('/manager', async (req, res) => {
    try {
        const manager = await withCache('banyan_manager', 60, async () => {
            const [managerPda] = PublicKey.findProgramAddressSync(
                [new TextEncoder().encode('manager_v2')],
                programIds.banyan
            );
            const info = await connection.getAccountInfo(managerPda);
            if (!info) throw new Error('Manager not found');
            return Deserializer.deserializeGameManager(info.data);
        });
        res.json(manager);
    } catch (error: any) {
        res.status(error.message === 'Manager not found' ? 404 : 500).json({ error: error.message });
    }
});

router.get('/tree/:epoch', async (req, res) => {
    try {
        const epoch = req.params.epoch;
        const tree = await withCache(`banyan_tree_${epoch}`, 10, async () => {
            const epochBigInt = BigInt(epoch);
            const epochBuffer = new Uint8Array(8);
            new DataView(epochBuffer.buffer).setBigUint64(0, epochBigInt, true);

            const [treePda] = PublicKey.findProgramAddressSync(
                [new TextEncoder().encode('tree'), epochBuffer],
                programIds.banyan
            );
            const info = await connection.getAccountInfo(treePda);
            if (!info) throw new Error('Tree not found');
            return {
                address: treePda.toString(),
                state: Deserializer.deserializeTree(info.data)
            };
        });
        res.json(tree);
    } catch (error: any) {
        res.status(error.message === 'Tree not found' ? 404 : 500).json({ error: error.message });
    }
});

router.get('/bud/:address', async (req, res) => {
    try {
        const addressStr = req.params.address;
        const bud = await withCache(`banyan_bud_${addressStr}`, 5, async () => {
            const address = new PublicKey(addressStr);
            const info = await connection.getAccountInfo(address);
            if (!info) throw new Error('Bud not found');
            return Deserializer.deserializeBud(info.data);
        });
        res.json(bud);
    } catch (error: any) {
        res.status(error.message === 'Bud not found' ? 404 : 500).json({ error: error.message });
    }
});

export default router;
