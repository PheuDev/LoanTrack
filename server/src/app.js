import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import authRoutes        from './routes/auth.js';
import clientsRoutes     from './routes/clients.js';
import loansRoutes       from './routes/loans.js';
import repaymentsRoutes  from './routes/repayments.js';
import penaltiesRoutes   from './routes/penalties.js';
import dashboardRoutes   from './routes/dashboard.js';
import transactionsRoutes from './routes/transactions.js';
import rulesRoutes       from './routes/rules.js';
import settingsRoutes    from './routes/settings.js';
import fxRoutes          from './routes/fx.js';
import { errorHandler }  from './middlewares/errorHandler.js';

const app = express();
const clientDistPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');

app.use(express.json());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth',          authRoutes);
app.use('/clients',       clientsRoutes);
app.use('/loans',         loansRoutes);
app.use('/loans/:id/repayments', repaymentsRoutes);
app.use('/loans/:id/penalties',  penaltiesRoutes);
app.use('/dashboard',     dashboardRoutes);
app.use('/transactions',  transactionsRoutes);
app.use('/rules',         rulesRoutes);
app.use('/settings',      settingsRoutes);
app.use('/fx',            fxRoutes);

app.use(express.static(clientDistPath));
app.get('*', (req, res, next) => {
  if (req.method === 'GET' && req.headers.accept?.includes('text/html')) {
    return res.sendFile(path.join(clientDistPath, 'index.html'));
  }
  next();
});

app.use((req, res) => {
  res.status(404).json({
    error: { message: 'Ressource introuvable.', code: 'NOT_FOUND' },
  });
});

app.use(errorHandler);

export default app;