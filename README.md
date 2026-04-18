# TGN-Bot

TGN-Bot is a Discord bot for Tibia communities that helps players track characters, link alts, check monsters, read Tibia news, and monitor basic progression data inside a Discord server.[cite:1][cite:2][cite:3]

It uses Discord slash commands, a local SQLite database with `better-sqlite3`, and TibiaData v4 endpoints for character, world, creature, and news data.[cite:1][cite:2][cite:3]

## Features

- Claim a Tibia character and link publicly visible account characters with `/claim`.[cite:3]
- Manually link extra characters with `/linkalt`.[cite:3]
- Remove one linked character with `/unlink` or remove every linked character with `/unlinkall`.[cite:3]
- View your linked characters with `/mychars`.[cite:3]
- Check whether a tracked character is online with `/online`.[cite:3]
- Read the latest Tibia news with `/latestnews` and fetch a specific article with `/newsarticle`.[cite:3]
- Search the Tibia bestiary with `/monster`.[cite:3]
- Show level, death, and online-time leaderboards with `/leaderboard`.[cite:3]
- Configure channels for level alerts, death alerts, online alerts, news posts, and leaderboard posts with admin slash commands.[cite:3]

## Stack

| Part | Technology |
|---|---|
| Runtime | Node.js [cite:2] |
| Discord library | discord.js v14 [cite:2] |
| Database | SQLite via better-sqlite3 [cite:1][cite:2] |
| Scheduling | node-schedule [cite:2] |
| Config | dotenv [cite:2] |
| Game data source | TibiaData v4 endpoints [cite:3] |

## Commands

| Command | Purpose |
|---|---|
| `/claim name:<character>` | Claims a main character and links visible public characters from the same account.[cite:3] |
| `/linkalt name:<character>` | Manually links another character to the same Discord user.[cite:3] |
| `/unlink name:<character>` | Removes one linked character from the user’s account.[cite:3] |
| `/unlinkall` | Removes all linked characters owned by the current Discord user.[cite:3] |
| `/mychars` | Lists the user’s linked characters and marks the main one.[cite:3] |
| `/online name:<character>` | Checks whether the stored character is online in its world.[cite:3] |
| `/latestnews` | Shows the latest Tibia news items.[cite:3] |
| `/newsarticle id:<id>` | Shows a single news article by ID.[cite:3] |
| `/monster name:<monster>` | Looks up a creature and returns a bestiary-style embed.[cite:3] |
| `/leaderboard type:<level|deaths|online>` | Shows tracked leaderboard data from the local database.[cite:3] |
| `/setlevelchannel channel:<#channel>` | Sets the level alert channel.[cite:3] |
| `/setdeathchannel channel:<#channel>` | Sets the death alert channel.[cite:3] |
| `/setonlinechannel channel:<#channel>` | Sets the online alert channel.[cite:3] |
| `/setnewschannel channel:<#channel>` | Sets the Tibia news channel.[cite:3] |
| `/setleaderboardchannel channel:<#channel>` | Sets the weekly leaderboard channel.[cite:3] |

## Project files

- `bot.js` handles Discord interactions, slash command logic, embeds, character linking, unlinking, and news output.[cite:3]
- `tibia.js` wraps the TibiaData requests used by the bot.[cite:3]
- `db.js` creates and updates the SQLite tables for users, characters, settings, and stored news posts.[cite:1]
- `register-commands.js` registers the slash commands for your guild using the Discord REST API.[cite:3]

## Database

The bot stores data in a local SQLite database named `tibia_bot.db`, and the schema includes `users`, `characters`, `settings`, and `news_posts` tables.[cite:1]

The `characters` table stores ownership, main-character grouping, tracked level data, death tracking fields, online tracking fields, and achievement-hash support for future progression features.[cite:1]

## Setup

### 1. Install dependencies

```bash
npm install
```

The current package setup uses `discord.js`, `better-sqlite3`, `dotenv`, and `node-schedule`.[cite:2]

### 2. Create your `.env` file

```env
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_application_client_id
GUILD_ID=your_test_server_id
```

These values are required because command registration uses `DISCORD_TOKEN`, `CLIENT_ID`, and `GUILD_ID` in the REST registration script.[cite:3]

### 3. Register slash commands

```bash
node register-commands.js
```

The bot currently registers guild commands with `Routes.applicationGuildCommands(...)`, which makes command updates appear faster in a selected server than global registration.[cite:3]

### 4. Start the bot

```bash
node bot.js
```

The package file also defines `npm start` as `node bot.js`.[cite:2]

## Notes

Character auto-linking depends on what TibiaData exposes publicly for a character, so hidden or unavailable linked characters may not be imported automatically.[cite:3]

The bot is designed around slash commands and simple local persistence, which makes it easy to host on a small Node.js service without needing an external database.[cite:1][cite:2][cite:3]
