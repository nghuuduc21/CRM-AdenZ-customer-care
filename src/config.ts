import 'dotenv/config';

function positiveInteger(name: string, fallback: number): number {
  const value = Number(process.env[name] || fallback);
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`);
  return value;
}

const password = process.env.POSTGRES_PASSWORD;
if (!password) throw new Error('POSTGRES_PASSWORD is missing; copy .env.example to .env');

export const config = {
  host: process.env.HOST || '127.0.0.1',
  port: positiveInteger('PORT', 3000),
  database: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: positiveInteger('DB_PORT', 5432),
    database: process.env.POSTGRES_DB || 'team_project',
    user: process.env.POSTGRES_USER || 'team_project',
    password,
    max: positiveInteger('DB_POOL_MAX', 10),
    connectionTimeoutMillis: 5_000,
  },
};
