-- This application's database only. Never run this against GEA's database.
CREATE TABLE IF NOT EXISTS oauth_example_flows (
  browser_key text PRIMARY KEY,
  state_hash text NOT NULL,
  payload text NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS oauth_example_sessions (
  session_key text PRIMARY KEY,
  payload text NOT NULL,
  token_expires_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'reauth_required', 'logout_pending')),
  chat_id uuid,
  run_id uuid
);
CREATE INDEX IF NOT EXISTS oauth_example_flow_expiry ON oauth_example_flows (expires_at);
CREATE INDEX IF NOT EXISTS oauth_example_session_expiry ON oauth_example_sessions (expires_at);

-- Only a Run reference for reconnect/cancel. GEA stores the conversation itself.
CREATE TABLE IF NOT EXISTS oauth_example_runs (
  session_id uuid PRIMARY KEY,
  run_id uuid NOT NULL
);
