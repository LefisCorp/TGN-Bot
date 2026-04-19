const { EmbedBuilder } = require('discord.js');
const schedule = require('node-schedule');
const db = require('./db');
const { getCharacter, getWorld, getLatestNews, getCharacterDeathContext } = require('./tibia');

// --- JOKES ---
const levelJokes = [
  '✨ Another ding. The training arc is paying rent.',
  '🎉 Apparently sleep is optional and XP is forever.',
  '⚔️ Someone has been absolutely farming like a goblin on espresso.',
  '📈 The monsters had families, but progress is progress.',
  '🧠 A fresh level has entered the chat and it smells like victory.',
  '😏 Incredible. More numbers, same questionable life choices.',
  '🔥 The grind continues because apparently peace was never the goal.',
  '🛌 Sleep remains optional. XP remains mandatory.',
  '📢 The server has been informed of yet another level up.',
  '🤝 One step closer to becoming a spreadsheet legend.'
];

const deathJokes = [
  '💀 That went well. By well, we mean terribly.',
  '🕳️ A tactical floor inspection has occurred.',
  '⚰️ The temple welcomes another frequent flyer.',
  '😵 Turns out confidence was not a valid defense stat.',
  '🗑️ A bold strategy. Shame about the corpse.',
  '🔄 Impressive consistency. Less impressive survival.',
  '💸 The XP loss has been lovingly recorded.',
  '🏥 The healer department has been notified, again.',
  '🚪 Removed from the game. Efficient, if nothing else.',
  '🌱 Nature truly is healing.'
];

const onlineJokes = [
  '🟢 Boots on. Backpack stuffed. Bad decisions loading.',
  '📶 Another hero has clocked in for monster-related admin.',
  '⚔️ The hunt begins, and the local wildlife should be nervous.',
  '🎮 Online and ready to collect loot and poor life choices.',
  '🔥 The server just got a little less safe for dragons.'
];

const offlineJokes = [
  '⚫ The hunt is over. Time to sort loot and pretend it was efficient.',
  '🌙 Logged off gracefully, or after a disaster. We may never know.',
  '👻 The battlefield grows quieter. The depot grows fuller.',
  '🧘 Offline now. The monsters may file a temporary restraining order.'
];

// --- UTILS ---
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

async function sendEmbedToSetting(client, settingKey, embed) {
  try {
    const row = db.prepare(`SELECT value FROM settings WHERE key = ?`).get(settingKey);
    if (!row) return null; // Change to return null
    const channel = await client.channels.fetch(row.value).catch(() => null);
    if (!channel) return null; // Change to return null

    // Capture the sent message in a variable
    const sentMessage = await channel.send({ embeds: [embed] });
    return sentMessage; // Return the message object so we can react to it
  } catch (e) {
    console.log(`Failed to send embed for ${settingKey}:`, e.message);
    return null;
  }
}
// --- TRACKING LOGIC ---

async function checkCharacters(client) {
  const chars = db.prepare(`
    SELECT * FROM characters 
    WHERE owner_discord_id IS NOT NULL 
    AND account_group_id IS NOT NULL
  `).all();

  for (const ch of chars) {
    try {
      const data = await getCharacter(ch.name);
      const c = data?.character?.character;
      if (!c) continue;

      // 1. LEVEL UP CHECK
      if (typeof ch.last_level === 'number' && ch.last_level > 0 && c.level > ch.last_level) {
        const levelEmbed = new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle('🎉 Level Up!')
          .setDescription(`**${c.name}** just went from **${ch.last_level}** to **${c.level}**!\n\n*${pickRandom(levelJokes)}*`)
          .addFields(
            { name: 'Character', value: c.name, inline: true },
            { name: 'New Level', value: String(c.level), inline: true }
          )
          .setTimestamp();

        const levelMsg = await sendEmbedToSetting(client, 'level_alert_channel_id', levelEmbed);

        if (levelMsg) {
          try {
            await levelMsg.react('📈');
            await levelMsg.react('🇼');
            await levelMsg.react('🥳');
          } catch (err) {
            console.log("Failed to add reactions to level message.");
          }
        }
      }

      // 2. DEATH CHECK (WITH CONTEXT & PVP)
      const deaths = data?.character?.deaths || [];
      const latestDeath = deaths[0];
      const latestDeathTime = latestDeath?.time || latestDeath?.date?.date || null;

      if (latestDeathTime && latestDeathTime !== ch.last_death_time) {
        const isPvP = latestDeath.killers?.some(k => k.player === true) || false;
        const killerNames = latestDeath.killers?.map(k => k.name).join(', ') || 'Unknown';

        const deathEmbed = new EmbedBuilder()
          .setTitle(isPvP ? '⚔️ PLAYER KILL DETECTED' : '💀 Character Death')
          .setColor(isPvP ? 0x9B59B6 : 0xED4245)
          .setDescription(`**${c.name}** was ${isPvP ? 'slain by players' : 'taken by the world'} on **${c.world}**.\n\n*${pickRandom(deathJokes)}*`)
          .addFields(
            { name: 'Death Context', value: latestDeath.reason || 'Cause unknown' },
            { name: 'Level', value: String(latestDeath.level || c.level), inline: true },
            { name: 'World', value: c.world || 'Unknown', inline: true }
          );

        if (isPvP) {
          deathEmbed.addFields({ name: '🎯 Killers', value: killerNames });
        }

        deathEmbed.setTimestamp();

        // Capture the message to add "F" reactions
        const deathMsg = await sendEmbedToSetting(client, 'death_alert_channel_id', deathEmbed);
        
        if (deathMsg) {
          try {
            await deathMsg.react('💀');
            await deathMsg.react('🇫');
          } catch (err) {
            console.log("Failed to add reactions to death message.");
          }
        }

        db.prepare(`UPDATE characters SET death_count = COALESCE(death_count, 0) + 1 WHERE name = ?`).run(ch.name);
      }

      // UPDATE STATS (Keep this outside the IFs so it updates every check)
      db.prepare(`
        UPDATE characters 
        SET last_level = ?, last_death_time = ?, last_achievement_hash = ?
        WHERE name = ?
      `).run(c.level, latestDeathTime, JSON.stringify(data?.character?.achievements || []), ch.name);

    } catch (e) {
      console.log(`Failed to check character ${ch.name}:`, e.message);
    }
  }
}

