-- Add columns for Digital Anchoring (Proof of Existence)
ALTER TABLE meetings ADD COLUMN content_hash TEXT;
ALTER TABLE meetings ADD COLUMN anchor_tx_hash TEXT;
ALTER TABLE meetings ADD COLUMN anchored_at TEXT;

-- Create index for hash lookups (useful for verifying existence)
CREATE INDEX IF NOT EXISTS idx_meetings_hash ON meetings(content_hash);
