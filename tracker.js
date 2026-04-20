const { EmbedBuilder } = require('discord.js');
const schedule = require('node-schedule');
const db = require('./db');
const { getCharacter, getWorld, getLatestNews } = require('./tibia');

// --- PREPARED STATEMENTS ---
const stmts = {
  getTrackedWorlds: db.prepare(`SELECT DISTINCT world FROM characters WHERE owner_discord_id IS NOT NULL`),
  getCharsByWorld: db.prepare(`SELECT * FROM characters WHERE world = ? AND owner_discord_id IS NOT NULL`),
  getDeathList: db.prepare(`SELECT name, last_death_time, world FROM characters WHERE owner_discord_id IS NOT NULL`),
  updateLevel: db.prepare(`UPDATE characters SET last_level = ?, last_achievement_hash = ? WHERE name = ?`),
  updateOnline: db.prepare(`UPDATE characters SET last_online = 1, online_since = ?, session_start_level = ? WHERE name = ?`),
  updateOffline: db.prepare(`UPDATE characters SET last_online = 0, online_since = NULL, session_start_level = 0, online_seconds = COALESCE(online_seconds, 0) + ? WHERE name = ?`),
  updateDeath: db.prepare(`UPDATE characters SET last_death_time = ?, death_count = COALESCE(death_count, 0) + 1 WHERE name = ?`),
  checkNewsId: db.prepare(`SELECT news_id FROM news_posts WHERE news_id = ?`),
  insertNews: db.prepare(`INSERT INTO news_posts (news_id, title, published_at) VALUES (?, ?, ?)`),
  logAchievement: db.prepare(`INSERT INTO achievement_logs (character_name, achievement_name, timestamp) VALUES (?, ?, ?)`),
  resetDaily: db.prepare(`UPDATE characters SET daily_level_start = last_level WHERE last_level > 0`),
  resetWeekly: db.prepare(`UPDATE characters SET weekly_level_start = last_level, weekly_death_start = death_count, weekly_online_start = online_seconds WHERE last_level > 0`),
initDaily: db.prepare(`UPDATE characters SET daily_level_start = last_level WHERE daily_level_start = 0 AND last_level > 0`),
  initWeekly: db.prepare(`UPDATE characters SET weekly_level_start = last_level WHERE weekly_level_start = 0 AND last_level > 0`),
  initWeeklyDeaths: db.prepare(`UPDATE characters SET weekly_death_start = death_count WHERE weekly_death_start = 0`),
  initWeeklyOnline: db.prepare(`UPDATE characters SET weekly_online_start = online_seconds WHERE weekly_online_start = 0`)
  
};

// --- WITTY ANNOUNCEMENTS ---
const levelJokes = [
    "Look at you, actually making progress! Don't get used to it.", "Another level closer to finally being useful in a team hunt.",
    "Level up! Your parents still aren't proud, but the bot is.", "Save some XP for the rest of us, hero.",
    "XP gain detected. Error: Player competence not found.", "Level up! Only 1,000 more to go until you're relevant.",
    "Is that a new level or did you just accidentally click a monster?", "Another level? I hope you're as good at gaming as you are at grinding.",
    "I don't have birthdays. I level up. You? You just waste time.", "Status: loading brilliance… please wait. (Still waiting).",
    "You leveled up! Clearly, the monsters were taking a union break.", "Another level closer to a heart attack. Take a walk outside?",
    "Congratulations on doing the same thing for 40 hours to see a number change.", "You're like a fine wine—you get more expensive and harder to manage with age.",
    "Level up! Now go buy some spells you'll forget to use.", "One step closer to the highscores, ten steps further from a social life.",
    "If only you leveled up in real life this fast.", "The Tibian gods are unimpressed, but I'll log it anyway.",
    "Ding! Your e-peen grew by 0.5 inches.", "Was that a level up or just a very loud lag spike?",
    "You're now high enough level to die in even more expensive ways.", "Great job! You've officially spent more time with a cyclops than a human this week.",
    "A new level! I’ll notify the press. (I won't).", "Level up! Don't worry, your skill is still Level 1.",
    "You reached a new level! Your reward is... more grinding. Enjoy."
];

