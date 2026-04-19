const schedule = require('node-schedule');
const { EmbedBuilder } = require('discord.js');
const db = require('./db');
const { getCharacter, getWorld, getLatestNews } = require('./tibia');

const levelJokes = [
  '✨ Another ding. The training arc is paying rent.',
  '🎉 Apparently sleep is optional and XP is forever.',
  '⚔️ Someone has been absolutely farming like a goblin on espresso.',
  '📈 The monsters had families, but progress is progress.',
  '🧠 A fresh level has entered the chat and it smells like victory.',
  '😏 Incredible. More numbers, same questionable life choices.',
  '🔥 The grind continues because apparently peace was never the goal.',
  '🛌 Sleep remains optional. XP remains mandatory.',
  '📣 The server has been informed of yet another level up.',
  '🫠 One step closer to becoming a spreadsheet legend.'
];

const deathJokes = [
  '💀 That went well. By well, we mean terribly.',
  '🪦 A tactical floor inspection has occurred.',
  '⚰️ The temple welcomes another frequent flyer.',
  '😵 Turns out confidence was not a valid defense stat.',
  '🗑️ A bold strategy. Shame about the corpse.',
  '🔁 Impressive consistency. Less impressive survival.',
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
  '🔥 The server just got a little less safe for dragons.',
  '😏 Great, the server’s favorite distraction is back.',
  '👀 Stability was nice while it lasted.',
  '🧭 The group hunt may now proceed badly.',
  '📣 We were having a peaceful day, so naturally this happened.',
  '🫠 Everyone please act surprised.'
];

const offlineJokes = [
  '⚫ The hunt is over. Time to sort loot and pretend it was efficient.',
  '🌙 Logged off gracefully, or after a disaster. We may never know.',
  '👻 The battlefield grows quieter. The depot grows fuller.',
  '🧘 Offline now. The monsters may file a temporary restraining order.',
  '🔕 Another warrior disappears into the logout abyss.',
  '🛌 At last, some peace.',
  '📴 The chaos has been successfully paused.',
  '🤫 The chat has returned to something resembling calm.',
  '🌿 Nature has restored balance.',
  '🏁 A fine example of responsible retreat.'
];

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
    if (!row) return;

    const channel = await client.channels.fetch(row.value);
    if (!channel) return;

    await channel.send({ embeds: [embed] });
  } catch (e) {
    console.log(`Failed to send embed for ${settingKey}`);
  }
}

async function checkCharacters(client) {
  const chars = db.prepare(`
    SELECT *
    FROM characters
    WHERE owner_discord_id IS NOT NULL
    AND account_group_id IS NOT NULL
  `).all();

  for (const ch of chars) {
    try {
      const data = await getCharacter(ch.name);
      const c = data?.character?.character;
      const deaths = data?.character?.deaths || [];
      const achievements = data?.character?.achievements || [];
      if (!c) continue;

      if (typeof ch.last_level === 'number' && ch.last_level > 0 && c.level > ch.last_level) {
        const levelEmbed = new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle('🎉 Level Up!')
          .setDescription(`**${c.name}** just went from **${ch.last_level}** to **${c.level}** on **${c.world}**.\n\n*${pickRandom(levelJokes)}*`)
          .addFields(
            { name: 'Character', value: c.name, inline: true },
            { name: 'World', value: c.world || 'Unknown', inline: true },
            { name: 'New Level', value: String(c.level), inline: true }
          )
          .setTimestamp();

        await sendEmbedToSetting(client, 'level_alert_channel_id', levelEmbed);
      }

      const latestDeath = deaths[0]?.time || deaths[0]?.date?.date || null;
      const latestDeathReason = deaths[0]?.reason || 'Unknown cause';
      const latestDeathLevel = deaths[0]?.level || c.level;

      if (latestDeath && latestDeath !== ch.last_death_time) {
        const deathEmbed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('💀 Character Death')
          .setDescription(`**${c.name}** died on **${c.world}**.\n\n**Cause:** ${latestDeathReason}\n*${pickRandom(deathJokes)}*`)
          .addFields(
            { name: 'Character', value: c.name, inline: true },
            { name: 'World', value: c.world || 'Unknown', inline: true },
            { name: 'Level at Death', value: String(latestDeathLevel), inline: true }
          )
          .setTimestamp();

        await sendEmbedToSetting(client, 'death_alert_channel_id', deathEmbed);

        db.prepare(`
          UPDATE characters
          SET death_count = COALESCE(death_count, 0) + 1
          WHERE name = ?
        `).run(ch.name);
      }

      const achievementHash = JSON.stringify(achievements);

      db.prepare(`
        UPDATE characters
        SET last_level = ?, last_death_time = ?, last_achievement_hash = ?
        WHERE name = ?
      `).run(c.level, latestDeath, achievementHash, ch.name);
    } catch (e) {
      console.log(`Failed to check ${ch.name}`);
    }
  }
}

