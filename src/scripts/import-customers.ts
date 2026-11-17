import 'dotenv/config';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import { createScoringService } from '../modules/scoring/scoring.service.js';
import { createSettingsService } from '../modules/settings/settings.service.js';

// Minimal XLSX reader for the flat worksheets used by customers.xlsx.
type Cell = string | number | null;
type Row = Record<string, Cell>;

function xmlDecode(value: string): string {
  return value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

function columnNumber(ref: string): number {
  let n = 0;
  for (const c of ref.replace(/\d/g, '')) n = n * 26 + c.charCodeAt(0) - 64;
  return n - 1;
}

function excelDate(value: Cell, dateOnly = false): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'string' && /T|Z|[+-]\d\d:\d\d/.test(value)) return value;
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  const date = new Date(Date.UTC(1899, 11, 30) + n * 86400000);
  return dateOnly ? date.toISOString().slice(0, 10) : date.toISOString();
}

async function readEntry(path: string, entry: string): Promise<string> {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const run = promisify(execFile);
  const result = await run('tar', ['-xOf', path, entry], { maxBuffer: 50 * 1024 * 1024 });
  return result.stdout;
}

async function readSheet(path: string, sheet: number, shared: string[]): Promise<Row[]> {
  const xml = await readEntry(path, `xl/worksheets/sheet${sheet}.xml`);
  const rows: Row[] = [];
  const rowMatches = xml.match(/<row\b[^>]*>[\s\S]*?<\/row>/g) ?? [];
  let headers: string[] = [];
  for (const rowXml of rowMatches) {
    const values: Cell[] = [];
    for (const cell of rowXml.match(/<c\b[^>]*>[\s\S]*?<\/c>/g) ?? []) {
      const ref = /\br="([^"]+)"/.exec(cell)?.[1];
      if (!ref) continue;
      const index = columnNumber(ref);
      while (values.length < index) values.push(null);
      const type = /\bt="([^"]+)"/.exec(cell)?.[1];
      const raw = /<v>([\s\S]*?)<\/v>/.exec(cell)?.[1] ?? '';
      let value: Cell = raw === '' ? null : xmlDecode(raw);
      if (type === 's' && value !== null) value = shared[Number(value)] ?? value;
      else if (type !== 'str' && value !== null && /^-?\d+(\.\d+)?$/.test(value)) value = Number(value);
      values[index] = value;
    }
    if (!headers.length) { headers = values.map((v) => String(v ?? '').trim()); continue; }
    const row: Row = {};
    headers.forEach((header, i) => { if (header) row[header] = values[i] ?? null; });
    if (Object.values(row).some((v) => v !== null && v !== '')) rows.push(row);
  }
  return rows;
}

function bool(value: Cell): boolean { return value === 1 || value === '1' || value === 'true'; }
function num(value: Cell): number | null { const n = Number(value); return value == null || value === '' || !Number.isFinite(n) ? null : n; }
function text(value: Cell): string | null { return value == null || value === '' ? null : String(value); }
function json(value: unknown): string { return JSON.stringify(value ?? []); }

const xlsxPath = process.argv[2] ?? resolve(process.cwd(), 'data/source/customers.xlsx');
const sharedXml = await readEntry(xlsxPath, 'xl/sharedStrings.xml');
const shared = (sharedXml.match(/<si\b[\s\S]*?<\/si>/g) ?? []).map((si) => [...si.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => xmlDecode(m[1])).join(''));
const [customers, activities, leads, orders, passengers, products] = await Promise.all([1, 2, 3, 4, 5, 6].map((n) => readSheet(xlsxPath, n, shared)));

