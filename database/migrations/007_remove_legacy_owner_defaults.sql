-- All writes now provide the authenticated owner explicitly. Remove the
-- cutover defaults so an unscoped insert cannot silently join the legacy data.
ALTER TABLE contacts ALTER COLUMN owner_user_id DROP DEFAULT;
ALTER TABLE api_tokens ALTER COLUMN owner_user_id DROP DEFAULT;
