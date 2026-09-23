CREATE TABLE IF NOT EXISTS contact_photos (
  contact_id uuid PRIMARY KEY REFERENCES contacts(id) ON DELETE CASCADE,
  image_data bytea NOT NULL,
  mime_type text NOT NULL DEFAULT 'image/webp' CHECK (mime_type = 'image/webp'),
  byte_size integer NOT NULL CHECK (byte_size BETWEEN 1 AND 98304),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (octet_length(image_data) = byte_size)
);
