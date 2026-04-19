const db = require('./db');
const { EmbedBuilder } = require('discord.js');

async function announceWeeklyMVPs(client) {
  const channelId = db.prepare("SELECT value FROM settings WHERE key = 'leaderboard_channel_id'").get()?.value;
  if (!channelId) return;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) return;

  // 1. Find Top Level Gainer
  const topGainer = db.prepare(`
    SELECT name, (last_level - weekly_level_start) as gained 
    FROM characters 
    WHERE owner_discord_id IS NOT NULL 
    ORDER BY gained DESC LIMIT 1
  `).get();

  // 2. Find Most Dangerous (Most Deaths)
  const topRipper = db.prepare(`
    SELECT name, (death_count - weekly_death_start) as deaths 
    FROM characters 
    WHERE owner_discord_id IS NOT NULL 
    ORDER BY deaths DESC LIMIT 1
  `).get();

  const embed = new EmbedBuilder()
    .setColor(0xF1C40F)
    .setTitle('🏆 Weekly TGN MVP Awards')
    .setDescription('Another week of grinding is in the books! Here are your champions:')
    .addFields(
      { 
        name: '👑 The Grinder (Most Levels)', 
        value: topGainer?.gained > 0 ? `**${topGainer.name}** with **+${topGainer.gained}** levels!` : 'No levels gained this week.', 
        inline: false 
      },
      { 
        name: '💀 The Floor Inspector (Most Deaths)', 
        value: topRipper?.deaths > 0 ? `**${topRipper.name}** with **${topRipper.deaths}** deaths. Ouch.` : 'A miracle! No one died.', 
        inline: false 
      }
    )
    .setFooter({ text: 'Stats have been reset for the new week!' })
    .setTimestamp();

  await channel.send({ embeds: [embed] });

  // 3. Reset the "Start" values for next week
  db.prepare(`
    UPDATE characters 
    SET weekly_level_start = last_level, 
        weekly_death_start = death_count
  `).run();
}