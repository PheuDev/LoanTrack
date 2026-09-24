import express from 'express';
import cors from 'cors';
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

app.use(express.json());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));

// Route de santé
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/auth',         authRoutes);
app.use('/clients',      clientsRoutes);
app.use('/loans',        loansRoutes);
// Remboursements et pénalités sont des sous-ressources des prêts
app.use('/loans/:id/repayments', repaymentsRoutes);
app.use('/loans/:id/penalties',  penaltiesRoutes);
app.use('/dashboard',    dashboardRoutes);
app.use('/transactions', transactionsRoutes);
app.use('/rules',        rulesRoutes);
app.use('/settings',     settingsRoutes);
app.use('/fx',           fxRoutes);

// ─── 404 JSON pour les routes inconnues ───────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    error: { message: 'Ressource introuvable.', code: 'NOT_FOUND' },
  });
});

// ─── Gestion d'erreurs (doit être en dernier) ─────────────────────────────────
app.use(errorHandler);

export default app;
