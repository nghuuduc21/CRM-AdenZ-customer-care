-- Preserve normalized lead and activity source fields for the demo application.
-- Source values remain unchanged; JSON columns retain nested source structures for forward-compatible sync.
ALTER TABLE leads
  ALTER COLUMN status_code DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS source_id BIGINT,
  ADD COLUMN IF NOT EXISTS state_id BIGINT,
  ADD COLUMN IF NOT EXISTS state_title TEXT,
  ADD COLUMN IF NOT EXISTS type_source TEXT,
  ADD COLUMN IF NOT EXISTS quotes_source JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS customer_source JSONB,
  ADD COLUMN IF NOT EXISTS source_source JSONB,
  ADD COLUMN IF NOT EXISTS sales_person_source JSONB,
  ADD COLUMN IF NOT EXISTS source_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tourwell_updated_at TIMESTAMPTZ;

ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS source_type TEXT,
  ADD COLUMN IF NOT EXISTS source_label TEXT,
  ADD COLUMN IF NOT EXISTS action_source TEXT,
  ADD COLUMN IF NOT EXISTS channel_source TEXT,
  ADD COLUMN IF NOT EXISTS is_internal BOOLEAN,
  ADD COLUMN IF NOT EXISTS replies_count INTEGER,
  ADD COLUMN IF NOT EXISTS description_source TEXT,
  ADD COLUMN IF NOT EXISTS customer_source_id BIGINT,
  ADD COLUMN IF NOT EXISTS creator_id BIGINT,
  ADD COLUMN IF NOT EXISTS creator_name TEXT,
  ADD COLUMN IF NOT EXISTS source_source JSONB,
  ADD COLUMN IF NOT EXISTS source_title TEXT,
  ADD COLUMN IF NOT EXISTS source_status TEXT,
  ADD COLUMN IF NOT EXISTS tourwell_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS leads_source_id_idx ON leads(source_id);
CREATE INDEX IF NOT EXISTS leads_state_idx ON leads(is_demo,state_id,status_code);
CREATE INDEX IF NOT EXISTS activities_source_customer_idx ON activities(is_demo,customer_source_id,created_at DESC);
