require('dotenv').config();

const { Client, GatewayIntentBits, ChannelType, Events, EmbedBuilder } = require('discord.js');
const db = require('./db');
const { getCharacter, getWorld, getLatestNews, getNewsArticle, getCreature } = require('./tibia');
const { startTrackers } = require('./tracker');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

function formatDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const levelUpMessages = [
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

const deathMessages = [
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

const onlineMessages = [
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

const offlineMessages = [
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

function formatNewsDate(newsItem) {
  return newsItem?.date?.date || newsItem?.published_date || 'Unknown date';
}

function formatNewsHeadline(newsItem) {
  return newsItem?.news || newsItem?.title || 'Untitled news';
}

function formatNewsUrl(newsItem) {
  return newsItem?.tibiaurl || newsItem?.url || newsItem?.apiurl || null;
}

client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}`);
  startTrackers(client);
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  try {
    await interaction.deferReply();

    if (interaction.commandName === 'claim') {
      const name = interaction.options.getString('name');
      const data = await getCharacter(name);
      const character = data?.character?.character;
      const otherCharacters =
        data?.character?.other_characters ||
        data?.character?.account_information?.characters ||
        [];

      if (!character) {
        await interaction.editReply('Character not found.');
        return;
      }

      db.prepare(`
        INSERT OR REPLACE INTO users (discord_id, discord_name)
        VALUES (?, ?)
      `).run(interaction.user.id, interaction.user.username);

      const existingMain = db.prepare(`
        SELECT account_group_id FROM characters
        WHERE owner_discord_id = ? AND is_main = 1
        LIMIT 1
      `).get(interaction.user.id);

      const groupId = existingMain?.account_group_id || `${interaction.user.id}:${character.name}`;

      db.prepare(`
        INSERT OR REPLACE INTO characters
        (name, world, owner_discord_id, account_group_id, is_main, last_level)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(character.name, character.world, interaction.user.id, groupId, 1, character.level);

      let linkedCount = 0;

      for (const c of otherCharacters) {
        const altName = c.name;
        const altWorld = c.world;

        if (!altName || !altWorld) continue;

        const alreadyExists = db.prepare(`SELECT name FROM characters WHERE LOWER(name) = LOWER(?)`).get(altName);

        db.prepare(`
          INSERT OR REPLACE INTO characters
          (name, world, owner_discord_id, account_group_id, is_main, last_level)
          VALUES (?, ?, ?, ?, ?, COALESCE((SELECT last_level FROM characters WHERE LOWER(name) = LOWER(?)), 0))
        `).run(altName, altWorld, interaction.user.id, groupId, altName.toLowerCase() === character.name.toLowerCase() ? 1 : 0, altName);

        if (!alreadyExists && altName.toLowerCase() !== character.name.toLowerCase()) {
          linkedCount++;
        }
      }

      if (linkedCount === 0) {
        await interaction.editReply(`Claimed ${character.name}. No public linked characters were visible on Tibia.`);
      } else {
        await interaction.editReply(`Claimed ${character.name} and linked ${linkedCount} visible characters.`);
      }
      return;
    }

    if (interaction.commandName === 'linkalt') {
      const name = interaction.options.getString('name');
      const data = await getCharacter(name);
      const character = data?.character?.character;

      if (!character) {
        await interaction.editReply('Character not found.');
        return;
      }

      const existingMain = db.prepare(`
        SELECT account_group_id FROM characters
        WHERE owner_discord_id = ? AND is_main = 1
        LIMIT 1
      `).get(interaction.user.id);

      if (!existingMain) {
        await interaction.editReply('You need to use /claim on your main character first.');
        return;
      }

      const claimedBySomeoneElse = db.prepare(`
        SELECT owner_discord_id FROM characters WHERE LOWER(name) = LOWER(?)
      `).get(character.name);

      if (claimedBySomeoneElse && claimedBySomeoneElse.owner_discord_id !== interaction.user.id) {
        await interaction.editReply('That character is already linked to another Discord user.');
        return;
      }

      db.prepare(`
        INSERT OR REPLACE INTO characters
        (name, world, owner_discord_id, account_group_id, is_main, last_level)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        character.name,
        character.world,
        interaction.user.id,
        existingMain.account_group_id,
        0,
        character.level
      );

      await interaction.editReply(`Linked alt ${character.name} on ${character.world}.`);
      return;
    }

    if (interaction.commandName === 'unlink') {
      const name = interaction.options.getString('name');

      const characterRow = db.prepare(`
        SELECT name, is_main, account_group_id
        FROM characters
        WHERE owner_discord_id = ? AND LOWER(name) = LOWER(?)
        LIMIT 1
      `).get(interaction.user.id, name);

      if (!characterRow) {
        await interaction.editReply('That character is not linked to your Discord account.');
        return;
      }

      if (characterRow.is_main) {
        const otherLinked = db.prepare(`
          SELECT name
          FROM characters
          WHERE owner_discord_id = ?
          AND account_group_id = ?
          AND LOWER(name) != LOWER(?)
          ORDER BY name ASC
          LIMIT 1
        `).get(interaction.user.id, characterRow.account_group_id, characterRow.name);

        if (otherLinked) {
          db.prepare(`
            UPDATE characters
            SET is_main = 1
            WHERE owner_discord_id = ?
            AND LOWER(name) = LOWER(?)
          `).run(interaction.user.id, otherLinked.name);
        }
      }

      db.prepare(`
        DELETE FROM characters
        WHERE owner_discord_id = ? AND LOWER(name) = LOWER(?)
      `).run(interaction.user.id, name);

      const remaining = db.prepare(`
        SELECT COUNT(*) AS count
        FROM characters
        WHERE owner_discord_id = ?
        AND account_group_id = ?
      `).get(interaction.user.id, characterRow.account_group_id);

      if (!remaining || remaining.count === 0) {
        await interaction.editReply(`Unlinked ${characterRow.name}. You now have no linked characters in that account group.`);
      } else if (characterRow.is_main) {
        const newMain = db.prepare(`
          SELECT name
          FROM characters
          WHERE owner_discord_id = ?
          AND account_group_id = ?
          AND is_main = 1
          LIMIT 1
        `).get(interaction.user.id, characterRow.account_group_id);

        await interaction.editReply(`Unlinked ${characterRow.name}. Your new main character is ${newMain?.name || 'another linked character'}.`);
      } else {
        await interaction.editReply(`Unlinked ${characterRow.name}.`);
      }

      return;
    }

    if (interaction.commandName === 'unlinkall') {
      const rows = db.prepare(`
        SELECT name
        FROM characters
        WHERE owner_discord_id = ?
        ORDER BY is_main DESC, name ASC
      `).all(interaction.user.id);

      if (!rows.length) {
        await interaction.editReply('You have no linked characters to remove.');
        return;
      }

      const result = db.prepare(`
        DELETE FROM characters
        WHERE owner_discord_id = ?
      `).run(interaction.user.id);

      await interaction.editReply(`Removed all linked characters from your account (${result.changes} removed).`);
      return;
    }

    if (interaction.commandName === 'mychars') {
      const rows = db.prepare(`
        SELECT name, world, is_main
        FROM characters
        WHERE owner_discord_id = ?
        ORDER BY is_main DESC, name ASC
      `).all(interaction.user.id);

      if (!rows.length) {
        await interaction.editReply('You have no claimed characters.');
        return;
      }

      const text = rows.map(r => `- ${r.name} (${r.world})${r.is_main ? ' [MAIN]' : ''}`).join('\n');
      await interaction.editReply(`Your linked characters:\n${text}`);
      return;
    }

    if (interaction.commandName === 'online') {
      const name = interaction.options.getString('name');
      const row = db.prepare(`SELECT name, world FROM characters WHERE LOWER(name) = LOWER(?)`).get(name);

      if (!row) {
        await interaction.editReply('That character is not in the bot database yet.');
        return;
      }

      const worldData = await getWorld(row.world);
      const players = worldData?.world?.online_players || [];
      const online = players.some(p => p.name.toLowerCase() === row.name.toLowerCase());

      await interaction.editReply(`${row.name} is currently ${online ? 'ONLINE' : 'OFFLINE'} on ${row.world}.`);
      return;
    }

    if (interaction.commandName === 'latestnews') {
      const newsData = await getLatestNews();
      const items = newsData?.news || [];

      if (!items.length) {
        await interaction.editReply('No news found.');
        return;
      }

      const lines = items.slice(0, 5).map((n, index) => {
        const headline = formatNewsHeadline(n);
        const date = formatNewsDate(n);
        const id = n.id || 'N/A';
        const url = formatNewsUrl(n);
        return `**${index + 1}.** ${headline}\nID: ${id} • Date: ${date}${url ? `\n${url}` : ''}`;
      }).join('\n\n');

      const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle('📰 Latest Tibia News')
        .setDescription(lines)
        .setFooter({ text: 'Use /newsarticle id:<id> to view one article.' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (interaction.commandName === 'newsarticle') {
      const id = interaction.options.getString('id');
      const articleData = await getNewsArticle(id);
      const article = articleData?.news;

      if (!article) {
        await interaction.editReply(`No news article found for ID ${id}.`);
        return;
      }

      const title = article.title || article.news || `News ${id}`;
      const date = article.date?.date || article.published_date || 'Unknown date';
      const content = article.content || article.text || article.body || 'No article text was returned.';
      const trimmedContent = content.length > 3500 ? `${content.slice(0, 3497)}...` : content;
      const articleUrl = article.tibiaurl || article.url || article.apiurl || null;
      const articleType = article.type || 'News';

      const embed = new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle(`🗞️ ${title}`)
        .setDescription(trimmedContent)
        .addFields(
          { name: 'ID', value: String(id), inline: true },
          { name: 'Date', value: date, inline: true },
          { name: 'Type', value: articleType, inline: true }
        )
        .setTimestamp();

      if (articleUrl) {
        embed.addFields({ name: 'Link', value: articleUrl });
      }

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (interaction.commandName === 'monster') {
      const name = interaction.options.getString('name');
      const data = await getCreature(name);
      const creature = data?.creature;

      if (!creature) {
        await interaction.editReply(`No monster found for "${name}".`);
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x8B5CF6)
        .setTitle(`📘 ${creature.name || name}`)
        .setDescription(creature.description || 'Bestiary entry found.')
        .addFields(
          { name: 'Race', value: creature.race || 'Unknown', inline: true },
          { name: 'Hitpoints', value: String(creature.hitpoints || 'Unknown'), inline: true },
          { name: 'Experience', value: String(creature.experience_points || creature.experience || 'Unknown'), inline: true }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (interaction.commandName === 'leaderboard') {
      const type = interaction.options.getString('type');
      let rows = [];
      let title = '';
      let description = '';

      if (type === 'level') {
        rows = db.prepare(`
          SELECT name, world, last_level
          FROM characters
          WHERE owner_discord_id IS NOT NULL
          ORDER BY last_level DESC, name ASC
          LIMIT 10
        `).all();

        title = '🏆 Level Leaderboard';
        description = rows.map((r, i) => `**${i + 1}.** ${r.name} (${r.world}) — Level ${r.last_level}`).join('\n');
      }

      if (type === 'deaths') {
        rows = db.prepare(`
          SELECT name, world, death_count
          FROM characters
          WHERE owner_discord_id IS NOT NULL
          ORDER BY death_count DESC, name ASC
          LIMIT 10
        `).all();

        title = '💀 Death Leaderboard';
        description = rows.map((r, i) => `**${i + 1}.** ${r.name} (${r.world}) — ${r.death_count || 0} deaths`).join('\n');
      }

      if (type === 'online') {
        rows = db.prepare(`
          SELECT name, world, online_seconds
          FROM characters
          WHERE owner_discord_id IS NOT NULL
          ORDER BY online_seconds DESC, name ASC
          LIMIT 10
        `).all();

        title = '🟢 Online Time Leaderboard';
        description = rows.map((r, i) => `**${i + 1}.** ${r.name} (${r.world}) — ${formatDuration(r.online_seconds || 0)}`).join('\n');
      }

      if (!rows.length) {
        await interaction.editReply('No leaderboard data yet.');
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTitle(title)
        .setDescription(description)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (interaction.commandName === 'setlevelchannel') {
      const channel = interaction.options.getChannel('channel');
      if (!channel || channel.type !== ChannelType.GuildText) {
        await interaction.editReply('Please choose a normal text channel for level alerts.');
        return;
      }

      db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`).run('level_alert_channel_id', channel.id);
      await interaction.editReply(`Level-up alerts will now be posted in <#${channel.id}>.`);
      return;
    }

    if (interaction.commandName === 'setdeathchannel') {
      const channel = interaction.options.getChannel('channel');
      if (!channel || channel.type !== ChannelType.GuildText) {
        await interaction.editReply('Please choose a normal text channel for death alerts.');
        return;
      }

      db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`).run('death_alert_channel_id', channel.id);
      await interaction.editReply(`Death alerts will now be posted in <#${channel.id}>.`);
      return;
    }

    if (interaction.commandName === 'setonlinechannel') {
      const channel = interaction.options.getChannel('channel');
      if (!channel || channel.type !== ChannelType.GuildText) {
        await interaction.editReply('Please choose a normal text channel for online alerts.');
        return;
      }

      db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`).run('online_alert_channel_id', channel.id);
      await interaction.editReply(`Online notifications will now be posted in <#${channel.id}>.`);
      return;
    }

    if (interaction.commandName === 'setnewschannel') {
      const channel = interaction.options.getChannel('channel');
      if (!channel || channel.type !== ChannelType.GuildText) {
        await interaction.editReply('Please choose a normal text channel for news alerts.');
        return;
      }

      db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`).run('news_alert_channel_id', channel.id);
      await interaction.editReply(`Tibia news updates will now be posted in <#${channel.id}>.`);
      return;
    }

    if (interaction.commandName === 'setleaderboardchannel') {
      const channel = interaction.options.getChannel('channel');
      if (!channel || channel.type !== ChannelType.GuildText) {
        await interaction.editReply('Please choose a normal text channel for leaderboard posts.');
        return;
      }

      db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`).run('leaderboard_channel_id', channel.id);
      await interaction.editReply(`Weekly leaderboard posts will now be sent to <#${channel.id}> every Monday at 12:00 PM Europe/London.`);
      return;
    }

    await interaction.editReply('Unknown command.');
  } catch (error) {
    console.error(error);

    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply('Something went wrong.');
      } else {
        await interaction.reply({ content: 'Something went wrong.' });
      }
    } catch (replyError) {
      console.error('Failed to send error reply:', replyError);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);