import { Pool } from 'pg';
import { env } from '../config/env.js';

export const pool = new Pool(env.database);

// Report unexpected disconnects without printing connection settings.
pool.on('error', () => {
  console.error('Unexpected PostgreSQL pool error');
});
