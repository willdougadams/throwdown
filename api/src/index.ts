import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import lobbyRoutes from './routes/lobby';
import banyanRoutes from './routes/banyan';
import gameRoutes from './routes/game';
import { subscriptionManager } from './services/subscriptionManager';

dotenv.config();

export const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const router = express.Router();

router.use('/lobby', lobbyRoutes);
router.use('/banyan', banyanRoutes);
router.use('/game', gameRoutes);

router.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.use('/api', router);
app.use('/', router);

if (require.main === module) {
    app.listen(port, () => {
        console.log(`Trustful API listening at http://localhost:${port}`);
        subscriptionManager.startListening();
    });
}

export default app;
