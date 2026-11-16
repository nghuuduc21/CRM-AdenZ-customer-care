ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_state TEXT,
  ADD COLUMN IF NOT EXISTS currency_source JSONB,
  ADD COLUMN IF NOT EXISTS total_payment_source JSONB,
  ADD COLUMN IF NOT EXISTS total_paid_source JSONB,
  ADD COLUMN IF NOT EXISTS total_remaining_source JSONB;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS market TEXT,
  ADD COLUMN IF NOT EXISTS pricing_source JSONB;

ALTER TABLE orders ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE order_services ADD COLUMN IF NOT EXISTS tourwell_service_id BIGINT;

ALTER TABLE activities ALTER COLUMN customer_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS receipts (
  id BIGSERIAL PRIMARY KEY,
  demo_key TEXT UNIQUE,
  code TEXT NOT NULL,
  transaction_type TEXT,
  total_amount_source JSONB,
  payment_date TIMESTAMPTZ,
  approve_status TEXT,
  payment_method TEXT,
  order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
  customer_id BIGINT REFERENCES customers(customer_id) ON DELETE SET NULL,
  is_demo BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS receipts_demo_order_idx ON receipts(is_demo, order_id);
