-- Migration: Add aliases column to users table
ALTER TABLE users ADD COLUMN aliases TEXT DEFAULT '[]';
