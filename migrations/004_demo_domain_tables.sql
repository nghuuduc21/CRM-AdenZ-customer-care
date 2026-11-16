CREATE TABLE products (
  id BIGSERIAL PRIMARY KEY,
  tourwell_id BIGINT,
  demo_key TEXT UNIQUE,
  name TEXT NOT NULL,
  product_type TEXT,
  destination TEXT,
  duration TEXT,
  price NUMERIC(14,2) NOT NULL DEFAULT 0,
  image_url TEXT,
  url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  demo_scenario TEXT
);

CREATE TABLE orders (
  id BIGSERIAL PRIMARY KEY,
  tourwell_id BIGINT,
  demo_key TEXT UNIQUE,
  code TEXT NOT NULL,
  customer_id BIGINT NOT NULL REFERENCES customers(customer_id),
  status_code INTEGER NOT NULL,
  status_title TEXT NOT NULL,
  order_at TIMESTAMPTZ,
  departure DATE,
  return_date DATE,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  remaining_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  trip_name TEXT,
  destination TEXT,
  sale_id BIGINT,
  sale_name TEXT,
  source_name TEXT,
  is_b2b BOOLEAN NOT NULL DEFAULT false,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  demo_scenario TEXT
);

CREATE TABLE order_services (
  id BIGSERIAL PRIMARY KEY,
  demo_key TEXT UNIQUE,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL,
  item_name TEXT,
  description TEXT,
  departure DATE,
  return_date DATE,
  is_demo BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE leads (
  id BIGSERIAL PRIMARY KEY,
  tourwell_id BIGINT,
  demo_key TEXT UNIQUE,
  code TEXT NOT NULL,
  customer_id BIGINT REFERENCES customers(customer_id),
  status_code INTEGER NOT NULL,
  status_title TEXT NOT NULL,
  source_name TEXT,
  service TEXT,
  quote_status TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ,
  sale_id BIGINT,
  sale_name TEXT,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  demo_scenario TEXT
);

CREATE TABLE activities (
  id BIGSERIAL PRIMARY KEY,
  tourwell_id BIGINT,
  demo_key TEXT UNIQUE,
  customer_id BIGINT NOT NULL REFERENCES customers(customer_id),
  order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
  activity_type TEXT,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  remind_at TIMESTAMPTZ,
  status TEXT,
  sale_id BIGINT,
  sale_name TEXT,
  is_demo BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE passengers (
  id BIGSERIAL PRIMARY KEY,
  demo_key TEXT UNIQUE,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_id BIGINT REFERENCES customers(customer_id),
  name TEXT NOT NULL,
  nationality TEXT,
  is_leader BOOLEAN NOT NULL DEFAULT false,
  is_demo BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE care_tasks (
  id BIGSERIAL PRIMARY KEY,
  demo_key TEXT UNIQUE,
  customer_id BIGINT REFERENCES customers(customer_id),
  order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
  lead_id BIGINT REFERENCES leads(id) ON DELETE SET NULL,
  task_kind TEXT NOT NULL,
  priority TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT,
  due_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  is_demo BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE surveys (
  id BIGSERIAL PRIMARY KEY,
  demo_key TEXT UNIQUE,
  customer_id BIGINT NOT NULL REFERENCES customers(customer_id),
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  score SMALLINT NOT NULL CHECK (score BETWEEN 0 AND 10),
  comment TEXT,
  sent_at TIMESTAMPTZ,
  answered_at TIMESTAMPTZ,
  is_demo BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE campaigns (
  id BIGSERIAL PRIMARY KEY,
  demo_key TEXT UNIQUE,
  name TEXT NOT NULL,
  goal TEXT,
  status TEXT NOT NULL,
  subject TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  is_demo BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE messages (
  id BIGSERIAL PRIMARY KEY,
  demo_key TEXT UNIQUE,
  campaign_id BIGINT REFERENCES campaigns(id) ON DELETE SET NULL,
  customer_id BIGINT REFERENCES customers(customer_id),
  journey TEXT,
  subject TEXT NOT NULL,
  to_addr TEXT,
  marketing BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  is_demo BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX products_demo_idx ON products (is_demo, destination);
CREATE INDEX orders_customer_demo_idx ON orders (customer_id, is_demo, order_at DESC);
CREATE INDEX orders_departure_demo_idx ON orders (is_demo, departure);
CREATE INDEX leads_customer_demo_idx ON leads (customer_id, is_demo, created_at DESC);
CREATE INDEX activities_customer_demo_idx ON activities (customer_id, is_demo, created_at DESC);
CREATE INDEX passengers_order_demo_idx ON passengers (order_id, is_demo);
CREATE INDEX care_tasks_status_demo_idx ON care_tasks (is_demo, status, due_at);
CREATE INDEX messages_campaign_demo_idx ON messages (campaign_id, is_demo, status);
