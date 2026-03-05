import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import lobbyRoutes from './routes/lobby';
import banyanRoutes from './routes/banyan';
import gameRoutes from './routes/game';



dotenv.config();

export const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/lobby', lobbyRoutes);
app.use('/banyan', banyanRoutes);
app.use('/game', gameRoutes);

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

if (require.main === module) {
    app.listen(port, () => {
        console.log(`Trustful API listening at http://localhost:${port}`);
    });
}
