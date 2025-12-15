-- bitsynq projects
CREATE TABLE projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL
);

-- Contribution logs (ratio-based)
CREATE TABLE contributions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  projectId INTEGER NOT NULL,
  userId TEXT NOT NULL,
  ratio INTEGER NOT NULL,        -- e.g., 305 for 30.5%
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
  projectId INTEGER NOT NULL,
  totalTokens INTEGER NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
