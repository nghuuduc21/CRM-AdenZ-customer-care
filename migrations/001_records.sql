CREATE TABLE IF NOT EXISTS records (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 160),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','done')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS records_status_created_idx ON records(status, created_at DESC);
