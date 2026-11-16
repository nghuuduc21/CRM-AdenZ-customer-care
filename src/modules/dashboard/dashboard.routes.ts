import { Router } from 'express';
import type { Pool } from 'pg';
import { createDashboardRepository } from './dashboard.repository.js';

export function createDashboardRouter(pool: Pool) {
  const router = Router();
  const repository = createDashboardRepository(pool);

  router.get('/status', async (_request, response) => {
    try { response.json(await repository.status(response.locals.user)); }
    catch { response.status(500).json({ error: 'Không thể tải trạng thái ứng dụng.' }); }
  });

  router.get('/dashboard', async (_request, response) => {
    try { response.json(await repository.dashboard()); }
    catch { response.status(500).json({ error: 'Không thể tải tổng quan khách hàng.' }); }
  });

  return router;
}
