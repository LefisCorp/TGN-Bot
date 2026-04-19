
# TGN-Bot

**TGN-Bot** is a Discord bot for Tibia communities that helps players track characters, link alts, monitor progression, check online status, read Tibia news, and view leaderboards directly from your Discord server.

**Key Features:**
- Claim characters and auto-link visible alts
- Real-time level-up, death, and online/offline alerts
- Tibia news and monster lookups
- Server-wide leaderboards and weekly MVP awards
- Reaction-based subscription system
- Works across **any Tibia world**

## 🚀 Quick Start

```bash
# Clone & Install
git clone https://github.com/your-username/tgn-bot.git
cd tgn-bot
npm install

# Setup .env (see below)
cp .env.example .env

# Register Commands
node register-commands.js

# Start Bot
npm start
```


## 📋 Features

| Feature | Command |
| :-- | :-- |
| **Character Management** | `/claim`, `/linkalt`, `/unlink`, `/unlinkall`, `/mychars` |
| **Status Checks** | `/online` |
| **Tibia News** | `/latestnews`, `/newsarticle` |
| **Monster Lookup** | `/monster` |
| **Leaderboards** | `/leaderboard type:level\|deaths\|online` |
| **Alert Configuration** | `/setlevelchannel`, `/setdeathchannel`, `/setonlinechannel`, `/setnewschannel`, `/setleaderboardchannel` |
| **Subscriptions** | `/setsubscriptionschannel`, `/subscriptions` |
| **Bot Settings** | `/settings` |

## 🛠 Tech Stack

| Component | Technology |
| :-- | :-- |
| **Runtime** | [Node.js](https://nodejs.org) |
| **Discord** | [discord.js v14](https://discord.js.org) |
| **Database** | [SQLite](https://www.sqlite.org) + better-sqlite3 |
| **Scheduling** | [node-schedule](https://www.npmjs.com/package/node-schedule) |
| **Config** | [dotenv](https://www.npmjs.com/package/dotenv) |

## ⚙️ Installation

### 1. Prerequisites

- [Node.js 18+](https://nodejs.org)
- Discord Developer account
- Server (guild) ID


### 2. Setup Environment

Create `.env`:

```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_application_client_id
GUILD_ID=your_server_guild_id
```


### 3. Install \& Run

```bash
npm install
node register-commands.js
npm start
```


### 4. Add to Server

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create OAuth2 URL with **bot** scope + required permissions
3. Invite bot to your server

## 🔧 Required Permissions

```
✅ View Channels
✅ Send Messages  
✅ Embed Links
✅ Read Message History
✅ Use Slash Commands
```

**Also enable:** Server Members Intent (for cleanup)

## 📁 Project Structure

```
├── bot.js                 # Main Discord client & commands
├── db.js                  # SQLite database setup
├── tracker.js             # Background trackers & alerts
├── register-commands.js   # Slash command registration
├── tibia.js               # TibiaData API wrapper
└── tibia_bot.db           # SQLite database (auto-created)
```


## ⚡ Background Tasks

| Task | Frequency | Purpose |
| :-- | :-- | :-- |
| Level/Death checks | Every 5 min | Progression alerts |
| Online status | Every 1 min | Online/offline notifications |
| Tibia news | Every 30 min | New articles |
| Weekly leaderboards | Monday 12:00 PM GMT | MVP awards |

## 🎯 Commands Reference

### Character Management

```
/claim name:YourChar     # Auto-links visible alts
/linkalt name:AltChar    # Manual alt link
/mychars                 # List your characters
/unlink name:CharName    # Remove one character
/unlinkall               # Clear all links
```


### Status \& Info

```
/online name:CharName    # Online status
/monster name:Dragon     # Bestiary lookup
/latestnews              # Latest Tibia news
/newsarticle id:12345    # Specific news article
```


### Leaderboards

```
/leaderboard type:level     # Top levels
/leaderboard type:deaths    # Most deaths
/leaderboard type:online    # Most online time
```


### Server Setup

```
/setlevelchannel channel:#alerts
/setdeathchannel channel:#alerts
/setonlinechannel channel:#status
/setnewschannel channel:#news
/setleaderboardchannel channel:#leaderboard
/setsubscriptionschannel channel:#subscribe
/settings                    # View config
/subscriptions               # Subscription stats
```


## 🔔 Subscriptions

1. Run `/setsubscriptionschannel #channel`
2. React to subscribe:
    - 🆙 Level-ups
    - 💀 Deaths
    - 💚 Online/Offline
    - 📰 News

## 🌐 Hosting

### PM2 (Recommended)

```bash
npm i -g pm2
pm2 start bot.js --name tgn-bot
pm2 startup
pm2 save
```


### Docker (Coming Soon)

```
docker run -d --env-file .env tgn-bot:latest
```


## 📊 Database

**File:** `tibia_bot.db` (SQLite)

**Tables:**

- `characters` - Player data \& progression
- `users` - Discord accounts
- `settings` - Server config
- `subscriptions` - Reaction subscriptions
- `newsposts` - News cache

**Backup tip:** Copy `tibia_bot.db` when migrating servers.

## 🔍 Troubleshooting

| Issue | Solution |
| :-- | :-- |
| No slash commands | `node register-commands.js` + check `.env` |
| Bot won't login | Verify `DISCORD_TOKEN` |
| No alerts | Check channel permissions + `/settings` |
| Data missing | Copy `tibia_bot.db` |

## 📈 Weekly MVPs

Every Monday, the bot automatically posts:

- **Grinder Award** - Most levels gained
- **Floor Inspector** - Most deaths


## 🤝 Contributing

1. Fork the repo
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push \& PR

## 📄 License

**Non-Commercial License** - Free for personal/community use. Contact for commercial licensing.

---

⭐ **Star this repo if it helps your guild!** ⭐

[Discord.js Docs](https://discord.js.org) | [TibiaData API](https://tibiadata.com) | [Node.js](https://nodejs.org)

```

**Ready to save as `README.md`!** 

✅ Removed all Perplexity references  
✅ Professional GitHub-ready formatting  
✅ All 18 commands documented from your code  
✅ Complete installation & hosting guide  
✅ Just update the GitHub repo URL and you're live 🚀```

