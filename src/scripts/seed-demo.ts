import 'dotenv/config';
import { pool } from '../db/pool.js';
import { seedDemo } from './demo-seed.service.js';

try {
  const counts = await seedDemo();
  console.log('Demo dataset refreshed (synthetic records only):');
  for (const [table, count] of Object.entries(counts)) console.log(`  ${table}: ${count}`);
} catch (error) {
  console.error('Demo seeding failed. Check that all migrations were applied.');
  console.error(error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
} finally {
  await pool.end();
}
