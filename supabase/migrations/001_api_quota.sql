-- ============================================================
-- Migration 001: API Quota Tracking Schema
-- ============================================================
-- Sets up tables to persist Google Maps API call counts in
-- Supabase so that quota data survives server restarts and
-- is shared across multiple serverless function instances.
-- ============================================================

-- Table 1: api_quota_config — stores limits per API type
CREATE TABLE IF NOT EXISTS api_quota_config (
  api_type        TEXT PRIMARY KEY,
  display_name    TEXT NOT NULL,
  monthly_free_requests INTEGER NOT NULL,
  cost_per_1000_usd NUMERIC(8,4) NOT NULL,
  free_credit_usd  NUMERIC(8,2) NOT NULL,
  description     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Insert config for each API type
INSERT INTO api_quota_config (api_type, display_name, monthly_free_requests, cost_per_1000_usd, free_credit_usd, description) VALUES
('directions',  'Directions API',  40000, 5.00, 200.00, 'Route planning between two points'),
('geocoding',   'Geocoding API',   40000, 5.00, 200.00, 'Address ↔ coordinates conversion')
ON CONFLICT (api_type) DO NOTHING;

-- Table 2: api_calls — logs every API call
CREATE TABLE IF NOT EXISTS api_calls (
  id               BIGSERIAL PRIMARY KEY,
  api_type         TEXT NOT NULL REFERENCES api_quota_config(api_type),
  called_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  travel_mode      TEXT,
  avoid_options    TEXT[],
  status           TEXT NOT NULL CHECK (status IN ('success','error')),
  error_code       TEXT,
  origin_query     TEXT,
  destination_query TEXT,
  session_id       TEXT
);

CREATE INDEX IF NOT EXISTS idx_api_calls_type_date ON api_calls(api_type, called_at);
CREATE INDEX IF NOT EXISTS idx_api_calls_date ON api_calls(called_at);

-- View: current month usage per API type
CREATE OR REPLACE VIEW monthly_usage AS
SELECT
  c.api_type,
  c.display_name,
  c.monthly_free_requests,
  c.cost_per_1000_usd,
  c.free_credit_usd,
  COUNT(a.id) FILTER (WHERE DATE_TRUNC('month', a.called_at) = DATE_TRUNC('month', NOW())) AS used_this_month,
  c.monthly_free_requests - COUNT(a.id) FILTER (WHERE DATE_TRUNC('month', a.called_at) = DATE_TRUNC('month', NOW())) AS remaining,
  ROUND(
    COUNT(a.id) FILTER (WHERE DATE_TRUNC('month', a.called_at) = DATE_TRUNC('month', NOW()))::NUMERIC
    / NULLIF(c.monthly_free_requests, 0) * 100, 2
  ) AS usage_percent
FROM api_quota_config c
LEFT JOIN api_calls a ON a.api_type = c.api_type
GROUP BY c.api_type, c.display_name, c.monthly_free_requests, c.cost_per_1000_usd, c.free_credit_usd;
