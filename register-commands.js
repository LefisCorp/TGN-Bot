require('dotenv').config();
const { REST, Routes, SlashCommandBuilder, ChannelType } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('claim')
    .setDescription('Claim a Tibia character and link visible account characters')
    .addStringOption(option => option.setName('name').setDescription('Character name').setRequired(true)),

  new SlashCommandBuilder()
    .setName('linkalt')
    .setDescription('Manually link another character to your account')
    .addStringOption(option => option.setName('name').setDescription('Alt character name').setRequired(true)),

  new SlashCommandBuilder()
    .setName('unlink')
    .setDescription('Unlink one of your Tibia characters from your account')
    .addStringOption(option => option.setName('name').setDescription('Character name to unlink').setRequired(true)),

  new SlashCommandBuilder()
    .setName('unlinkall')
    .setDescription('Remove all linked characters from your account'),

  new SlashCommandBuilder()
    .setName('mychars')
    .setDescription('Show your linked characters'),

  new SlashCommandBuilder()
    .setName('online')
    .setDescription('Check if a character is online')
    .addStringOption(option => option.setName('name').setDescription('Character name').setRequired(true)),

  new SlashCommandBuilder()
    .setName('latestnews')
    .setDescription('Show the latest Tibia news'),

  new SlashCommandBuilder()
    .setName('newsarticle')
    .setDescription('Show one Tibia news article by ID')
    .addStringOption(option => option.setName('id').setDescription('News article ID').setRequired(true)),

  new SlashCommandBuilder()
    .setName('monster')
    .setDescription('Search the Tibia bestiary by monster name')
    .addStringOption(option => 
      option.setName('name')
        .setDescription('The name of the monster (e.g., Dragon)')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show leaderboard for tracked characters')
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Leaderboard type')
        .setRequired(true)
        .addChoices(
          { name: 'Levels', value: 'level' },
          { name: 'Deaths', value: 'deaths' },
          { name: 'Online Time', value: 'online' }
        )
    ),

  // NEW: Gains Command for daily/weekly progression
  new SlashCommandBuilder()
    .setName('gains')
    .setDescription('Show level progression for a specific timeframe')
    .addStringOption(option =>
      option.setName('timeframe')
        .setDescription('The period to check gains for')
        .setRequired(true)
        .addChoices(
          { name: 'Daily', value: 'daily' },
          { name: 'Weekly', value: 'weekly' }
        )
    ),

  new SlashCommandBuilder()
    .setName('setlevelchannel')
    .setDescription('Choose the Discord channel for level-up alerts')
    .addChannelOption(option => option.setName('channel').setDescription('Channel for level-up alerts').addChannelTypes(ChannelType.GuildText).setRequired(true)),

  new SlashCommandBuilder()
    .setName('setdeathchannel')
    .setDescription('Choose the Discord channel for death alerts')
    .addChannelOption(option => option.setName('channel').setDescription('Channel for death alerts').addChannelTypes(ChannelType.GuildText).setRequired(true)),

  new SlashCommandBuilder()
    .setName('setonlinechannel')
    .setDescription('Choose the Discord channel for online notifications')
    .addChannelOption(option => option.setName('channel').setDescription('Channel for online notifications').addChannelTypes(ChannelType.GuildText).setRequired(true)),

  new SlashCommandBuilder()
    .setName('setnewschannel')
    .setDescription('Choose the Discord channel for Tibia news updates')
    .addChannelOption(option => option.setName('channel').setDescription('Channel for Tibia news updates').addChannelTypes(ChannelType.GuildText).setRequired(true)),

  new SlashCommandBuilder()
    .setName('setleaderboardchannel')
    .setDescription('Choose the Discord channel for weekly leaderboard posts')
    .addChannelOption(option => option.setName('channel').setDescription('Channel for leaderboard posts').addChannelTypes(ChannelType.GuildText).setRequired(true)),

  new SlashCommandBuilder()
    .setName('setsubscriptionschannel')
    .setDescription('Post the reaction-based subscription message in a channel')
    .addChannelOption(option => option.setName('channel').setDescription('Channel for subscriptions').addChannelTypes(ChannelType.GuildText).setRequired(true)),

new SlashCommandBuilder()
    .setName('item')
    .setDescription('Look up item stats and NPC prices')
    .addStringOption(option => 
      option.setName('name')
        .setDescription('The name of the item (e.g., Demon Armor)')
        .setRequired(true)
    ),
    
  new SlashCommandBuilder()
    .setName('settings')
    .setDescription('Show the current bot configuration and tracker status'),

new SlashCommandBuilder()
    .setName('refresh')
    .setDescription('Manually trigger the level repair task for Level 0 characters'),

].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Registering slash commands...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('Slash commands registered successfully.');
  } catch (error) {
    console.error(error);
  }
})();