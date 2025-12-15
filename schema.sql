-- bitsynq projects
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

-- Contribution logs (ratio-based)
CREATE TABLE contributions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  projectId TEXT NOT NULL,
  userId TEXT NOT NULL,
  ratio REAL NOT NULL,        -- 0.0 ~ 100.0
  desc TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- bitsynq users
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  wallet TEXT NOT NULL
);

-- Milestone reward history
CREATE TABLE milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  projectId TEXT NOT NULL,
  totalTokens INTEGER NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
