/**
 * Ship Asaan Full-Stack Server Entry Point
 * Mounts Express API routes and integrates Vite dev middleware or static dist.
 */

import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { bootstrapSystem } from './server/bootstrap.js';
import { authRouter } from './server/routes.js';
import { customerRouter } from './server/customerRoutes.js';
import { employeeRouter } from './server/employeeRoutes.js';
import { roleRouter } from './server/roleRoutes.js';
import { walletRouter } from './server/walletRoutes.js';
import { warehouseRouter } from './server/warehouseRoutes.js';

dotenv.config();

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Trust proxy for secure headers
app.set('trust proxy', 1);

// Mount API routes
app.use('/api/auth', authRouter);
app.use('/api/customers', customerRouter);
app.use('/api/employees', employeeRouter);
app.use('/api/roles', roleRouter);
app.use('/api/wallet', walletRouter);
app.use('/api/warehouses', warehouseRouter);
app.use('/api', authRouter);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    system: 'Ship Asaan Courier + Fulfillment',
    timestamp: new Date().toISOString()
  });
});

async function startServer() {
  try {
    // 1. Run authoritative idempotent bootstrap
    console.log('[INIT] Bootstrapping Ship Asaan core services & admin accounts...');
    await bootstrapSystem();
    console.log('[INIT] Bootstrap completed.');

    // 2. Setup Vite dev middleware in development or serve static in production
    const isProd = process.env.NODE_ENV === 'production';
    if (!isProd) {
      const { createServer } = await import('vite');
      const vite = await createServer({
        server: {
          middlewareMode: true,
          hmr: process.env.DISABLE_HMR !== 'true',
          watch: process.env.DISABLE_HMR === 'true' ? null : {}
        },
        appType: 'spa'
      });
      app.use(vite.middlewares);
    } else {
      const distDir = path.resolve(process.cwd(), 'dist');
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }

    app.listen(port, '0.0.0.0', () => {
      console.log(`[SHIP ASAAN] Server listening on port ${port} (mode: ${isProd ? 'production' : 'development'})`);
    });
  } catch (error) {
    console.error('[SHIP ASAAN] Fatal startup error:', error);
    process.exit(1);
  }
}

startServer();