const pool = new Pool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.POSTGRES_DB, user: process.env.POSTGRES_USER, password: process.env.POSTGRES_PASSWORD });
const client = await pool.connect();
try {
  await client.query('BEGIN');
  const importedCustomers = await client.query<{ customer_id: number }>(
    "SELECT customer_id FROM customers WHERE demo_key LIKE 'xlsx-customer-%'",
  );
  const importedCustomerIds = importedCustomers.rows.map((row) => row.customer_id);
  if (importedCustomerIds.length) {
    for (const table of ['messages', 'surveys', 'care_tasks', 'passengers', 'activities', 'leads', 'order_services', 'orders']) {
      await client.query(`DELETE FROM ${table} WHERE demo_key LIKE 'xlsx-%'`);
    }
    await client.query('DELETE FROM customer_insights WHERE customer_id = ANY($1::bigint[])', [importedCustomerIds]);
    await client.query('DELETE FROM customer_contact_preferences WHERE customer_id = ANY($1::bigint[])', [importedCustomerIds]);
    await client.query("DELETE FROM products WHERE demo_key LIKE 'xlsx-%'");
    await client.query("DELETE FROM customers WHERE demo_key LIKE 'xlsx-customer-%'");
  }
  const customerMap = new Map<number, number>();
  for (const r of customers) {
    const sourceId = num(r.customer_id)!;
    const result = await client.query(`INSERT INTO customers (tourwell_id,code,name,email_primary,phone_primary,sub_group,source_name,sale_id,sale_name,customer_status,birthday,tourwell_created_at,is_demo,demo_key,demo_scenario,last_synced_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,false,$13,NULL,now())
      ON CONFLICT (demo_key) WHERE demo_key IS NOT NULL DO UPDATE SET tourwell_id=EXCLUDED.tourwell_id,code=EXCLUDED.code,name=EXCLUDED.name,email_primary=EXCLUDED.email_primary,phone_primary=EXCLUDED.phone_primary,sub_group=EXCLUDED.sub_group,source_name=EXCLUDED.source_name,sale_id=EXCLUDED.sale_id,sale_name=EXCLUDED.sale_name,customer_status=EXCLUDED.customer_status,birthday=EXCLUDED.birthday,tourwell_created_at=EXCLUDED.tourwell_created_at,last_synced_at=now()
      RETURNING customer_id`, [sourceId, text(r.code) ?? '', text(r.name) ?? '', text(r.email), text(r.phone), text(r.sub_group), text(r.source), num(r.sale_id), text(r.sale_name), text(r.tw_status), excelDate(r.birthday, true), excelDate(r.created_at), `xlsx-customer-${sourceId}`]);
    customerMap.set(sourceId, result.rows[0].customer_id);
  }
  const internalCustomer = (v: Cell) => customerMap.get(num(v)!) ?? null;
  for (const r of activities) await client.query(`INSERT INTO activities (tourwell_id,demo_key,customer_id,activity_type,title,created_at,remind_at,status,sale_id,sale_name,is_demo,at,kind) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,false,$6,$4) ON CONFLICT (demo_key) DO UPDATE SET customer_id=EXCLUDED.customer_id,title=EXCLUDED.title,created_at=EXCLUDED.created_at,remind_at=EXCLUDED.remind_at,status=EXCLUDED.status,is_demo=false`, [num(r.activity_id),`xlsx-activity-${num(r.activity_id)}`,internalCustomer(r.customer_id),text(r.kind) ?? 'activity',text(r.title) ?? '',excelDate(r.at),excelDate(r.remind_at),text(r.status),num(r.sale_id),text(r.title)]);
  for (const r of leads) await client.query(`INSERT INTO leads (tourwell_id,demo_key,code,customer_id,status_code,status_title,source_name,service,quote_status,created_at,updated_at,sale_id,sale_name,is_demo,demo_scenario) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,false,NULL) ON CONFLICT (demo_key) DO UPDATE SET customer_id=EXCLUDED.customer_id,status_code=EXCLUDED.status_code,status_title=EXCLUDED.status_title,updated_at=EXCLUDED.updated_at,is_demo=false`, [num(r.lead_id),`xlsx-lead-${num(r.lead_id)}`,text(r.code) ?? '',internalCustomer(r.customer_id),num(r.status_code),text(r.status_title) ?? '',text(r.source),text(r.service),text(r.quote_status),excelDate(r.created_at),excelDate(r.updated_at),num(r.sale_id),text(r.sale_name)]);
  const orderMap = new Map<number, number>();
  const orderCustomerMap = new Map<number, number | null>();
  for (const r of orders) { const sourceId=num(r.order_id)!; const result=await client.query(`INSERT INTO orders (tourwell_id,demo_key,code,customer_id,status_code,status_title,order_at,departure,return_date,total_amount,paid_amount,remaining_amount,trip_name,destination,sale_id,sale_name,source_name,is_b2b,is_demo,demo_scenario,total,paid,remaining,service_kinds) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,false,NULL,$10,$11,$12,$19::jsonb) ON CONFLICT (demo_key) DO UPDATE SET customer_id=EXCLUDED.customer_id,status_code=EXCLUDED.status_code,status_title=EXCLUDED.status_title,order_at=EXCLUDED.order_at,departure=EXCLUDED.departure,return_date=EXCLUDED.return_date,total_amount=EXCLUDED.total_amount,paid_amount=EXCLUDED.paid_amount,remaining_amount=EXCLUDED.remaining_amount,trip_name=EXCLUDED.trip_name,destination=EXCLUDED.destination,service_kinds=EXCLUDED.service_kinds,is_demo=false RETURNING id`, [sourceId,`xlsx-order-${sourceId}`,text(r.code) ?? '',internalCustomer(r.customer_id),num(r.status_code) ?? 0,num(r.status_code) === 1 ? 'Hoàn tất' : text(r.status_code) ?? '',excelDate(r.order_at),excelDate(r.departure,true),excelDate(r.return_date,true),num(r.total) ?? 0,num(r.paid) ?? 0,num(r.remaining) ?? 0,text(r.trip_name),text(r.destination),num(r.sale_id),text(r.sale_name),text(r.source),bool(r.is_b2b),json(text(r.service_kinds)?.split(',').map((x)=>x.trim()).filter(Boolean) ?? [])]); orderMap.set(sourceId,result.rows[0].id); orderCustomerMap.set(sourceId,internalCustomer(r.customer_id)); }
  for (const r of passengers) { const sourceId=num(r.passenger_id)!; await client.query(`INSERT INTO passengers (demo_key,order_id,customer_id,name,nationality,is_leader,is_demo,tourwell_id) VALUES ($1,$2,$3,$4,$5,$6,false,$7) ON CONFLICT (demo_key) DO UPDATE SET order_id=EXCLUDED.order_id,customer_id=EXCLUDED.customer_id,name=EXCLUDED.name,nationality=EXCLUDED.nationality,is_leader=EXCLUDED.is_leader,is_demo=false`, [`xlsx-passenger-${sourceId}`,orderMap.get(num(r.order_id)!),orderCustomerMap.get(num(r.order_id)!) ?? null,text(r.name) ?? '',text(r.nationality),bool(r.is_leader),sourceId]); }
  for (const r of products) { const sourceId=num(r.product_id)!; await client.query(`INSERT INTO products (tourwell_id,demo_key,code,name,product_type,type,destination,duration,price,active,created_at,is_demo,demo_scenario) VALUES ($1,$2,$3,$4,$5,$5,$6,$7,$8,$9,$10,false,NULL) ON CONFLICT (demo_key) DO UPDATE SET code=EXCLUDED.code,name=EXCLUDED.name,product_type=EXCLUDED.product_type,destination=EXCLUDED.destination,duration=EXCLUDED.duration,price=EXCLUDED.price,active=EXCLUDED.active,created_at=EXCLUDED.created_at,is_demo=false`, [sourceId,`xlsx-product-${sourceId}`,text(r.code) ?? '',text(r.name) ?? '',text(r.type),text(r.destination),text(r.duration),num(r.price) ?? 0,bool(r.active),excelDate(r.created_at)]); }
  await client.query('COMMIT');
  const scoring = createScoringService(pool);
  const settings = createSettingsService(pool);
  const scoreResult = await scoring.recompute(await settings.load(), new Date(), false);
  console.log(JSON.stringify({ customers: customers.length, activities: activities.length, leads: leads.length, orders: orders.length, passengers: passengers.length, products: products.length, scored: scoreResult.scored }));
} catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); await pool.end(); }