async function checkOnline(client) {
  const chars = db.prepare(`SELECT name, world, last_online, online_since FROM characters WHERE owner_discord_id IS NOT NULL`).all();
  const worlds = [...new Set(chars.map(c => c.world).filter(Boolean))];

  for (const world of worlds) {
    try {
      const worldData = await getWorld(world);
      const players = worldData?.world?.online_players || [];
      const onlineSet = new Set(players.map(p => p.name.toLowerCase()));

      for (const ch of chars.filter(c => c.world === world)) {
        const isOnline = onlineSet.has(ch.name.toLowerCase()) ? 1 : 0;
        const wasOnline = Number(ch.last_online) || 0;

        if (isOnline === 1 && wasOnline === 0) {
          const nowIso = new Date().toISOString();
          db.prepare(`UPDATE characters SET last_online = 1, online_since = ? WHERE name = ?`).run(nowIso, ch.name);
          
          const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🟢 Online')
            .setDescription(`**${ch.name}** is now online.\n\n*${pickRandom(onlineJokes)}*`)
            .setTimestamp();
          await sendEmbedToSetting(client, 'online_alert_channel_id', embed);
        } 
        else if (isOnline === 0 && wasOnline === 1) {
          let sessionSeconds = 0;
          if (ch.online_since) {
            sessionSeconds = Math.floor((Date.now() - new Date(ch.online_since).getTime()) / 1000);
          }
          db.prepare(`UPDATE characters SET last_online = 0, online_since = NULL, online_seconds = COALESCE(online_seconds, 0) + ? WHERE name = ?`).run(sessionSeconds || 0, ch.name);
          
          const embed = new EmbedBuilder()
            .setColor(0x747F8D)
            .setTitle('⚫ Offline')
            .setDescription(`**${ch.name}** logged off after **${formatDuration(sessionSeconds)}**.\n\n*${pickRandom(offlineJokes)}*`)
            .setTimestamp();
          await sendEmbedToSetting(client, 'online_alert_channel_id', embed);
        }
      }
    } catch (e) {
      console.log(`Failed online check for ${world}`);
    }
  }
}

async function checkNews(client) {
  try {
    const newsData = await getLatestNews();
    const items = newsData?.news || [];
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);

    for (const item of items) {
      const newsDate = new Date(item.date).getTime();
      if (newsDate < oneDayAgo) continue;

      const exists = db.prepare(`SELECT news_id FROM news_posts WHERE news_id = ?`).get(String(item.id));
      if (exists) continue;

      const embed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle('📰 Tibia News')
        .setDescription(`**${item.title}**`)
        .setURL(item.url || 'https://www.tibia.com')
        .setTimestamp();

      await sendEmbedToSetting(client, 'news_alert_channel_id', embed);
      db.prepare(`INSERT INTO news_posts (news_id, title, published_at) VALUES (?, ?, ?)`).run(String(item.id), item.title, item.date);
    }
  } catch (e) { console.log('News check failed'); }
}

// --- INITIALIZATION ---
function startTrackers(client) {
  // Run once on startup
  checkCharacters(client);
  checkOnline(client);
  checkNews(client);

  // Set intervals
  setInterval(() => checkCharacters(client), 5 * 60 * 1000); // 5 mins
  setInterval(() => checkOnline(client), 60 * 1000);      // 1 min
  setInterval(() => checkNews(client), 30 * 60 * 1000);     // 30 mins

  // Weekly Sunday 10 PM
  schedule.scheduleJob('0 22 * * 0', () => {
    // You can call your postWeeklyLeaderboards function here
    console.log('Running Sunday Awards...');
  });
}

module.exports = { startTrackers };