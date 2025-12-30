-- Migration number: 0002 	 2024-05-22T00:00:00.000Z
-- Add encrypted_private_key to users table

ALTER TABLE users ADD COLUMN encrypted_private_key TEXT;
