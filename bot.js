require('dotenv').config();

const { Client, GatewayIntentBits, ChannelType, Events, EmbedBuilder } = require('discord.js');
const schedule = require('node-schedule');
const db = require('./db');
const { getCharacter, getWorld, getLatestNews, getNewsArticle, getCreature } = require('./tibia');
const { startTrackers } = require('./tracker');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent // Required to read reaction data on older messages
  ]
});

function formatDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ... (Messages arrays: levelUpMessages, deathMessages, etc. remain unchanged)

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

client.on(Events.GuildMemberRemove, async member => {
  try {
    db.prepare(`
      DELETE FROM characters
      WHERE owner_discord_id = ?
    `).run(member.id);
  } catch (error) {
    console.error('Failed to clean up removed member:', error);
  }
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
      
      // Improved check: Use newsData.news OR newsData itself if it's an array
      const items = newsData?.news || (Array.isArray(newsData) ? newsData : []);

      if (!items.length) {
        await interaction.editReply('No news found. The TibiaData API might be empty or responding differently.');
        return;
      }

      const lines = items.slice(0, 5).map((n, index) => {
        const headline = formatNewsHeadline(n);
        const date = formatNewsDate(n);
        const id = n.id || 'N/A';
        const url = formatNewsUrl(n);
        // Clean up the output formatting
        return `**${index + 1}.** ${headline}\nID: \`${id}\` • Date: ${date}${url ? `\n[Read More](${url})` : ''}`;
      }).join('\n\n');

      const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle('📰 Latest Tibia News')
        .setDescription(lines)
        .setFooter({ text: 'Use /newsarticle id:<id> to view a specific article.' })
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
        .setTitle(`📖 ${creature.name || name}`)
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

    if (interaction.commandName === 'settings') {
      const settings = db.prepare('SELECT key, value FROM settings').all();
      const guildId = interaction.guild?.id || 'N/A';

      const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle('⚙️ Bot Settings')
        .setDescription(`Current configuration for **${interaction.guild?.name || 'this server'}** (${guildId})`)
        .addFields(
          { name: 'Level Alerts', value: `<#${settings.find(s => s.key === 'level_alert_channel_id')?.value || 'Not set'}>`, inline: true },
          { name: 'Death Alerts', value: `<#${settings.find(s => s.key === 'death_alert_channel_id')?.value || 'Not set'}>`, inline: true },
          { name: 'Online Alerts', value: `<#${settings.find(s => s.key === 'online_alert_channel_id')?.value || 'Not set'}>`, inline: true },
          { name: 'News Alerts', value: `<#${settings.find(s => s.key === 'news_alert_channel_id')?.value || 'Not set'}>`, inline: true },
          { name: 'Leaderboard', value: `<#${settings.find(s => s.key === 'leaderboard_channel_id')?.value || 'Not set'}>`, inline: true },
          { name: 'Tracked Characters', value: String(db.prepare('SELECT COUNT(*) as count FROM characters WHERE owner_discord_id IS NOT NULL').get().count), inline: true }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (interaction.commandName === 'subscriptions') {
  // We query all subscriptions and group them by type first
  const subs = db.prepare(`
    SELECT type, COUNT(*) as count 
    FROM subscriptions 
    GROUP BY type
  `).all();

  if (!subs.length) {
    await interaction.editReply('No subscriptions yet. Use the subscription message to react!');
    return;
  }

      const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle('📊 Subscription Statistics')
    .setDescription('Current number of users subscribed to each alert type:')
    .addFields(
      subs.map(s => ({ 
        // Capitalizes the first letter (e.g., 'news' becomes 'News')
        name: s.type.charAt(0).toUpperCase() + s.type.slice(1), 
        value: `**${s.count}** users`, 
        inline: true 
      }))
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
  return;
}

    if (interaction.commandName === 'setsubscriptionschannel') {
  const channel = interaction.options.getChannel('channel');
  if (!channel || channel.type !== ChannelType.GuildText) {
    await interaction.editReply('Please choose a normal text channel for subscriptions.');
    return;
  }

  db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`).run('subscriptions_channel_id', channel.id);

  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle('🔔 Tibia Character Subscriptions')
    // Update the description to include News
    .setDescription('React below to subscribe to updates:\n\n' +
      '⚔️ **Level-ups** | 💀 **Deaths** | 🟢 **Online/Offline** | 📰 **Tibia News**')
    .addFields(
      { name: 'How it works', value: 'Click the emojis below to toggle your subscriptions.', inline: false }
    );

  const message = await channel.send({ embeds: [embed] });
  
  // Add the reactions
  await message.react('⚔️');
  await message.react('💀');
  await message.react('🟢');
  await message.react('📰'); // ADD THIS LINE for the news button

  await interaction.editReply(`Subscription message posted in <#${channel.id}>!`);
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

client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (user.bot) return;

  // If the message is not cached, fetch it
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (error) {
      console.error('Something went wrong when fetching the message:', error);
      return;
    }
  }

  // Determine the subscription type based on emoji
  let type = '';
  if (reaction.emoji.name === '⚔️') type = 'Level-up';
  if (reaction.emoji.name === '💀') type = 'Death';
  if (reaction.emoji.name === '🟢') type = 'Online';
  if (reaction.emoji.name === '📰') subType = 'news';

  if (type) {
    // Note: You'll need a way to determine WHICH character they are subbing to.
    // For now, this adds a generic subscription to the database.
    db.prepare(`
      INSERT INTO subscriptions (guild_id, user_id, type, character_name)
      VALUES (?, ?, ?, ?)
    `).run(reaction.message.guildId, user.id, type, 'Global'); 
    
    console.log(`Saved ${type} subscription for ${user.username}`);
  }
});

client.on(Events.MessageReactionRemove, async (reaction, user) => {
  if (user.bot) return;

  let subType = null;
  if (reaction.emoji.name === '⚔️') subType = 'level';
  if (reaction.emoji.name === '💀') subType = 'death';
  if (reaction.emoji.name === '🟢') subType = 'online';
  if (reaction.emoji.name === '📰') subType = 'news';

  if (subType) {
    db.prepare(`
      DELETE FROM subscriptions 
      WHERE user_id = ? AND type = ? AND guild_id = ?
    `).run(user.id, subType, reaction.message.guildId);
    
    console.log(`User ${user.username} unsubscribed from ${subType} alerts.`);
  }
});

async function announceWeeklyMVPs(client) {
  try {
    // 1. Get the channel ID from settings
    const channelIdRow = db.prepare("SELECT value FROM settings WHERE key = 'leaderboard_channel_id'").get();
    const channelId = channelIdRow?.value;
    
    if (!channelId) {
      console.log('MVP Error: No leaderboard channel set.');
      return;
    }

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) return;

    // 2. Identify the Level Gainer MVP
    const topGainer = db.prepare(`
      SELECT name, (last_level - weekly_level_start) as gained 
      FROM characters 
      WHERE owner_discord_id IS NOT NULL 
      ORDER BY gained DESC LIMIT 1
    `).get();

    // 3. Identify the "Floor Inspector" (Most Deaths)
    const topRipper = db.prepare(`
      SELECT name, (death_count - weekly_death_start) as deaths 
      FROM characters 
      WHERE owner_discord_id IS NOT NULL 
      ORDER BY deaths DESC LIMIT 1
    `).get();

    // 4. Build the Embed
    const embed = new EmbedBuilder()
      .setColor(0xF1C40F)
      .setTitle('🏆 Weekly TGN MVP Awards')
      .setDescription('The weekly summary is in! Here are the legends of the last 7 days:')
      .addFields(
        { 
          name: '👑 The Grinder (Most Levels)', 
          value: topGainer?.gained > 0 
            ? `**${topGainer.name}** gained **+${topGainer.gained}** levels! 🚀` 
            : 'No levels gained this week. Go hunt something!', 
          inline: false 
        },
        { 
          name: '💀 The Floor Inspector (Most Deaths)', 
          value: topRipper?.deaths > 0 
            ? `**${topRipper.name}** died **${topRipper.deaths}** times. Bless their soul.` 
            : 'Incredible! Zero deaths recorded this week.', 
          inline: false 
        }
      )
      .setFooter({ text: 'Weekly stats have been reset for the new week.' })
      .setTimestamp();

    await channel.send({ embeds: [embed] });

    // 5. THE MOST IMPORTANT PART: Reset the Start Points
    // This updates the "start" columns to current totals so next Sunday's math is correct.
    db.prepare(`
      UPDATE characters 
      SET weekly_level_start = last_level, 
          weekly_death_start = death_count
    `).run();

    console.log('Weekly MVP Awards successfully posted and database reset.');
  } catch (err) {
    console.error('Error in Weekly MVP process:', err);
  }
}

schedule.scheduleJob('59 23 * * 0', async () => {
  await announceWeeklyMVPs(client);
});

// This runs every Sunday at 10:00 PM (22:00)
schedule.scheduleJob('0 22 * * 0', async () => {
  console.log('Running Weekly MVP Awards...');
  await announceWeeklyMVPs(client); 
});

client.login(process.env.DISCORD_TOKEN);