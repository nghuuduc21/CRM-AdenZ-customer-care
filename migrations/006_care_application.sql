-- PostgreSQL persistence for the customer-care demo application.
-- Source-system identifiers are optional references; this project seeds fabricated records only.
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS link TEXT,
  ADD COLUMN IF NOT EXISTS tier TEXT,
  ADD COLUMN IF NOT EXISTS is_b2b BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS services JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS tourwell_id BIGINT,
  ADD COLUMN IF NOT EXISTS status_code INTEGER,
  ADD COLUMN IF NOT EXISTS total NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS paid NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS remaining NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS service_kinds JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS source_name TEXT,
  ADD COLUMN IF NOT EXISTS link TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS orders_tourwell_id_unique ON orders(tourwell_id) WHERE tourwell_id IS NOT NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS link TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS leads_tourwell_id_unique ON leads(tourwell_id) WHERE tourwell_id IS NOT NULL;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS kind TEXT;
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS tourwell_id BIGINT,
  ADD COLUMN IF NOT EXISTS code TEXT,
  ADD COLUMN IF NOT EXISTS type TEXT,
  ADD COLUMN IF NOT EXISTS image TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS products_tourwell_id_unique ON products(tourwell_id) WHERE tourwell_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS care_scores (
  customer_id BIGINT PRIMARY KEY REFERENCES customers(customer_id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('buyer','lead')), segment TEXT NOT NULL,
  r SMALLINT, f SMALLINT, m SMALLINT, total_spend NUMERIC(14,2) NOT NULL DEFAULT 0,
  last_trip DATE, lead_score SMALLINT, propensity TEXT, next_destination TEXT,
  best_month SMALLINT, churn_risk TEXT, visited JSONB NOT NULL DEFAULT '[]'::jsonb,
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS care_scores_segment_idx ON care_scores(kind,segment);
CREATE TABLE IF NOT EXISTS care_segment_history (
  id BIGSERIAL PRIMARY KEY, customer_id BIGINT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(), from_segment TEXT, to_segment TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS care_strategies (
  segment TEXT PRIMARY KEY, actions TEXT NOT NULL DEFAULT '', offer TEXT NOT NULL DEFAULT '',
  channel TEXT NOT NULL DEFAULT 'email', max_per_month SMALLINT NOT NULL DEFAULT 2 CHECK (max_per_month BETWEEN 0 AND 100)
);

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS audience JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS body TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS product_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS service_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS recommend BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by TEXT,
  ADD COLUMN IF NOT EXISTS approved_by TEXT,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT,
  ADD COLUMN IF NOT EXISTS html TEXT,
  ADD COLUMN IF NOT EXISTS text_body TEXT,
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS token TEXT,
  ADD COLUMN IF NOT EXISTS error TEXT,
  ADD COLUMN IF NOT EXISTS order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reply_to TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS messages_dedupe_key_unique ON messages(dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS messages_token_unique ON messages(token) WHERE token IS NOT NULL;
ALTER TABLE passengers ADD COLUMN IF NOT EXISTS tourwell_id BIGINT;
CREATE UNIQUE INDEX IF NOT EXISTS passengers_tourwell_id_unique ON passengers(tourwell_id) WHERE tourwell_id IS NOT NULL;

ALTER TABLE care_tasks
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT,
  ADD COLUMN IF NOT EXISTS sale_id BIGINT,
  ADD COLUMN IF NOT EXISTS sale_name TEXT,
  ADD COLUMN IF NOT EXISTS kind TEXT,
  ADD COLUMN IF NOT EXISTS due TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS done_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS done_by TEXT,
  ADD COLUMN IF NOT EXISTS step TEXT,
  ADD COLUMN IF NOT EXISTS script TEXT,
  ADD COLUMN IF NOT EXISTS outcome TEXT,
  ADD COLUMN IF NOT EXISTS snooze_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS care_tasks_dedupe_unique ON care_tasks(dedupe_key) WHERE dedupe_key IS NOT NULL;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS token TEXT, ALTER COLUMN score DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS surveys_token_unique ON surveys(token) WHERE token IS NOT NULL;

CREATE TABLE IF NOT EXISTS care_lead_outcomes (
  lead_id BIGINT PRIMARY KEY REFERENCES leads(id) ON DELETE CASCADE,
  customer_id BIGINT REFERENCES customers(customer_id) ON DELETE SET NULL,
  reason TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', recorded_by TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(), nurture_until DATE
);
CREATE TABLE IF NOT EXISTS care_lead_status_log (
  id BIGSERIAL PRIMARY KEY, lead_id BIGINT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  status_title TEXT NOT NULL, seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS care_lead_status_log_lead_idx ON care_lead_status_log(lead_id,seen_at);
CREATE TABLE IF NOT EXISTS care_partner_requests (
  id BIGSERIAL PRIMARY KEY, message_token TEXT NOT NULL,
  customer_id BIGINT REFERENCES customers(customer_id) ON DELETE SET NULL,
  kind TEXT NOT NULL, message TEXT NOT NULL, pax INTEGER, wanted TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS care_tier_history (
  id BIGSERIAL PRIMARY KEY, customer_id BIGINT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(), from_tier TEXT, to_tier TEXT
);
CREATE TABLE IF NOT EXISTS care_opt_outs (
  customer_id BIGINT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  channel TEXT NOT NULL, opted_out_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'customer', PRIMARY KEY(customer_id,channel)
);
CREATE TABLE IF NOT EXISTS care_audit (
  id BIGSERIAL PRIMARY KEY, occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor TEXT NOT NULL, action TEXT NOT NULL, detail JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS care_users (
  username TEXT PRIMARY KEY, name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','boss','marketing','sale')),
  email TEXT, sale_id BIGINT, password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS care_login_failures (
  username TEXT PRIMARY KEY, failure_count INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ
);
