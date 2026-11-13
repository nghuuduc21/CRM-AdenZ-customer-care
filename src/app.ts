import express, { type Express } from 'express';
import type { Pool } from 'pg';
import { createRecordsRouter } from './routes/records.js';

export function createApp(pool: Pool): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.get('/', (_request, response) => {
    response.type('html').send(`<!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Team Project Starter</title>
          <style>
            body{font:16px/1.6 system-ui,sans-serif;max-width:760px;margin:48px auto;padding:0 20px;color:#172033}
            code{background:#f1f4f8;padding:3px 6px;border-radius:4px}li{margin:10px 0}
          </style>
        </head>
        <body>
          <h1>Team Project Starter</h1>
          <p>The development server is running. Start shaping this project to fit your team's idea.</p>
          <h2>Available endpoints</h2>
          <ul>
            <li><a href="/health"><code>GET /health</code></a> — check the PostgreSQL connection.</li>
            <li><a href="/api/records"><code>GET /api/records</code></a> — list sample records.</li>
            <li><code>POST /api/records</code> — create a record with JSON <code>{"title":"...","description":"..."}</code>.</li>
            <li><code>PATCH /api/records/:id</code> — change status to <code>open</code>, <code>in_progress</code>, or <code>done</code>.</li>
            <li><code>DELETE /api/records/:id</code> — remove a record.</li>
          </ul>
          <p>This is a small API landing page. Your team can replace it with any interface or design.</p>
        </body>
      </html>`);
  });

  app.get('/health', async (_request, response) => {
    try {
      await pool.query('SELECT 1');
      response.json({ status: 'ok', database: 'connected' });
    } catch {
      response.status(503).json({ status: 'error', database: 'unavailable' });
    }
  });

  app.use('/api/records', createRecordsRouter(pool));
  return app;
}
