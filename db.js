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
`);

function addColumnIfMissing(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

addColumnIfMissing('characters', 'last_death_time', 'TEXT');
addColumnIfMissing('characters', 'last_achievement_hash', 'TEXT');
addColumnIfMissing('characters', 'last_online', 'INTEGER DEFAULT 0');
addColumnIfMissing('characters', 'online_seconds', 'INTEGER DEFAULT 0');
addColumnIfMissing('characters', 'online_since', 'TEXT');
addColumnIfMissing('characters', 'death_count', 'INTEGER DEFAULT 0');

module.exports = db;