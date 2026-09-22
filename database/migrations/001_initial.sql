CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company text,
  role text,
  linkedin_url text UNIQUE,
  email text,
  phone text,
  location text,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('high', 'normal', 'low')),
  cadence_days integer NOT NULL DEFAULT 45 CHECK (cadence_days BETWEEN 1 AND 3650),
  notes text,
  last_contacted_at timestamptz,
  snoozed_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  channel text NOT NULL CHECK (channel IN ('LinkedIn', 'WhatsApp', 'Email', 'Phone', 'In person', 'Other')),
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contacts_last_contacted_idx ON contacts (last_contacted_at);
CREATE INDEX IF NOT EXISTS contacts_priority_idx ON contacts (priority);
CREATE INDEX IF NOT EXISTS interactions_contact_date_idx ON interactions (contact_id, occurred_at DESC);
