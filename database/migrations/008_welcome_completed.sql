ALTER TABLE users ADD COLUMN IF NOT EXISTS welcome_completed_at timestamptz;

-- Accounts with an established circle are already past the first-run journey.
UPDATE users
SET welcome_completed_at = now()
WHERE welcome_completed_at IS NULL
  AND EXISTS (SELECT 1 FROM contacts WHERE contacts.owner_user_id = users.id);
