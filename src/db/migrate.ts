import 'dotenv/config';
import { pool } from './pool.js';
import { runMigrations } from './migrations.js';

try {
  await runMigrations(pool);
} catch (error) {
  const cause = error instanceof Error ? error.cause : undefined;
  const pgError = cause && typeof cause === 'object'
    ? cause as { code?: string; detail?: string }
    : error && typeof error === 'object' ? error as { code?: string; detail?: string } : undefined;
  console.error(error instanceof Error ? error.message : 'Migration failed.');
  if (pgError?.code) console.error(`PostgreSQL code: ${pgError.code}`);
  if (pgError?.detail) console.error(`PostgreSQL detail: ${pgError.detail}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