async function checkOnline(client) {
  const chars = db.prepare(`
    SELECT name, world, last_online, online_since
    FROM characters
    WHERE owner_discord_id IS NOT NULL
    AND account_group_id IS NOT NULL
  `).all();

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

          db.prepare(`
            UPDATE characters
            SET last_online = 1, online_since = ?
            WHERE name = ?
          `).run(nowIso, ch.name);

          const onlineEmbed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🟢 Character Online')
            .setDescription(`**${ch.name}** is now online on **${ch.world}**.\n\n*${pickRandom(onlineJokes)}*`)
            .addFields(
              { name: 'Character', value: ch.name, inline: true },
              { name: 'World', value: ch.world || 'Unknown', inline: true },
              { name: 'Status', value: 'Online', inline: true }
            )
            .setTimestamp();

          await sendEmbedToSetting(client, 'online_alert_channel_id', onlineEmbed);
          continue;
        }

        if (isOnline === 0 && wasOnline === 1) {
          let sessionSeconds = 0;

          if (ch.online_since) {
            const started = new Date(ch.online_since).getTime();
            const ended = Date.now();
            if (!Number.isNaN(started) && ended > started) {
              sessionSeconds = Math.floor((ended - started) / 1000);
            }
          }

          db.prepare(`
            UPDATE characters
            SET last_online = 0,
                online_since = NULL,
                online_seconds = COALESCE(online_seconds, 0) + ?
            WHERE name = ?
          `).run(sessionSeconds, ch.name);

          const offlineEmbed = new EmbedBuilder()
            .setColor(0x747F8D)
            .setTitle('⚫ Character Offline')
            .setDescription(`**${ch.name}** just logged off from **${ch.world}** after **${formatDuration(sessionSeconds)}**.\n\n*${pickRandom(offlineJokes)}*`)
            .addFields(
              { name: 'Character', value: ch.name, inline: true },
              { name: 'World', value: ch.world || 'Unknown', inline: true },
              { name: 'Session', value: formatDuration(sessionSeconds), inline: true }
            )
            .setTimestamp();

          await sendEmbedToSetting(client, 'online_alert_channel_id', offlineEmbed);
          continue;
        }

        if (isOnline === wasOnline) {
          continue;
        }

        db.prepare(`
          UPDATE characters
          SET last_online = ?
          WHERE name = ?
        `).run(isOnline, ch.name);
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

    if (!items.length) {
      return;
    }

    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);

    for (const item of items) {
      const newsDate = new Date(item.date).getTime();

      if (Number.isNaN(newsDate) || newsDate < oneDayAgo) {
        continue;
      }

      const exists = db.prepare(`
        SELECT news_id
        FROM news_posts
        WHERE news_id = ?
      `).get(String(item.id));

      if (exists) {
        continue;
      }

      const newsEmbed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle('📰 New Tibia News')
        .setDescription(`**${item.title}**`)
        .addFields(
          { name: 'Date', value: item.date || 'Unknown', inline: true },
          { name: 'Source', value: 'tibia.com / TibiaData', inline: true }
        )
        .setURL(item.url || 'https://www.tibia.com/news/?subtopic=latestnews')
        .setTimestamp();

      await sendEmbedToSetting(client, 'news_alert_channel_id', newsEmbed);

      db.prepare(`
        INSERT INTO news_posts (news_id, title, published_at)
        VALUES (?, ?, ?)
      `).run(String(item.id), item.title, item.date || null);
    }
  } catch (e) {
    console.log('Failed news check');
  }
}

async function postWeeklyLeaderboards(client) {
  try {
    const row = db.prepare(`SELECT value FROM settings WHERE key = ?`).get('leaderboard_channel_id');
    if (!row) return;

    const channel = await client.channels.fetch(row.value);
    if (!channel) return;

    const levelRows = db.prepare(`
      SELECT name, world, last_level
      FROM characters
      WHERE owner_discord_id IS NOT NULL
      ORDER BY last_level DESC, name ASC
      LIMIT 10
    `).all();

    const deathRows = db.prepare(`
      SELECT name, world, death_count
      FROM characters
      WHERE owner_discord_id IS NOT NULL
      ORDER BY death_count DESC, name ASC
      LIMIT 10
    `).all();

    const onlineRows = db.prepare(`
      SELECT name, world, online_seconds
      FROM characters
      WHERE owner_discord_id IS NOT NULL
      ORDER BY online_seconds DESC, name ASC
      LIMIT 10
    `).all();

    const embed = new EmbedBuilder()
      .setColor(0xF1C40F)
      .setTitle('📊 Weekly Tibia Leaderboards')
      .setDescription('Here is this week’s scoreboard for tracked characters.')
      .addFields(
        {
          name: '🏆 Levels',
          value: levelRows.length
            ? levelRows.map((r, i) => `**${i + 1}.** ${r.name} (${r.world}) — Level ${r.last_level}`).join('\n')
            : 'No data yet.'
        },
        {
          name: '💀 Deaths',
          value: deathRows.length
            ? deathRows.map((r, i) => `**${i + 1}.** ${r.name} (${r.world}) — ${r.death_count || 0} deaths`).join('\n')
            : 'No data yet.'
        },
        {
          name: '🟢 Online Time',
          value: onlineRows.length
            ? onlineRows.map((r, i) => `**${i + 1}.** ${r.name} (${r.world}) — ${formatDuration(r.online_seconds || 0)}`).join('\n')
            : 'No data yet.'
        }
      )
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  } catch (e) {
    console.log('Failed to post weekly leaderboards');
  }
}

function startTrackers(client) {
  checkCharacters(client);
  checkOnline(client);
  checkNews(client);

  setInterval(() => checkCharacters(client), 10 * 60 * 1000);
  setInterval(() => checkOnline(client), 60 * 1000);
  setInterval(() => checkNews(client), 24 * 60 * 60 * 1000);

  schedule.scheduleJob(
    { rule: '0 12 * * 1', tz: 'Europe/London' },
    () => postWeeklyLeaderboards(client)
  );
}

module.exports = { startTrackers };