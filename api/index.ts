/**
 * Vercel Serverless Function Handler
 * Mounts the Ship Asaan Express API routes on Vercel's serverless edge/lambda infrastructure.
 */

import type { Request, Response } from 'express';
import { createExpressApp } from '../server/serverApp.js';
import { initDatabase } from '../server/db.js';
import { bootstrapSystem } from '../server/bootstrap.js';

let appInstance: any = null;
let initPromise: Promise<void> | null = null;

async function getApp() {
  if (!initPromise) {
    initPromise = (async () => {
      try {
        await initDatabase();
        await bootstrapSystem();
        appInstance = createExpressApp();
      } catch (err) {
        console.error('[VERCEL API] Initialization error:', err);
        throw err;
      }
    })();
  }
  await initPromise;
  return appInstance;
}

export default async function handler(req: Request, res: Response) {
  try {
    const app = await getApp();
    return app(req, res);
  } catch (error: any) {
    console.error('[VERCEL API ERROR]', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error?.message || 'Server initialization failed'
    });
  }
}
