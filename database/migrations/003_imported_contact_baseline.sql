ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS imported_last_contacted_at timestamptz,
  ADD COLUMN IF NOT EXISTS photo_url text;
