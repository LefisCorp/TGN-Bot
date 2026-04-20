require('dotenv').config();

const { Client, GatewayIntentBits, ChannelType, Events, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const schedule = require('node-schedule');
const db = require('./db');
const { getCharacter, getWorld, getLatestNews, getNewsArticle, getCreature } = require('./tibia');
const { startTrackers } = require('./tracker');


const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent 
  ]
});

function formatDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}`);
  startTrackers(client);
});

client.on(Events.GuildMemberRemove, async member => {
  try {
    db.prepare(`DELETE FROM characters WHERE owner_discord_id = ?`).run(member.id);
  } catch (error) {
    console.error('Failed to clean up removed member:', error);
  }
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  try {
    await interaction.deferReply();

    // --- CLAIM COMMAND (Main + Auto Alt Discovery) ---
    if (interaction.commandName === 'claim') {
      const name = interaction.options.getString('name');
      const data = await getCharacter(name);
      const character = data?.character?.character;
      
      const otherCharacters = data?.character?.other_characters || 
                              data?.character?.account_information?.characters || [];
        
      if (!character) {
        await interaction.editReply('Character not found.');
        return;
      }

      db.prepare(`INSERT OR REPLACE INTO users (discord_id, discord_name) VALUES (?, ?)`).run(interaction.user.id, interaction.user.username);

      const existingMain = db.prepare(`SELECT account_group_id FROM characters WHERE owner_discord_id = ? AND is_main = 1 LIMIT 1`).get(interaction.user.id);
      const groupId = existingMain?.account_group_id || `${interaction.user.id}:${character.name}`;

      db.prepare(`INSERT OR REPLACE INTO characters (name, world, owner_discord_id, account_group_id, is_main, last_level) VALUES (?, ?, ?, ?, ?, ?)`).run(character.name, character.world, interaction.user.id, groupId, 1, character.level);

      let linkedCount = 0;
      for (const c of otherCharacters) {
        const altName = c.name;
        const altWorld = c.world || character.world; 
        const altLevel = Number(c.level) || 0; 

        if (!altName) continue;

        db.prepare(`
          INSERT OR REPLACE INTO characters (name, world, owner_discord_id, account_group_id, is_main, last_level) 
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          altName, 
          altWorld, 
          interaction.user.id, 
          groupId, 
          (altName.toLowerCase() === character.name.toLowerCase() ? 1 : 0), 
          altLevel
        );

        if (altName.toLowerCase() !== character.name.toLowerCase()) {
            linkedCount++;
        }
      }

      await interaction.editReply(`Claimed **${character.name}** and updated **${linkedCount}** associated characters.`);
      return;
    }

const channelSetters = ['setlevelchannel', 'setdeathchannel', 'setonlinechannel', 'setnewschannel', 'setleaderboardchannel'];
    if (channelSetters.includes(interaction.commandName)) {
        // SECURITY CHECK: Only allow Administrators to run these
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.editReply("❌ You need **Administrator** permissions to change bot settings!");
        }

        const keyMap = {
            'setlevelchannel': 'level_alert_channel_id',
            'setdeathchannel': 'death_alert_channel_id',
            'setonlinechannel': 'online_alert_channel_id',
            'setnewschannel': 'news_alert_channel_id',
            'setleaderboardchannel': 'leaderboard_channel_id'
        };
        const channel = interaction.options.getChannel('channel');
        db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`).run(keyMap[interaction.commandName], channel.id);
        return interaction.editReply(`✅ Channel set to <#${channel.id}>. Only Admins can change this.`);
    }

