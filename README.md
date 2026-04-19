# TGN-Bot

TGN-Bot is a Discord bot for Tibia communities that helps players track characters, link alts, check monsters, read Tibia news, and monitor progression data from inside a Discord server.[cite:3][cite:1]

It runs on Node.js, uses Discord slash commands, stores bot data in SQLite through `better-sqlite3`, and uses TibiaData-powered lookups for game information.[cite:2][cite:3][cite:1]

## Features

- Claim a Tibia character and link visible public account characters with `/claim`.[cite:3]
- Manually link extra characters with `/linkalt`.[cite:3]
- View linked characters with `/mychars`.[cite:3]
- Check online status with `/online`.[cite:3]
- Read the latest Tibia news with `/latestnews`.[cite:3]
- Look up monsters with `/monster`.[cite:3]
- Show leaderboards for levels, deaths, and online time with `/leaderboard`.[cite:3]
- Configure channels for alerts and scheduled posts with dedicated slash commands.[cite:3]

## Stack

| Part | Technology |
|---|---|
| Runtime | Node.js [cite:2] |
| Discord library | discord.js v14 [cite:2] |
| Database | SQLite with better-sqlite3 [cite:1][cite:2] |
| Scheduling | node-schedule [cite:2] |
| Environment config | dotenv [cite:2] |

## Commands

| Command | Description |
|---|---|
| `/claim name:<character>` | Claims a main character and links visible account characters.[cite:3] |
| `/linkalt name:<character>` | Manually links another character to the same Discord account.[cite:3] |
| `/mychars` | Lists linked characters and marks the main one.[cite:3] |
| `/online name:<character>` | Checks whether a stored character is online.[cite:3] |
| `/latestnews` | Shows the latest Tibia news items.[cite:3] |
| `/monster name:<monster>` | Returns a bestiary-style creature lookup.[cite:3] |
| `/leaderboard type:<level|deaths|online>` | Shows leaderboard data from tracked characters.[cite:3] |
| `/setlevelchannel channel:<#channel>` | Sets the level alert channel.[cite:3] |
| `/setdeathchannel channel:<#channel>` | Sets the death alert channel.[cite:3] |
| `/setonlinechannel channel:<#channel>` | Sets the online alert channel.[cite:3] |
| `/setnewschannel channel:<#channel>` | Sets the Tibia news channel.[cite:3] |
| `/setleaderboardchannel channel:<#channel>` | Sets the weekly leaderboard channel.[cite:3] |

## Project structure

- `bot.js` handles Discord interactions, slash commands, embeds, and command routing.[cite:3]
- `db.js` creates and updates the SQLite database tables used by the bot.[cite:1]
- `register-commands.js` registers slash commands to the target Discord guild.[cite:3]
- `tibia_bot.db` is created locally when the bot runs and stores user, character, settings, and news data.[cite:1]

## Requirements

Before running the bot, make sure you have:

- Node.js installed.[cite:2]
- A Discord application and bot token.[cite:3]
- Your Discord application client ID and a server (guild) ID for slash command registration.[cite:3]

## Local setup

### 1. Install dependencies

```bash
npm install
```

The project depends on `discord.js`, `better-sqlite3`, `dotenv`, and `node-schedule`.[cite:2]

### 2. Create a `.env` file

```env
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_application_client_id
GUILD_ID=your_test_server_id
```

These values are used directly by the bot and the slash-command registration script.[cite:3]

### 3. Register slash commands

```bash
node register-commands.js
```

The bot uses guild command registration, which is useful because updates usually appear faster in a specific server.[cite:3]

### 4. Start the bot

```bash
npm start
```

The package start script runs `node bot.js`.[cite:2]

## Uploading to a server

TGN-Bot is a normal Node.js app, so it can be uploaded to a VPS, a Linux server, or a cloud platform that supports long-running Node processes.[cite:2][cite:3]

### Option 1: Upload with Git

1. Push the project to GitHub.
2. Connect to your server with SSH.
3. Clone the repository:

```bash
git clone https://github.com/your-username/your-repo.git
cd your-repo
```

4. Install dependencies:

```bash
npm install
```

5. Create the `.env` file on the server with your bot token, client ID, and guild ID.[cite:3]
6. Register commands once:

```bash
node register-commands.js
```

7. Start the bot:

```bash
npm start
```

### Option 2: Upload files manually

If you are not using Git, upload the project files to your server with SFTP, SCP, or your hosting provider’s file manager, then run the same install and start steps.[cite:2]

```bash
npm install
node register-commands.js
npm start
```

## Running in the background

For a real server deployment, it is better to keep the bot running with a process manager such as PM2 or a system service, otherwise it will stop when the SSH session closes.

Example with PM2:

```bash
npm install -g pm2
pm2 start bot.js --name tgn-bot
pm2 save
```

The application is a single long-running Node.js process with `bot.js` as its main entry point, so it fits process-manager deployment well.[cite:2][cite:3]

## Database notes

The bot uses a local SQLite database named `tibia_bot.db`.[cite:1]

That means if you move to a new server, you should also copy the `tibia_bot.db` file if you want to keep your saved users, linked characters, settings, and stored news data.[cite:1]

## Timing notes

Leaderboard playtime is approximate and may be out by around 2 minutes due to TibiaData update delays and the bot’s scheduled checks.

TibiaData caches character data for up to 300 seconds, and world status can take up to 60 seconds to refresh, so online/offline changes may appear with a short delay.

The bot checks character progress every 10 minutes, checks online status every 60 seconds, checks Tibia news every 24 hours, and posts weekly leaderboards every Monday at 12:00 PM Europe/London.

## Troubleshooting

- If slash commands do not appear, rerun `node register-commands.js` and make sure `CLIENT_ID` and `GUILD_ID` are correct.[cite:3]
- If the bot starts but cannot log in, check `DISCORD_TOKEN` in the `.env` file.[cite:3]
- If your data seems missing after moving server, make sure `tibia_bot.db` was copied over.[cite:1]

## License

This project can be distributed with a custom non-commercial license if you want the code to be visible but not available for commercial use.[cite:3]
