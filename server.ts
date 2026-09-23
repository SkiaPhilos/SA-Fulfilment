/**
 * Ship Asaan Full-Stack Server Entry Point
 * Supports both direct `node server.ts` and `tsx server.ts`.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';

const isTsxActive = Boolean(
  process.env.__TSX_ACTIVE ||
  process.execArgv.some(arg => arg.includes('tsx')) ||
  process.env.npm_lifecycle_script?.includes('tsx') ||
  (process as any)[Symbol.for('tsx.version')]
);

if (!isTsxActive) {
  // Spawn with tsx loader for complete TypeScript execution under Node
  const child = spawn(
    process.execPath,
    ['--import', 'tsx', path.resolve(process.cwd(), 'server.ts'), ...process.argv.slice(2)],
    {
      stdio: 'inherit',
      env: { ...process.env, __TSX_ACTIVE: '1' }
    }
  );

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
    }
    process.exit(code ?? 0);
  });
} else {
  const { startServer } = await import('./server/serverApp.js');
  await startServer();
}
