import 'dotenv/config';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './db/pool.js';

try {
  await pool.query('SELECT 1');
} catch {
  console.error('Cannot connect to PostgreSQL. Check Docker and the local .env settings.');
  process.exit(1);
}

const app = await createApp(pool);
const server = app.listen(env.port, env.host, () => {
  console.log(`Customer Care Demo: http://${env.host}:${env.port}`);
  console.log(`Health: http://${env.host}:${env.port}/health`);
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}; closing server.`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
