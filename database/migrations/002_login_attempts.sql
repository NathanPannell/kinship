CREATE TABLE IF NOT EXISTS login_attempts (
  ip_hash text PRIMARY KEY,
  attempts integer NOT NULL DEFAULT 0,
  first_attempt_at timestamptz NOT NULL DEFAULT now()
);
