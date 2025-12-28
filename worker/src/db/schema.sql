-- Bitsynq Contribution Tracking System
-- Database Schema for Cloudflare D1

-- Enable foreign keys (D1 supports this)
PRAGMA foreign_keys = ON;

-- =============================================================================
-- USERS TABLE
-- Stores user account information
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,                              -- UUID
    email TEXT UNIQUE NOT NULL,                       -- Login email
    password_hash TEXT NOT NULL,                      -- Bcrypt hashed password
    display_name TEXT NOT NULL,                       -- Display name
    wallet_address TEXT,                              -- Blockchain wallet (optional)
    avatar_url TEXT,                                  -- Profile picture URL
    created_at TEXT DEFAULT (datetime('now')),        -- ISO8601 timestamp
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Index for email lookups during login
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- =============================================================================
-- PROJECTS TABLE
-- Stores project information
-- =============================================================================
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,                              -- UUID
    name TEXT NOT NULL,                               -- Project name
    description TEXT,                                 -- Project description
    owner_id TEXT NOT NULL,                           -- Creator user ID
    token_symbol TEXT,                                -- Token symbol (e.g., "BTC")
    status TEXT DEFAULT 'active',                     -- 'active' | 'archived'
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for owner lookup
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);

-- =============================================================================
-- PROJECT MEMBERS TABLE
-- Many-to-many relationship between projects and users
-- =============================================================================
CREATE TABLE IF NOT EXISTS project_members (
    project_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT DEFAULT 'member',                       -- 'admin' | 'member'
    joined_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (project_id, user_id),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =============================================================================
-- MEETINGS TABLE
-- Stores uploaded meeting transcripts
-- =============================================================================
CREATE TABLE IF NOT EXISTS meetings (
    id TEXT PRIMARY KEY,                              -- UUID
    project_id TEXT NOT NULL,
    title TEXT,                                       -- Meeting title
    meeting_date TEXT,                                -- ISO8601 date
    raw_transcript TEXT,                              -- Raw meeting text
    parsed_data TEXT,                                 -- JSON: parsed participants & stats
    status TEXT DEFAULT 'pending',                    -- 'pending' | 'processed'
    created_by TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Index for project meeting queries
CREATE INDEX IF NOT EXISTS idx_meetings_project ON meetings(project_id);

-- =============================================================================
-- CONTRIBUTIONS TABLE
-- Stores contribution records (ratio-based)
-- =============================================================================
CREATE TABLE IF NOT EXISTS contributions (
    id TEXT PRIMARY KEY,                              -- UUID
    project_id TEXT NOT NULL,
    user_id TEXT NOT NULL,                            -- Contributor
    ratio REAL NOT NULL CHECK (ratio >= 0 AND ratio <= 100),  -- 0.0 ~ 100.0
    source_type TEXT NOT NULL,                        -- 'meeting' | 'manual' | 'import'
    source_id TEXT,                                   -- Reference to meeting ID
    description TEXT,
    created_by TEXT NOT NULL,                         -- Who recorded this
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Indexes for contribution queries
CREATE INDEX IF NOT EXISTS idx_contributions_project ON contributions(project_id);
CREATE INDEX IF NOT EXISTS idx_contributions_user ON contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_contributions_source ON contributions(source_id);

-- =============================================================================
-- TOKEN DISTRIBUTIONS TABLE
-- Records token distribution events (milestones)
-- =============================================================================
CREATE TABLE IF NOT EXISTS token_distributions (
    id TEXT PRIMARY KEY,                              -- UUID
    project_id TEXT NOT NULL,
    milestone_name TEXT,                              -- e.g., "Phase 1 Complete"
    total_tokens INTEGER NOT NULL,                    -- Total tokens distributed
    distribution_data TEXT,                           -- JSON: {user_id: amount, ...}
    tx_hash TEXT,                                     -- Blockchain tx hash (optional)
    status TEXT DEFAULT 'pending',                    -- 'pending' | 'confirmed'
    created_by TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Index for project distribution queries
CREATE INDEX IF NOT EXISTS idx_distributions_project ON token_distributions(project_id);

-- =============================================================================
-- USER BALANCES TABLE
-- Tracks token balances per user per project
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_balances (
    user_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    balance INTEGER DEFAULT 0,                        -- Token balance
    total_contributed REAL DEFAULT 0,                 -- Sum of all contribution ratios
    last_updated TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, project_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
