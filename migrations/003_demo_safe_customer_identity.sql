ALTER TABLE customers ADD COLUMN customer_id BIGSERIAL;
ALTER TABLE customers ADD COLUMN is_demo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE customers ADD COLUMN demo_key TEXT;
ALTER TABLE customers ADD COLUMN demo_scenario TEXT;

ALTER TABLE customers DROP CONSTRAINT customers_pkey;
ALTER TABLE customers ALTER COLUMN tourwell_id DROP NOT NULL;

UPDATE customers
SET is_demo = true,
    demo_key = 'legacy-sample-' || code,
    demo_scenario = 'legacy-sample',
    tourwell_id = NULL
WHERE code LIKE 'SAMPLE-CUST-%';

ALTER TABLE customers ADD CONSTRAINT customers_pkey PRIMARY KEY (customer_id);
CREATE UNIQUE INDEX customers_tourwell_id_unique ON customers (tourwell_id) WHERE tourwell_id IS NOT NULL;
CREATE UNIQUE INDEX customers_demo_key_unique ON customers (demo_key) WHERE demo_key IS NOT NULL;
