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

// Sliding window rate limiter with automatic stale key eviction
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// Periodic cleanup every 5 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

function createRateLimiter(maxRequests: number, windowMs: number, message: string) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : null) || req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${req.baseUrl || ''}${req.path}:${ip}`;
    const now = Date.now();
    const entry = rateLimitMap.get(key);

    if (!entry || now > entry.resetAt) {
      rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (entry.count >= maxRequests) {
      const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      res.status(429).json({ error: message, retryAfterSeconds });
      return;
    }

    entry.count += 1;
    next();
  };
}

export function createExpressApp() {
  const app = express();

  // Trust proxy for secure headers and client IP extraction behind load balancers
  app.set('trust proxy', 1);

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Strict CORS headers with allowlist enforcement
  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim().toLowerCase()).filter(Boolean)
    : [];

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const host = req.headers.host;

    let isAllowed = false;

    if (!origin) {
      // Same-origin, direct server-to-server, curl, or mobile app
      isAllowed = true;
    } else {
      const lowerOrigin = origin.toLowerCase();

      // 1. Check explicitly configured origins in ALLOWED_ORIGINS
      if (allowedOriginsEnv.includes(lowerOrigin) || allowedOriginsEnv.includes('*')) {
        isAllowed = true;
      }

      // 2. Allow matching current Host header (same domain / port)
      if (host) {
        if (
          lowerOrigin === `http://${host.toLowerCase()}` ||
          lowerOrigin === `https://${host.toLowerCase()}`
        ) {
          isAllowed = true;
        }
      }

      // 3. Allow standard local development origins
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:[0-9]+)?$/.test(lowerOrigin)) {
        isAllowed = true;
      }

      // 4. Allow Google Cloud Run preview and production app domains (*.run.app)
      if (/^https:\/\/[a-z0-9\-_.]+\.run\.app$/.test(lowerOrigin)) {
        isAllowed = true;
      }

      // 5. Allow Vercel preview and production app domains (*.vercel.app)
      if (/^https:\/\/[a-z0-9\-_.]+\.vercel\.app$/.test(lowerOrigin)) {
        isAllowed = true;
      }
    }

    if (origin) {
      if (isAllowed) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Vary', 'Origin');
      } else {
        if (req.method === 'OPTIONS') {
          return res.status(403).json({ error: 'CORS forbidden: origin not authorized' });
        }
      }
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    next();
  });

  // Rate-limited Auth endpoints
  const loginLimiter = createRateLimiter(15, 5 * 60 * 1000, 'Too many login attempts. Please wait 5 minutes before trying again.');
  const forgotPasswordLimiter = createRateLimiter(5, 15 * 60 * 1000, 'Too many password reset requests. Please wait 15 minutes.');

  app.use('/api/auth/login', loginLimiter);
  app.use('/api/auth/forgot-password', forgotPasswordLimiter);

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
      console.log(`[SERVER] Ship Asaan server is actively listening on http://0.0.0.0:${port}`);
    });

    return server;
  } catch (err) {
    console.error('[SERVER] Fatal failure starting Ship Asaan server:', err);
    process.exit(1);
  }
}