const deathJokes = [
    "Task failed successfully. Better luck next time!", "Skill issue? Or just a very sauce-spicious death?",
    "You'll recover... someday. This is the part where you yell at the screen.", "I'd say 'Git Gud,' but we both know that's not happening.",
    "From hero to zero... and then back to the temple.", "Tip: Have you tried NOT dying? It’s a bold strategy.",
    "Clearly, something happened that led to your death. Probably your hands.", "Exura vita... exura vita... exura vita... You are dead.",
    "Forgot to breathe, or just didn't bounce?", "Watched your innards become outards. Impressive.",
    "Your incompetence was put on display. Again.", "You've yee'd your last haw.",
    "First try, part 2. (This time with more dying).", "Ouch. That must've hurt your pride more than your blessings.",
    "You died. But hey, at least you're consistent.", "Mission failed. We'll get 'em next time. (Probably not).",
    "Are you a masochist? Or just 'yes' spamming your hotkeys again?", "Temple teleport activated! Quickest travel in the game.",
    "Blessings are just a tax on being bad at the game.", "Did you lag, or are you just like this?",
    "That monster just did us all a favor.", "You died. Your loot is now in better hands.",
    "I'd offer my condolences, but I'm a bot and I find this hilarious.", "Don't be sad. You're so ugly when you're sad.",
    "You died. Time to unplug the router and go to bed."
];

const onlineJokes = [
    "Oh look, [Name] is back. There goes the neighborhood.", "[Name] has logged in. Hide your loot and your mana pots.",
    "The legend (self-proclaimed) has arrived. [Name] is online.", "Error 404: Sleep not found. [Name] is back.",
    "Online and thriving? More like online and surviving.", "Ready to lose some blessings? [Name] is online.",
    "Keep calm and blame it on the lag. [Name] has joined.", "The early bird gets the worm, but the late player gets the KS.",
    "Game on! Try to stay alive for more than 20 minutes this time.", "[Name] is online. RIP to the local monster population.",
    "Be yourself—everyone else is already taken.", "Status: loading brilliance… please wait. Oh, it's just [Name].",
    "Wanna be the reason I'm online all night? Too late, I'm a bot.", "Sliding into the server smoother than butter.",
    "Legend says [Name] is still typing... but they actually just logged in.", "Back in 5 minutes? You were gone for 5 days. Welcome back.",
    "Procrastination mode: Activated. [Name] is online.", "Prepare for a roller coaster of sass. [Name] is here.",
    "If looks could ping, you'd spam us all. Welcome back.", "[Name] is online. My imagination has better graphics than this.",
    "WiFi dropped, but your ego stayed connected. Welcome back.", "Knowledge is knowing a dragon is dangerous; wisdom is not hunting it alone.",
    "[Name] is online. Time to repeat the process.", "Here we go again... [Name] has arrived.",
    "Welcome back! I guess I forgot to remove you from the list."
];

