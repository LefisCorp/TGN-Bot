const Database = require('better-sqlite3');

const db = new Database('tibia_bot.db');

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    discord_id TEXT PRIMARY KEY,
    discord_name TEXT
  );

  CREATE TABLE IF NOT EXISTS characters (
    name TEXT PRIMARY KEY,
    world TEXT,
    owner_discord_id TEXT,
    account_group_id TEXT,
    is_main INTEGER DEFAULT 0,
    last_level INTEGER DEFAULT 0,
    last_death_time TEXT,
    last_achievement_hash TEXT,
    last_online INTEGER DEFAULT 0,
    online_seconds INTEGER DEFAULT 0,
    online_since TEXT,
    death_count INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS news_posts (
    news_id TEXT PRIMARY KEY,
    title TEXT,
    published_at TEXT
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT,
    channel_id TEXT,
    message_id TEXT,
    user_id TEXT,
    character_name TEXT,
    type TEXT
  );

  CREATE TABLE IF NOT EXISTS achievement_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_name TEXT,
    achievement_name TEXT,
    timestamp TEXT
  );
`);

// Helper function to update schema without breaking existing data
function addColumnIfMissing(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

// Ensure all core columns exist
addColumnIfMissing('characters', 'last_death_time', 'TEXT');
addColumnIfMissing('characters', 'last_achievement_hash', 'TEXT');
addColumnIfMissing('characters', 'last_online', 'INTEGER DEFAULT 0');
addColumnIfMissing('characters', 'online_seconds', 'INTEGER DEFAULT 0');
addColumnIfMissing('characters', 'online_since', 'TEXT');
addColumnIfMissing('characters', 'death_count', 'INTEGER DEFAULT 0');

// Columns for the /gains system
addColumnIfMissing('characters', 'daily_level_start', 'INTEGER DEFAULT 0');
addColumnIfMissing('characters', 'weekly_level_start', 'INTEGER DEFAULT 0');
addColumnIfMissing('characters', 'weekly_death_start', 'INTEGER DEFAULT 0');
addColumnIfMissing('characters', 'weekly_online_start', 'INTEGER DEFAULT 0');
addColumnIfMissing('characters', 'session_start_level', 'INTEGER DEFAULT 0');


// Optimization: Indexes for fast lookups
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_char_world ON characters (world);
  CREATE INDEX IF NOT EXISTS idx_char_owner ON characters (owner_discord_id);
`);

module.exports = db;