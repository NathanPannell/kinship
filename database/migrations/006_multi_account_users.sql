CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_sub text UNIQUE,
  email text,
  name text NOT NULL,
  picture_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO users (id, name)
VALUES ('00000000-0000-4000-8000-000000000001', 'Legacy owner')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS owner_user_id uuid
  DEFAULT '00000000-0000-4000-8000-000000000001'
  REFERENCES users(id) ON DELETE CASCADE;
UPDATE contacts
SET owner_user_id = '00000000-0000-4000-8000-000000000001'
WHERE owner_user_id IS NULL;
ALTER TABLE contacts ALTER COLUMN owner_user_id SET NOT NULL;

ALTER TABLE api_tokens ADD COLUMN IF NOT EXISTS owner_user_id uuid
  DEFAULT '00000000-0000-4000-8000-000000000001'
  REFERENCES users(id) ON DELETE CASCADE;
UPDATE api_tokens
SET owner_user_id = '00000000-0000-4000-8000-000000000001'
WHERE owner_user_id IS NULL;
ALTER TABLE api_tokens ALTER COLUMN owner_user_id SET NOT NULL;

ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_linkedin_url_key;
CREATE UNIQUE INDEX IF NOT EXISTS contacts_owner_linkedin_url_key
  ON contacts (owner_user_id, linkedin_url);
CREATE INDEX IF NOT EXISTS contacts_owner_user_idx ON contacts (owner_user_id);
CREATE INDEX IF NOT EXISTS api_tokens_owner_user_idx ON api_tokens (owner_user_id);
