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
`);

function addColumnIfMissing(table, column, definition) {
  const cols = db.prepare("PRAGMA table_info(characters)").all().map(c => c.name);
  if (!cols.includes(column)) {
    db.prepare("ALTER TABLE characters ADD COLUMN " + column + " " + definition).run();
  }
}

addColumnIfMissing('characters', 'last_death_time', 'TEXT');
addColumnIfMissing('characters', 'last_achievement_hash', 'TEXT');
addColumnIfMissing('characters', 'last_online', 'INTEGER DEFAULT 0');
addColumnIfMissing('characters', 'online_seconds', 'INTEGER DEFAULT 0');
addColumnIfMissing('characters', 'online_since', 'TEXT');
addColumnIfMissing('characters', 'death_count', 'INTEGER DEFAULT 0');
// Add these to the bottom of your db.js file
addColumnIfMissing('characters', 'weekly_level_start', 'INTEGER DEFAULT 0');
addColumnIfMissing('characters', 'weekly_death_start', 'INTEGER DEFAULT 0');

// Initial sync to set start values to current levels
db.prepare(`
  UPDATE characters 
  SET weekly_level_start = last_level, 
      weekly_death_start = death_count 
  WHERE weekly_level_start = 0
`).run();

addColumnIfMissing('characters', 'weekly_level_start', 'INTEGER DEFAULT 0');
addColumnIfMissing('characters', 'weekly_death_start', 'INTEGER DEFAULT 0');
addColumnIfMissing('characters', 'weekly_online_start', 'INTEGER DEFAULT 0');

// 2. Initial Sync: Capture current progress as the starting point
// This prevents the bot from thinking everyone gained hundreds of levels instantly.
db.prepare(`
  UPDATE characters 
  SET weekly_level_start = last_level, 
      weekly_death_start = death_count,
      weekly_online_start = online_seconds
  WHERE weekly_level_start = 0 
     OR weekly_death_start = 0 
     OR weekly_online_start = 0
`).run();

module.exports = db;