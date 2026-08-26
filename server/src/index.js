import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tools } from './routes/tools.js';
import { loans } from './routes/loans.js';
import { stats } from './routes/stats.js';
import { auth } from './routes/auth.js';
import { errorHandler } from './lib/errors.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(cors({
    origin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()),
    credentials: true,
  }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(compression());          // JSON responses gzip to roughly a fifth
  app.disable('x-powered-by');     // stop advertising the framework and version

  // Security headers, hand-rolled rather than pulling in helmet for five lines.
  app.use((_req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Cross-Origin-Resource-Policy': 'same-site',
    });
    next();
  });

  // Development-only latency, so skeletons and spinners are visible while
  // building them rather than flashing past on localhost.
  if (process.env.SLOW_MODE === '1') app.use((_q, _s, next) => setTimeout(next, 900));

  app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'toolshed-state-api' }));
  app.use('/api/auth', auth);
  app.use('/api/tools', tools);
  app.use('/api/loans', loans);
  app.use('/api/stats', stats);

  app.use((_req, res) => res.status(404).json({ error: { message: 'No such endpoint.' } }));
  app.use(errorHandler);
  return app;
}

const isEntrypoint = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isEntrypoint) {
  const port = Number(process.env.PORT || 4000);
  const server = createApp().listen(port, () => console.log(`toolshed-api on :${port}`));

  /**
   * Platforms send SIGTERM and then kill the process a few seconds later.
   * Without this, every deploy drops whatever requests were in flight and the
   * SQLite WAL is left un-checkpointed.
   */
  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, () => {
      console.log(`${signal} received — finishing in-flight requests`);
      server.close(async () => {
        const { db } = await import('./db.js');
        db.pragma('wal_checkpoint(TRUNCATE)');
        db.close();
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 10_000).unref();
    });
  }
}