const offlineJokes = [
    "[Name] logged out. The server’s average IQ just skyrocketed.", "Finally, some peace. [Name] is offline.",
    "Going to sleep? Or did you just ragequit after that last death?", "Currently avoiding real life... oh wait, they logged off. Real life found.",
    "If I'm not online, I'm either sleeping or dead. Respect my decision.", "[Name] is offline. Silence is golden.",
    "Reality called, so they finally hung up. [Name] is offline.", "I'll be back before you can pronounce actillimandataquerin!",
    "[Name] has left. Time to go wash the sweat off the keyboard.", "Offline. Probably to go buy more Tibia Coins.",
    "Logging out? Don't let the door hit your magic shield on the way out.", "And that's a wrap! [Name] is finally gone.",
    "[Name] is offline. Time is precious—waste it wisely elsewhere.", "Multitasking: being unproductive in multiple ways at once. Success!",
    "I used to be indecisive, but now I'm not so sure. [Name] is gone.", "Caution: [Name] has no filter, and now they have no connection.",
    "[Name] is offline. Bigfoot saw them, but no one believes it.", "Out of ideas and out of connection. [Name] is offline.",
    "The sun may set, but my screens never do. Unlike yours. Bye.", "Introverted, but willing to discuss cats. Just not with [Name].",
    "[Name] is offline. My humor is like my WiFi—dry and unstable.", "I don't make mistakes, I create plot twists. [Name] logging out is one.",
    "Legends say [Name] is still typing... but the status says offline.", "Every day I update my status, but my life remains in beta. Bye.",
    "I left my sanity in another server. [Name] left their character here."
];

