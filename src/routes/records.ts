import { Router } from 'express';
import type { Pool } from 'pg';

export function createRecordsRouter(pool: Pool) {
  const router = Router();

  router.get('/', async (_request, response) => {
    try {
      const result = await pool.query('SELECT id,title,description,status,created_at FROM records ORDER BY id DESC LIMIT 200');
      response.json(result.rows);
    } catch {
      response.status(500).json({ error: 'Could not load records.' });
    }
  });

  router.post('/', async (request, response) => {
    const title = typeof request.body?.title === 'string' ? request.body.title.trim().slice(0, 160) : '';
    const description = typeof request.body?.description === 'string' ? request.body.description.trim().slice(0, 2000) : '';
    if (!title) {
      response.status(400).json({ error: 'A title is required.' });
      return;
    }
    try {
      const result = await pool.query(
        `INSERT INTO records(title,description) VALUES($1,$2)
         RETURNING id,title,description,status,created_at`,
        [title, description || null],
      );
      response.status(201).json(result.rows[0]);
    } catch {
      response.status(500).json({ error: 'Could not create the record.' });
    }
  });

  router.patch('/:id', async (request, response) => {
    const id = Number(request.params.id);
    if (!Number.isSafeInteger(id) || id < 1) {
      response.status(400).json({ error: 'Invalid record id.' });
      return;
    }
    const status = request.body?.status;
    if (!['open', 'in_progress', 'done'].includes(status)) {
      response.status(400).json({ error: 'Status must be open, in_progress, or done.' });
      return;
    }
    try {
      const result = await pool.query(
        `UPDATE records SET status=$2 WHERE id=$1
         RETURNING id,title,description,status,created_at`,
        [id, status],
      );
      if (!result.rowCount) {
        response.status(404).json({ error: 'Record not found.' });
        return;
      }
      response.json(result.rows[0]);
    } catch {
      response.status(500).json({ error: 'Could not update the record.' });
    }
  });

  router.delete('/:id', async (request, response) => {
    const id = Number(request.params.id);
    if (!Number.isSafeInteger(id) || id < 1) {
      response.status(400).json({ error: 'Invalid record id.' });
      return;
    }
    try {
      const result = await pool.query('DELETE FROM records WHERE id=$1 RETURNING id', [id]);
      if (!result.rowCount) {
        response.status(404).json({ error: 'Record not found.' });
        return;
      }
      response.status(204).end();
    } catch {
      response.status(500).json({ error: 'Could not delete the record.' });
    }
  });

  return router;
}
