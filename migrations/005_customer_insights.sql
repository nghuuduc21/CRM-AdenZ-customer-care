CREATE TABLE customer_contact_preferences (
  customer_id BIGINT PRIMARY KEY REFERENCES customers(customer_id) ON DELETE CASCADE,
  email_marketing_allowed BOOLEAN NOT NULL DEFAULT true,
  consent_basis TEXT,
  consented_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  is_demo BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE customer_insights (
  customer_id BIGINT PRIMARY KEY REFERENCES customers(customer_id) ON DELETE CASCADE,
  customer_kind TEXT NOT NULL CHECK (customer_kind IN ('buyer', 'prospect')),
  r_score SMALLINT CHECK (r_score BETWEEN 1 AND 5),
  f_score SMALLINT CHECK (f_score BETWEEN 1 AND 5),
  m_score SMALLINT CHECK (m_score BETWEEN 1 AND 5),
  potential_score SMALLINT CHECK (potential_score BETWEEN 0 AND 100),
  potential_tier TEXT CHECK (potential_tier IN ('hot', 'warm', 'cold')),
  segment_code TEXT NOT NULL,
  score_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  predicted_purchase TEXT CHECK (predicted_purchase IN ('high', 'medium', 'low')),
  predicted_purchase_score SMALLINT CHECK (predicted_purchase_score BETWEEN 0 AND 100),
  suggested_destination TEXT,
  preferred_travel_month SMALLINT CHECK (preferred_travel_month BETWEEN 1 AND 12),
  churn_risk TEXT CHECK (churn_risk IN ('high', 'medium', 'low', 'insufficient_history')),
  prediction_method TEXT NOT NULL DEFAULT 'transparent_demo_rules_v1',
  is_demo BOOLEAN NOT NULL DEFAULT false,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX customer_insights_segment_idx ON customer_insights (is_demo, segment_code);
CREATE INDEX customer_insights_prediction_idx ON customer_insights (is_demo, predicted_purchase, potential_tier, churn_risk);
