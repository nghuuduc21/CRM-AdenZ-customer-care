import express, { type Express } from 'express';
import type { Pool } from 'pg';
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { promisify } from 'node:util';
import { createAuthRouter, createUsersRouter, requireCareUser } from './modules/auth/auth.routes.js';
import { loadApplicationKey } from './shared/security/key-store.js';
import { createCustomerRouter } from './modules/customers/customer.routes.js';
import { createDashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { createCareTaskRouter } from './modules/care-tasks/care-task.routes.js';
import { createSettingsRouter } from './modules/settings/settings.routes.js';
import { createCatalogRouter } from './modules/catalog/catalog.routes.js';
import { createJourneyRouter } from './modules/journeys/journey.routes.js';
import { createCampaignRouter } from './modules/campaigns/campaign.routes.js';
import { createScoringRouter } from './modules/scoring/scoring.routes.js';

const runFile = promisify(execFile);

export async function createApp(database: Pool): Promise<Express> {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use(express.static(resolve(process.cwd(), 'public')));

  const careDataDirectory = resolve(process.cwd(), process.env.CARE_DATA_DIR || 'data/care');
  const applicationKey = await loadApplicationKey(careDataDirectory, process.env.CARE_SECRET_KEY);
  const { router: authRouter, auth } = createAuthRouter(
    database,
    applicationKey,
    process.env.CARE_COOKIE_SECURE === 'true',
  );
  app.use('/api', authRouter);
  app.use('/api', requireCareUser(auth));
  app.use('/api', createUsersRouter(database,auth));
  app.use('/api', createSettingsRouter(database,applicationKey));
  app.use('/api', createDashboardRouter(database));
  app.use('/api', createCustomerRouter(database));
  app.use('/api', createCareTaskRouter(database));
  app.use('/api', createCatalogRouter(database));
  app.use('/api', createJourneyRouter(database));
  app.use('/api', createCampaignRouter(database));
  app.use('/api', createScoringRouter(database));

  app.post('/api/sync', async (request, response) => {
    const user = response.locals.user;
    if (!user || !['admin', 'boss', 'marketing'].includes(user.role)) {
      response.status(403).json({ error: 'Vai trò hiện tại không được nạp lại dữ liệu demo.' });
      return;
    }
    try {
      const xlsxPath = resolve(process.cwd(), 'data/source/customers.xlsx');
      if (!existsSync(xlsxPath)) {
        response.status(500).json({ error: 'Không tìm thấy data/source/customers.xlsx để nạp lại dữ liệu demo.' });
        return;
      }
      const compiledImportScript = resolve(process.cwd(), 'dist/scripts/import-customers.js');
      const importScript = existsSync(compiledImportScript)
        ? compiledImportScript
        : resolve(process.cwd(), 'src/scripts/import-customers.ts');
      const commandArgs = importScript.endsWith('.ts')
        ? [resolve(process.cwd(), 'node_modules/tsx/dist/cli.mjs'), importScript, xlsxPath]
        : [importScript, xlsxPath];
      const result = await runFile(process.execPath, commandArgs, {
        cwd: process.cwd(),
        maxBuffer: 10 * 1024 * 1024,
      });
      const output = result.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
      const counts = output ? JSON.parse(output) : {};
      response.json({ ...counts, counts, importedFromXlsx: true, note: 'Đã import dữ liệu thật từ data/source/customers.xlsx.' });
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Lỗi không xác định.';
      response.status(500).json({ error: `Không thể import customers.xlsx: ${detail}` });
    }
  });

  app.get('/health', async (_request, response) => {
    try {
      await database.query('SELECT 1');
      response.json({ status: 'ok', database: 'connected' });
    } catch {
      response.status(503).json({ status: 'error', database: 'unavailable' });
    }
  });

  const demoQueries: Record<string, string> = {
    customers: 'SELECT customer_id, code, name, sub_group, customer_type, customer_status, member_tier, source_name, sale_name, demo_scenario FROM customers WHERE is_demo=true ORDER BY customer_id',
    products: 'SELECT id, name, product_type, destination, duration, price, active FROM products WHERE is_demo=true ORDER BY id',
    orders: 'SELECT id, code, customer_id, status_title, payment_state, order_at, departure, return_date, total_amount, paid_amount, remaining_amount, trip_name, destination, sale_name FROM orders WHERE is_demo=true ORDER BY order_at DESC',
    receipts: 'SELECT id, code, transaction_type, total_amount_source, payment_date, approve_status, payment_method, order_id, customer_id FROM receipts WHERE is_demo=true ORDER BY payment_date DESC NULLS LAST',
    order_services: 'SELECT id, order_id, service_type, item_name, description, departure, return_date FROM order_services WHERE is_demo=true ORDER BY order_id',
    leads: 'SELECT id, code, customer_id, status_title, source_name, service, quote_status, created_at, sale_name, demo_scenario FROM leads WHERE is_demo=true ORDER BY created_at DESC',
    activities: 'SELECT id, customer_id, order_id, activity_type, title, created_at, remind_at, status, sale_name FROM activities WHERE is_demo=true ORDER BY created_at DESC',
    passengers: 'SELECT id, order_id, customer_id, name, nationality, is_leader FROM passengers WHERE is_demo=true ORDER BY order_id, id',
    tasks: 'SELECT id, customer_id, order_id, lead_id, task_kind, priority, title, detail, due_at, status, created_at, completed_at FROM care_tasks WHERE is_demo=true ORDER BY due_at',
    surveys: 'SELECT id, customer_id, order_id, score, comment, sent_at, answered_at FROM surveys WHERE is_demo=true ORDER BY sent_at DESC',
    campaigns: 'SELECT id, name, goal, status, subject, created_at, scheduled_at, sent_at FROM campaigns WHERE is_demo=true ORDER BY id',
    messages: 'SELECT id, campaign_id, customer_id, journey, subject, to_addr, marketing, status, created_at, sent_at, opened_at, clicked_at FROM messages WHERE is_demo=true ORDER BY created_at DESC',
    insights: `SELECT i.customer_id,c.code,c.name,i.customer_kind,i.r_score,i.f_score,i.m_score,i.potential_score,
      i.potential_tier,i.segment_code,i.score_reasons,i.predicted_purchase,i.predicted_purchase_score,
      i.suggested_destination,i.preferred_travel_month,i.churn_risk,i.prediction_method
      FROM customer_insights i JOIN customers c ON c.customer_id=i.customer_id
      WHERE i.is_demo=true ORDER BY i.segment_code,c.code`,
  };

  app.get('/api/demo/summary', async (_request, response) => {
    try {
      const counts = await Promise.all(Object.entries(demoQueries).map(async ([resource, sql]) => {
        const table = resource === 'tasks' ? 'care_tasks' : resource === 'insights' ? 'customer_insights' : resource;
        const result = await database.query<{ count: string }>(`SELECT count(*)::text AS count FROM ${table} WHERE is_demo=true`);
        return [resource, Number(result.rows[0]?.count ?? 0)] as const;
      }));
      const insightCounts = await database.query(`
        SELECT count(*) FILTER (WHERE customer_kind='buyer')::int AS purchased_customers,
          count(*) FILTER (WHERE customer_kind='prospect')::int AS interacted_customers,
          count(*) FILTER (WHERE predicted_purchase='high')::int AS high_purchase_probability,
          count(*) FILTER (WHERE potential_tier='hot')::int AS hot_prospects,
          count(*) FILTER (WHERE churn_risk='high')::int AS high_churn_risk
        FROM customer_insights WHERE is_demo=true
      `);
      const preferenceCount = await database.query<{ count: number }>(
        'SELECT count(*)::int AS count FROM customer_contact_preferences WHERE is_demo=true AND email_marketing_allowed=false',
      );
      const openTasks = await database.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM care_tasks WHERE is_demo=true AND status='open'",
      );
      response.json({ data: {
        ...Object.fromEntries(counts),
        ...insightCounts.rows[0],
        unsubscribed_customers: preferenceCount.rows[0]?.count ?? 0,
        open_tasks: openTasks.rows[0]?.count ?? 0,
      } });
    } catch {
      response.status(500).json({ error: 'Không thể đọc thống kê dữ liệu. Hãy chạy migrations và import customers.xlsx.' });
    }
  });

  app.get('/api/demo/customers/:id', async (request, response) => {
    const customerId = Number(request.params.id);
    if (!Number.isSafeInteger(customerId) || customerId <= 0) {
      response.status(400).json({ error: 'Mã khách hàng không hợp lệ.' });
      return;
    }
    try {
      const customer = await database.query(
        'SELECT * FROM customers WHERE customer_id=$1 AND is_demo=true', [customerId],
      );
      if (!customer.rowCount) {
        response.status(404).json({ error: 'Không tìm thấy khách hàng demo.' });
        return;
      }
      const [insight, preferences, orders, leads, activities, tasks, passengers] = await Promise.all([
        database.query('SELECT * FROM customer_insights WHERE customer_id=$1 AND is_demo=true', [customerId]),
        database.query('SELECT * FROM customer_contact_preferences WHERE customer_id=$1 AND is_demo=true', [customerId]),
        database.query('SELECT id,code,status_title,order_at,departure,return_date,total_amount,paid_amount,trip_name,destination FROM orders WHERE customer_id=$1 AND is_demo=true ORDER BY order_at DESC', [customerId]),
        database.query('SELECT id,code,status_title,source_name,service,quote_status,created_at FROM leads WHERE customer_id=$1 AND is_demo=true ORDER BY created_at DESC', [customerId]),
        database.query('SELECT id,activity_type,title,created_at,remind_at,status FROM activities WHERE customer_id=$1 AND is_demo=true ORDER BY created_at DESC LIMIT 12', [customerId]),
        database.query('SELECT id,task_kind,priority,title,detail,due_at,status FROM care_tasks WHERE customer_id=$1 AND is_demo=true ORDER BY due_at', [customerId]),
        database.query('SELECT p.id,p.order_id,p.name,p.nationality,p.is_leader FROM passengers p WHERE p.customer_id=$1 AND p.is_demo=true ORDER BY p.id', [customerId]),
      ]);
      response.json({ data: {
        customer: customer.rows[0], insight: insight.rows[0] ?? null,
        contact_preferences: preferences.rows[0] ?? null, orders: orders.rows,
        leads: leads.rows, activities: activities.rows, tasks: tasks.rows, passengers: passengers.rows,
      } });
    } catch {
      response.status(500).json({ error: 'Không thể đọc hồ sơ khách hàng demo.' });
    }
  });

  app.patch('/api/demo/tasks/:id/complete', async (request, response) => {
    const taskId = Number(request.params.id);
    if (!Number.isSafeInteger(taskId) || taskId <= 0) {
      response.status(400).json({ error: 'Mã công việc không hợp lệ.' });
      return;
    }
    try {
      const result = await database.query(
        `UPDATE care_tasks SET status='done',completed_at=now()
         WHERE id=$1 AND is_demo=true AND status='open'
         RETURNING id,status,completed_at`, [taskId],
      );
      if (!result.rowCount) {
        response.status(409).json({ error: 'Công việc không tồn tại trong dữ liệu demo hoặc đã được xử lý.' });
        return;
      }
      response.json({ data: result.rows[0] });
    } catch {
      response.status(500).json({ error: 'Không thể cập nhật trạng thái công việc demo.' });
    }
  });

  app.get('/api/demo/:resource', async (request, response) => {
    const sql = demoQueries[request.params.resource];
    if (!sql) {
      response.status(404).json({ error: 'Không tìm thấy nhóm dữ liệu demo.' });
      return;
    }
    try {
      const result = await database.query(sql);
      response.json({ data: result.rows, total: result.rowCount });
    } catch {
      response.status(500).json({ error: 'Không thể đọc dữ liệu. Hãy chạy migrations và import customers.xlsx.' });
    }
  });

  return app;
}
