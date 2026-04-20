# 🛡️ Tibia Community Discord Bot

A high-performance Discord bot for Tibia progression tracking, death alerts, and community leaderboards.

## 🚀 WispByte Deployment Instructions

### 1. File Upload
* Upload all project files (`bot.js`, `tracker.js`, `db.js`, `tibia.js`, `package.json`, etc.) to the WispByte file manager.
* **Note:** Do not upload the `node_modules` folder; WispByte installs these automatically.

### 2. Environment Configuration
* Locate or create the `.env` file in the root directory.
* Fill in your credentials:
    ```env
    DISCORD_TOKEN=your_bot_token
    CLIENT_ID=your_application_id
    GUILD_ID=your_server_id
    ```

### 3. Registering Slash Commands (CRITICAL)
Discord will not show your commands until they are registered.
1.  Go to the **Startup** tab on WispByte.
2.  Change the **Start Command** to: `node register-commands.js`.
3.  Go to the **Console** and click **Start/Restart**.
4.  Wait for the message: `Slash commands registered successfully.`
5.  **Stop** the server.

### 4. Running the Bot
1.  Go back to the **Startup** tab.
2.  Change the **Start Command** to: `node bot.js`.
3.  Go to the **Console** and click **Start**.

---

## 🎮 All Slash Commands

### 👤 Character Management
* `/claim [name]` — Link your main character. The bot will automatically attempt to find and link your alts.
* `/linkalt [name]` — Manually link an additional character to your account.
* `/mychars` — List all characters currently linked to your Discord profile.
* `/unlink [name]` — Remove a specific character from your tracking list.
* `/unlinkall` — Clear all linked characters from your account.

### 📈 Progression & Stats
* `/gains [daily/weekly]` — View level progression for the chosen timeframe.
* `/leaderboard [level/deaths/online]` — Show the top 10 players for levels, total deaths, or online time.
* `/online [name]` — Check if a specific character is currently in-game.

### 🔍 Utility & Information
* `/monster [name]` — Get Bestiary stats (HP, XP, Race) and a description of a creature.
* `/item [name]` — Get a direct TibiaWiki link for the specified item.
* `/latestnews` — View the 5 most recent Tibia news tickers.
* `/newsarticle [id]` — Read a full Tibia news article using its ID.

### ⚙️ Admin & System
* `/settings` — View current channel configurations and tracker status.
* `/refresh` — Manually trigger a level repair for characters stuck at "Level 0."
* `/setlevelchannel [channel]` — Set where level-up alerts are posted.
* `/setdeathchannel [channel]` — Set where death alerts are posted.
* `/setonlinechannel [channel]` — Set where login/logout notifications are posted.
* `/setnewschannel [channel]` — Set where Tibia news updates are posted.
* `/setleaderboardchannel [channel]` — Set where daily/weekly summaries are posted.

---

## ⏳ Note on Synchronization
Due to the sync times of the **TibiaData API** and the bot's internal tracking cycles, some events (like level-ups or deaths) may have a small delay before appearing in Discord notifications.
* **World Sync**: Occurs every 2 minutes.
* **Death Checks**: Occurs every 10 minutes (to ensure API stability).
* **API Caching**: Character data is often cached by the API for several minutes.

---

## 🤖 Adding to Discord

1.  Open the [Discord Developer Portal](https://discord.com/developers/applications).
2.  Select your App -> **OAuth2** -> **URL Generator**.
3.  **Scopes:** Select `bot` and `applications.commands`.
4.  **Bot Permissions:**
    * `Send Messages`, `Embed Links`, `Read Message History`, `Add Reactions`.
5.  Paste the generated URL into your browser to invite the bot.

---
*Developed for the Tibia Community. Not affiliated with CipSoft GmbH.*
