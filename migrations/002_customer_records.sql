CREATE TABLE customers (
  tourwell_id BIGINT PRIMARY KEY,
  code TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  link_erp TEXT,
  phone_primary TEXT,
  phone_primary_code TEXT,
  phone_secondary TEXT,
  phone_secondary_code TEXT,
  email_primary TEXT,
  email_secondary TEXT,
  sub_group TEXT,
  customer_type TEXT,
  customer_status TEXT,
  member_tier TEXT,
  source_id BIGINT,
  source_name TEXT,
  sale_id BIGINT,
  sale_name TEXT,
  birthday DATE,
  tourwell_created_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX customers_code_idx ON customers (code);
CREATE INDEX customers_sale_id_idx ON customers (sale_id);
