import { Pool } from 'pg';
import { config } from '../config.js';

export const pool = new Pool(config.database);
pool.on('error', () => console.error('Unexpected PostgreSQL pool error'));