if (interaction.commandName === 'item') {
  const name = interaction.options.getString('name');
  // Format for TibiaWiki URL
  const wikiName = name.split(' ').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join('_');

  const embed = new EmbedBuilder()
    .setTitle(`🔍 Wiki Lookup: ${name}`)
    .setColor(0xF1C40F)
    .setDescription(`🔗 **[View "${name}" on TibiaWiki](https://tibia.fandom.com/wiki/${wikiName})**`);

  return interaction.editReply({ embeds: [embed] });
}

    // --- MANUAL REFRESH COMMAND (New Addition) ---
    if (interaction.commandName === 'refresh') {
      const zeroChars = db.prepare('SELECT name FROM characters WHERE last_level = 0').all();

      if (zeroChars.length === 0) {
        return interaction.editReply('No characters with Level 0 found in the database.');
      }

      await interaction.editReply(`🔄 Found **${zeroChars.length}** characters to repair. Starting deep scan...`);
      await refreshZeroLevels(); // Runs the repair function defined at the bottom
      return interaction.followUp('✅ Deep scan complete. All levels have been updated!');
    }

    // --- LINKALT COMMAND (Manual Add) ---
    if (interaction.commandName === 'linkalt') {
      const name = interaction.options.getString('name');
      const data = await getCharacter(name);
      const character = data?.character?.character;

      if (!character) return interaction.editReply('Character not found.');

      const existingMain = db.prepare(`SELECT account_group_id FROM characters WHERE owner_discord_id = ? AND is_main = 1 LIMIT 1`).get(interaction.user.id);
      if (!existingMain) return interaction.editReply('Please use `/claim` on your main character first.');

      db.prepare(`INSERT OR REPLACE INTO characters (name, world, owner_discord_id, account_group_id, is_main, last_level) VALUES (?, ?, ?, ?, ?, ?)`).run(character.name, character.world, interaction.user.id, existingMain.account_group_id, 0, character.level);
      
      await interaction.editReply(`Successfully linked alt **${character.name}**.`);
      return;
    }

    // --- MYCHARS COMMAND ---
    if (interaction.commandName === 'mychars') {
      const rows = db.prepare(`
        SELECT name, world, last_level, is_main 
        FROM characters 
        WHERE owner_discord_id = ? 
        ORDER BY is_main DESC, last_level DESC
      `).all(interaction.user.id);

      if (!rows.length) {
        return interaction.editReply('You have no characters linked to your account. Use `/claim` to add one!');
      }

      const embed = new EmbedBuilder()
        .setTitle(`👤 Linked Characters: ${interaction.user.username}`)
        .setColor(0x2ECC71)
        .setDescription(rows.map(r => 
          `${r.is_main ? '⭐' : '•'} **${r.name}** (${r.world}) — Lvl ${r.last_level}`
        ).join('\n'))
        .setFooter({ text: 'Use /claim to link more characters.' });

      return interaction.editReply({ embeds: [embed] });
    }

    // --- UNLINK COMMANDS ---
    if (interaction.commandName === 'unlink') {
      const charName = interaction.options.getString('name');
      const result = db.prepare(`DELETE FROM characters WHERE LOWER(name) = LOWER(?) AND owner_discord_id = ?`).run(charName, interaction.user.id);
      if (result.changes === 0) return interaction.editReply(`Could not find a character named **${charName}** linked to your account.`);
      await interaction.editReply(`Successfully unlinked **${charName}**.`);
      return;
    }

    if (interaction.commandName === 'unlinkall') {
      const result = db.prepare(`DELETE FROM characters WHERE owner_discord_id = ?`).run(interaction.user.id);
      if (result.changes === 0) return interaction.editReply('You have no characters to unlink.');
      await interaction.editReply(`Successfully unlinked all ${result.changes} characters from your account.`);
      return;
    }

    // --- MONSTER COMMAND (Lore & Stats Fix) ---
    if (interaction.commandName === 'monster') {
      const monsterName = interaction.options.getString('name');
      const data = await getCreature(monsterName);
      const monster = data?.creature;

      if (!monster) return interaction.editReply(`Could not find Bestiary info for **${monsterName}**.`);

      const embed = new EmbedBuilder()
        .setTitle(monster.name)
        .setColor(0x2ECC71)
        .setThumbnail(monster.image_url)
        .setDescription(monster.description || 'No description available.')
        .addFields(
          { name: 'Race', value: monster.race || 'Unknown', inline: false },
          { name: 'Hitpoints', value: `${monster.hitpoints || '0'}`, inline: false },
          // Check multiple experience fields to ensure it is not 0
          { name: 'Experience', value: `${monster.experience_points || monster.experience || '0'}`, inline: false }
        )
        .setFooter({ 
          text: new Date().toLocaleString('en-GB', { 
            day: '2-digit', month: '2-digit', year: 'numeric', 
            hour: '2-digit', minute: '2-digit', hour12: false 
          }).replace(',', '')
        });

      return interaction.editReply({ embeds: [embed] });
    }

    // --- ONLINE COMMAND ---
    if (interaction.commandName === 'online') {
      const charName = interaction.options.getString('name');
      const data = await getCharacter(charName);
      const char = data?.character?.character;

      if (!char) return interaction.editReply('Character not found.');
      
      const isOnline = char.status === 'online';
      const embed = new EmbedBuilder()
        .setTitle(char.name)
        .setColor(isOnline ? 0x2ECC71 : 0xE74C3C)
        .setDescription(`Status: **${isOnline ? '🟢 Online' : '🔴 Offline'}**\nWorld: ${char.world}\nLevel: ${char.level}`);

      return interaction.editReply({ embeds: [embed] });
    }

    // --- NEWS COMMANDS ---
    if (interaction.commandName === 'latestnews') {
      const data = await getLatestNews();
      const news = data?.news?.slice(0, 5) || [];
      if (!news.length) return interaction.editReply('No recent news found.');

      const embed = new EmbedBuilder()
        .setTitle('📰 Latest Tibia News')
        .setColor(0x3498DB)
        .setDescription(news.map(n => `**[${n.date}]** ${n.news} (ID: \`${n.id}\`)`).join('\n\n'));

      return interaction.editReply({ embeds: [embed] });
    }

    if (interaction.commandName === 'newsarticle') {
      const id = interaction.options.getString('id');
      const data = await getNewsArticle(id);
      const article = data?.news;
      if (!article) return interaction.editReply('Article not found.');

      const embed = new EmbedBuilder()
        .setTitle(article.title || 'Tibia News')
        .setColor(0x3498DB)
        .setDescription(article.content?.substring(0, 2048) || 'No content.')
        .setFooter({ text: `Published: ${article.date}` });

      return interaction.editReply({ embeds: [embed] });
    }

    // --- GAINS & LEADERBOARD ---
    if (interaction.commandName === 'gains') {
      const timeframe = interaction.options.getString('timeframe');
      const column = timeframe === 'daily' ? 'daily_level_start' : 'weekly_level_start';
      const rows = db.prepare(`SELECT name, world, last_level, (last_level - ${column}) as gained FROM characters WHERE owner_discord_id IS NOT NULL AND (last_level - ${column}) > 0 ORDER BY gained DESC LIMIT 10`).all();

      if (!rows.length) return interaction.editReply(`No ${timeframe} gains recorded yet.`);

      const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle(`📈 Top ${timeframe.charAt(0).toUpperCase() + timeframe.slice(1)} Level Gains`)
        .setDescription(rows.map((r, i) => `**${i + 1}.** ${r.name} (${r.world}): **+${r.gained}** levels`).join('\n'));
      return interaction.editReply({ embeds: [embed] });
    }

    if (interaction.commandName === 'leaderboard') {
      const type = interaction.options.getString('type');
      let rows = [], title = '';

      if (type === 'level') {
        rows = db.prepare(`SELECT name, world, last_level FROM characters WHERE owner_discord_id IS NOT NULL ORDER BY last_level DESC LIMIT 10`).all();
        title = '🏆 Level Leaderboard';
      } else if (type === 'deaths') {
        rows = db.prepare(`SELECT name, world, death_count FROM characters WHERE owner_discord_id IS NOT NULL ORDER BY death_count DESC LIMIT 10`).all();
        title = '💀 Death Leaderboard';
      } else if (type === 'online') { // --- ADD THIS BLOCK ---
        rows = db.prepare(`SELECT name, world, online_seconds FROM characters WHERE owner_discord_id IS NOT NULL AND online_seconds > 0 ORDER BY online_seconds DESC LIMIT 10`).all();
        title = '🏃 Online Time Leaderboard';
      }

      if (!rows.length) return interaction.editReply(`No leaderboard data yet for ${type}.`);

      const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTitle(title)
        .setDescription(rows.map((r, i) => {
            if (type === 'level') return `**${i + 1}.** ${r.name} — Lvl ${r.last_level}`;
            if (type === 'deaths') return `**${i + 1}.** ${r.name} — ${r.death_count} deaths`;
            if (type === 'online') return `**${i + 1}.** ${r.name} — ${formatDuration(r.online_seconds)}`; //
        }).join('\n'));

      return interaction.editReply({ embeds: [embed] });
    }
    // --- SETTINGS ---
    if (interaction.commandName === 'settings') {
      const settings = db.prepare('SELECT key, value FROM settings').all();
      const getVal = (key) => settings.find(s => s.key === key)?.value;

      const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle('⚙️ Bot Settings')
        .addFields(
          { name: 'Levels', value: getVal('level_alert_channel_id') ? `<#${getVal('level_alert_channel_id')}>` : 'Not set', inline: true },
          { name: 'Deaths', value: getVal('death_alert_channel_id') ? `<#${getVal('death_alert_channel_id')}>` : 'Not set', inline: true },
          { name: 'Online', value: getVal('online_alert_channel_id') ? `<#${getVal('online_alert_channel_id')}>` : 'Not set', inline: true },
          { name: 'News', value: getVal('news_alert_channel_id') ? `<#${getVal('news_alert_channel_id')}>` : 'Not set', inline: true },
          { name: 'Leaderboard', value: getVal('leaderboard_channel_id') ? `<#${getVal('leaderboard_channel_id')}>` : 'Not set', inline: true }
        );
      return interaction.editReply({ embeds: [embed] });
    }

  
    await interaction.editReply('Unknown command.');
  } catch (error) {
    console.error(error);
    if (interaction.deferred) await interaction.editReply('Something went wrong.');
  }
});

async function refreshZeroLevels() {
    const zeroChars = db.prepare('SELECT name FROM characters WHERE last_level = 0').all();
    
    for (const char of zeroChars) {
        console.log(`Refreshing data for: ${char.name}`);
        const data = await getCharacter(char.name);
        const level = data?.character?.character?.level;

        if (level) {
            db.prepare('UPDATE characters SET last_level = ? WHERE name = ?').run(level, char.name);
            console.log(`Updated ${char.name} to Level ${level}`);
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
}

schedule.scheduleJob('*/10 * * * *', refreshZeroLevels);

client.login(process.env.DISCORD_TOKEN);