/**
 * Ship Asaan Full-Stack Express & Vite Application
 */

import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { bootstrapSystem } from './bootstrap.js';
import { authRouter } from './routes.js';
import { customerRouter } from './customerRoutes.js';
import { employeeRouter } from './employeeRoutes.js';
import { roleRouter } from './roleRoutes.js';
import { walletRouter } from './walletRoutes.js';
import { warehouseRouter } from './warehouseRoutes.js';
import { inventoryRouter } from './inventoryRoutes.js';
import { orderRouter } from './orderRoutes.js';
import { fulfillmentRouter } from './fulfillmentRoutes.js';
import { dispatchRouter } from './dispatchRoutes.js';

import { initDatabase } from './db.js';

dotenv.config();

export function createExpressApp() {
  const app = express();

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // CORS headers
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    next();
  });

  // Trust proxy for secure headers
  app.set('trust proxy', 1);

  // Mount API routes
  app.use('/api/auth', authRouter);
  app.use('/api/customers', customerRouter);
  app.use('/api/employees', employeeRouter);
  app.use('/api/roles', roleRouter);
  app.use('/api/wallet', walletRouter);
  app.use('/api/warehouses', warehouseRouter);
  app.use('/api/inventory', inventoryRouter);
  app.use('/api/orders', orderRouter);
  app.use('/api/fulfillment', fulfillmentRouter);
  app.use('/api/dispatch', dispatchRouter);
  app.use('/api', authRouter);

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({
      status: 'healthy',
      system: 'Ship Asaan Courier + Fulfillment',
      timestamp: new Date().toISOString()
    });
  });

  return app;
}

export async function startServer() {
  const app = createExpressApp();
  const port = parseInt(process.env.PORT || '3000', 10);

  try {
    // 0. Initialize database (loads cloud snapshot from Supabase if configured)
    await initDatabase();

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

    const server = app.listen(port, '0.0.0.0', () => {
      console.log(`[SHIP ASAAN] Server listening on port ${port} (mode: ${isProd ? 'production' : 'development'})`);
    });

    return server;
  } catch (error) {
    console.error('[SHIP ASAAN] Fatal startup error:', error);
    process.exit(1);
  }
}