// --- UTILS ---
function pickRandom(arr, name = '') { 
    let line = arr[Math.floor(Math.random() * arr.length)]; 
    return line.replace('[Name]', name);
}
function formatDuration(s) { return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`; }

const chunkArray = (array, size) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) chunks.push(array.slice(i, i + size));
  return chunks;
};

async function sendEmbedToSetting(client, settingKey, embed) {
  try {
    const row = db.prepare(`SELECT value FROM settings WHERE key = ?`).get(settingKey);
    if (!row) return null;
    const channel = await client.channels.fetch(row.value).catch(() => null);
    return channel ? await channel.send({ embeds: [embed] }) : null;
  } catch (e) { return null; }
}

// --- CORE TRACKING LOGIC ---

async function syncWorlds(client) {
  const worlds = stmts.getTrackedWorlds.all();
  
  for (const { world: worldName } of worlds) {
    try {
      const worldData = await getWorld(worldName);
      if (!worldData?.world) continue;

      const onlineMap = new Map((worldData.world.online_players || []).map(p => [p.name.toLowerCase(), p.level]));
      const trackedInWorld = stmts.getCharsByWorld.all(worldName);

      const pendingLevelUpdates = [];
      const pendingStatusUpdates = [];

      for (const ch of trackedInWorld) {
        const nameLower = ch.name.toLowerCase();
        const currentLevel = onlineMap.get(nameLower);
        const isNowOnline = onlineMap.has(nameLower) ? 1 : 0;

        if (currentLevel && currentLevel > ch.last_level && ch.last_level > 0) {
          const fullData = await getCharacter(ch.name);
          pendingLevelUpdates.push({ ch, currentLevel, achievements: fullData?.character?.achievements || [] });
        }

        if (isNowOnline !== ch.last_online) {
          pendingStatusUpdates.push({ ch, isNowOnline, currentLevel });
        }
      }

      db.transaction(() => {
        for (const update of pendingLevelUpdates) {
          const { ch, currentLevel, achievements } = update;
          const isMilestone = currentLevel % 100 === 0;
          const oldAchNames = JSON.parse(ch.last_achievement_hash || '[]');

          const embed = new EmbedBuilder()
            .setColor(isMilestone ? 0xFFD700 : 0x57F287)
            .setTitle(isMilestone ? '🌟 MAJOR MILESTONE!' : '🎉 Level Up!')
            .setDescription(`**${ch.name}** reached level **${currentLevel}**!\n\n*${pickRandom(levelJokes)}*`)
            .setTimestamp();
          
          sendEmbedToSetting(client, 'level_alert_channel_id', embed).then(msg => {
            if (msg) ['📈', '🥳'].forEach(e => msg.react(e).catch(() => null));
          });

          for (const ach of achievements) {
            if (!oldAchNames.includes(ach.name)) {
              const achEmbed = new EmbedBuilder()
                .setColor(0xE91E63)
                .setTitle('🏆 Achievement Unlocked!')
                .setDescription(`**${ch.name}** earned: **${ach.name}**`)
                .setTimestamp();
              sendEmbedToSetting(client, 'level_alert_channel_id', achEmbed);
              stmts.logAchievement.run(ch.name, ach.name, new Date().toISOString());
            }
          }

          const newAchHash = JSON.stringify(achievements.map(a => a.name));
          stmts.updateLevel.run(currentLevel, newAchHash, ch.name);
        }

        for (const update of pendingStatusUpdates) {
          const { ch, isNowOnline, currentLevel } = update;
          if (isNowOnline === 1) {
            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('🟢 Online')
                .setDescription(`**${ch.name}** logged in.\n\n*${pickRandom(onlineJokes, ch.name)}*`)
                .setTimestamp();
            sendEmbedToSetting(client, 'online_alert_channel_id', embed);
            stmts.updateOnline.run(new Date().toISOString(), currentLevel || ch.last_level, ch.name);
          } else {
            let sessionSec = ch.online_since ? (Date.now() - new Date(ch.online_since).getTime()) / 1000 | 0 : 0;
            let levelsGained = Math.max(0, (currentLevel || ch.last_level) - ch.session_start_level);
            let efficiency = (sessionSec > 0) ? (levelsGained / (sessionSec / 3600)).toFixed(2) : "0.00";

            const embed = new EmbedBuilder()
              .setColor(0x747F8D)
              .setTitle('⚫ Offline')
              .addFields(
                { name: 'Duration', value: formatDuration(sessionSec), inline: true },
                { name: 'Session Gains', value: `+${levelsGained} Levels`, inline: true },
                { name: 'Efficiency', value: `${efficiency} Lvl/hr`, inline: true }
              )
              .setDescription(`**${ch.name}** logged off.\n\n*${pickRandom(offlineJokes, ch.name)}*`)
              .setTimestamp();

            sendEmbedToSetting(client, 'online_alert_channel_id', embed);
            stmts.updateOffline.run(sessionSec, ch.name);
          }
        }
      })(); 

    } catch (e) { console.error(`Sync error for ${worldName}:`, e.message); }
  }
}

async function checkDeaths(client) {
  const chars = stmts.getDeathList.all();
  const batches = chunkArray(chars, 5);

  for (const batch of batches) {
    await Promise.all(batch.map(async (ch) => {
      try {
        const data = await getCharacter(ch.name);
        const latestDeath = data?.character?.deaths?.[0];
        const deathTime = latestDeath?.time || latestDeath?.date?.date;

        if (deathTime && deathTime !== ch.last_death_time) {
          const isPvP = latestDeath.killers?.some(k => k.player === true);
          const embed = new EmbedBuilder()
            .setTitle(isPvP ? '⚔️ PLAYER KILL' : '💀 Character Death')
            .setColor(isPvP ? 0x9B59B6 : 0xED4245)
            .setDescription(`**${ch.name}** died on ${ch.world}.\n\n**Cause:** ${latestDeath.reason}\n\n*${pickRandom(deathJokes)}*`)
            .setTimestamp();

          const msg = await sendEmbedToSetting(client, 'death_alert_channel_id', embed);
          if (msg) ['💀', '🇫'].forEach(e => msg.react(e).catch(() => null));
          stmts.updateDeath.run(deathTime, ch.name);
        }
      } catch (e) { }
    }));
    await new Promise(r => setTimeout(r, 2000));
  }
}

async function checkNews(client) {
  try {
    const newsData = await getLatestNews();
    const items = (newsData?.news || []).slice(0, 5);
    for (const item of items) {
      if (!stmts.checkNewsId.get(String(item.id))) {
        const newsTitle = item.news || item.title || 'Tibia News Update';
        const newsLink = item.tibiaurl || item.url || 'https://www.tibia.com';
        const embed = new EmbedBuilder().setColor(0xFEE75C).setTitle('📰 Tibia News').setDescription(`**${newsTitle}**`).setURL(newsLink).setTimestamp();
        await sendEmbedToSetting(client, 'news_alert_channel_id', embed);
        stmts.insertNews.run(String(item.id), newsTitle, item.date || new Date().toISOString());
      }
    }
  } catch (e) { console.log('News check failed'); }
}

async function postDailySummary(client) {
  try {
    const rows = db.prepare(`SELECT name, (last_level - daily_level_start) as gained FROM characters WHERE (last_level - daily_level_start) > 0 ORDER BY gained DESC LIMIT 5`).all();
    if (rows.length === 0) return;
    const embed = new EmbedBuilder().setTitle(`🏆 Daily Wrap-up: Top Gainers`).setColor(0xF1C40F).setDescription(rows.map((r, i) => `**${i+1}.** ${r.name}: **+${r.gained}** levels`).join('\n')).setFooter({ text: 'Stats reset baseline in 5 minutes.' }).setTimestamp();
    await sendEmbedToSetting(client, 'leaderboard_channel_id', embed);
  } catch (e) { }
}

async function postWeeklyMVPs(client) {
  try {
    const topGainer = db.prepare(`SELECT name, (last_level - weekly_level_start) as val FROM characters WHERE val > 0 ORDER BY val DESC LIMIT 1`).get();
    const topDeaths = db.prepare(`SELECT name, (death_count - weekly_death_start) as val FROM characters WHERE val > 0 ORDER BY val DESC LIMIT 1`).get();
    const topOnline = db.prepare(`SELECT name, (online_seconds - weekly_online_start) as val FROM characters WHERE val > 0 ORDER BY val DESC LIMIT 1`).get();
    if (!topGainer && !topDeaths && !topOnline) return;
    const embed = new EmbedBuilder().setTitle('🎖️ Weekly MVP Awards').setColor(0x9B59B6).addFields({ name: '🏃 The Marathoner', value: topOnline ? `**${topOnline.name}** (${formatDuration(topOnline.val)})` : 'None', inline: true }, { name: '📈 The Speedster', value: topGainer ? `**${topGainer.name}** (+${topGainer.val} Levels)` : 'None', inline: true }, { name: '🪦 Temple Frequent Flyer', value: topDeaths ? `**${topDeaths.name}** (${topDeaths.val} Deaths)` : 'None', inline: true }).setFooter({ text: 'Weekly baseline resetting now...' }).setTimestamp();
    await sendEmbedToSetting(client, 'leaderboard_channel_id', embed);
  } catch (e) { }
}

function startTrackers(client) {
  console.log("🛠️ Syncing missing baselines...");
  db.transaction(() => {
    stmts.initDaily.run();
    stmts.initWeekly.run();
    stmts.initWeeklyDeaths.run();
    stmts.initWeeklyOnline.run();
  })();
  syncWorlds(client);
  checkDeaths(client);
  checkNews(client);
  setInterval(() => syncWorlds(client), 2 * 60 * 1000); 
  setInterval(() => checkDeaths(client), 10 * 60 * 1000); 
  schedule.scheduleJob({ hour: 12, minute: 0, tz: 'Etc/GMT' }, () => checkNews(client));
  schedule.scheduleJob({ hour: 23, minute: 55, tz: 'Etc/GMT' }, () => postDailySummary(client));
  schedule.scheduleJob({ hour: 0, minute: 1, tz: 'Etc/GMT' }, () => stmts.resetDaily.run());
  schedule.scheduleJob({ hour: 23, minute: 55, dayOfWeek: 0, tz: 'Etc/GMT' }, () => postWeeklyMVPs(client));
  schedule.scheduleJob({ hour: 0, minute: 1, dayOfWeek: 1, tz: 'Etc/GMT' }, () => stmts.resetWeekly.run());
}

module.exports = { startTrackers };