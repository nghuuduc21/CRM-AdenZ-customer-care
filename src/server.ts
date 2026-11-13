import 'dotenv/config';
import { createApp } from './app.js';
import { config } from './config.js';
import { pool } from './db/pool.js';

try {
  await pool.query('SELECT 1');
} catch {
  console.error('Cannot connect to PostgreSQL. Check Docker and .env.');
  process.exit(1);
}

const app = createApp(pool);
const server = app.listen(config.port, config.host, () => {
  console.log(`App: http://${config.host}:${config.port}`);
  console.log(`Health: http://${config.host}:${config.port}/health`);
});

let closing = false;
async function shutdown(signal: string) {
  if (closing) return;
  closing = true;
  console.log(`Received ${signal}; shutting down.`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
