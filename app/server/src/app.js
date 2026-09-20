import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { q } from './db.js';
import { requireAuth, requireAdmin } from './auth.js';
import { errorHandler } from './http.js';
import authRoutes from './routes/auth.js';
import metaRoutes from './routes/meta.js';
import timesheetRoutes from './routes/timesheets.js';
import summaryRoutes from './routes/summary.js';
import adminRoutes from './routes/admin.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', config.trustProxy);
  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  // CSRF defence in depth on top of SameSite=strict: state changes must be JSON
  app.use('/api', (req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !req.is('application/json'))
      return res.status(415).json({ error: 'JSON required' });
    next();
  });

  app.get('/healthz', async (req, res) => {
    try { await q('SELECT 1'); res.json({ ok: true }); } catch { res.status(503).json({ ok: false }); }
  });

  app.use('/api/auth', authRoutes);
  app.use('/api', requireAuth, metaRoutes, timesheetRoutes, summaryRoutes);
  app.use('/api', requireAuth, requireAdmin, adminRoutes);
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  // Serve the built client in production
  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.use((req, res) => res.sendFile(path.join(dist, 'index.html')));
  }
  app.use(errorHandler);
  return app;
}
