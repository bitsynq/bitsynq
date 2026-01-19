-- =============================================================================
-- TRANSACTION LOG TABLE
-- Stores detailed blockchain transaction records with full audit trail
-- =============================================================================
CREATE TABLE IF NOT EXISTS transaction_logs (
    id TEXT PRIMARY KEY,                              -- UUID
    project_id TEXT NOT NULL,
    distribution_id TEXT,                               -- Links to token_distributions
    tx_hash TEXT UNIQUE,                               -- Blockchain transaction hash
    tx_type TEXT NOT NULL,                             -- 'mint' | 'transfer' | 'batch_transfer'
    
    -- Transaction Details
    from_address TEXT NOT NULL,
    to_address TEXT NOT NULL,
    amount TEXT NOT NULL,                               -- Store as TEXT for arbitrary precision
    token_symbol TEXT,                                  -- e.g., "BITS"
    
    -- Status Tracking
    status TEXT DEFAULT 'pending',                      -- 'pending' | 'submitted' | 'confirmed' | 'failed'
    block_number INTEGER,                                -- Block number when confirmed
    gas_used INTEGER,                                   -- Gas consumed
    gas_price TEXT,                                      -- Gas price in wei
    
    -- Metadata
    error_message TEXT,                                  -- Error details if failed
    retry_count INTEGER DEFAULT 0,                       -- Retry attempts
    confirmations INTEGER DEFAULT 0,                      -- Block confirmations
    
    -- Audit Trail
    created_by TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    confirmed_at TEXT,                                   -- When tx was confirmed on-chain
    
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (distribution_id) REFERENCES token_distributions(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_tx_logs_project ON transaction_logs(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tx_logs_hash ON transaction_logs(tx_hash);
CREATE INDEX IF NOT EXISTS idx_tx_logs_status ON transaction_logs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tx_logs_user ON transaction_logs(to_address, created_at DESC);

-- =============================================================================
-- TRANSACTION INPUTS TABLE (For complex transfers)
-- Tracks individual recipients in batch transfers
-- =============================================================================
CREATE TABLE IF NOT EXISTS transaction_inputs (
    id TEXT PRIMARY KEY,
    transaction_log_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    wallet_address TEXT NOT NULL,
    amount TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (transaction_log_id) REFERENCES transaction_logs(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_tx_inputs_log ON transaction_inputs(transaction_log_id);
CREATE INDEX IF NOT EXISTS idx_tx_inputs_user ON transaction_inputs(user_id);

-- =============================================================================
-- TRANSACTION EVENTS TABLE
-- Stores event logs emitted by smart contracts
-- =============================================================================
CREATE TABLE IF NOT EXISTS transaction_events (
    id TEXT PRIMARY KEY,
    transaction_log_id TEXT,
    event_name TEXT NOT NULL,                           -- e.g., "Transfer", "Mint"
    from_address TEXT,
    to_address TEXT,
    amount TEXT,
    event_data TEXT,                                      -- JSON for additional params
    log_index INTEGER,                                    -- Log index within transaction
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (transaction_log_id) REFERENCES transaction_logs(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_tx_events_log ON transaction_events(transaction_log_id);
CREATE INDEX IF NOT EXISTS idx_tx_events_name ON transaction_events(event_name, created_at DESC);
