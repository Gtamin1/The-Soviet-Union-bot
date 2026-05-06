# Discord + Roblox Bot System

A complete Discord bot with Roblox verification, role binding, points system, and game integration.

## 🌟 Features

- **Roblox Verification** - Link Discord accounts to Roblox profiles
- **Role Binding** - Automatically sync Discord roles with Roblox group ranks
- **Points System** - Track and reward members with points
- **REST API** - Allow Roblox games to give points and log activity
- **CMDR Integration** - Admin commands in Roblox games
- **Activity Tracking** - Automatically award points for in-game activities

## 📋 Prerequisites

Before you start, you'll need:

1. **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
2. **PostgreSQL** database - [Download here](https://www.postgresql.org/download/)
3. **Discord Bot Token** - From [Discord Developer Portal](https://discord.com/developers/applications)
4. **A server or computer** to run the bot 24/7

## 🚀 Step-by-Step Setup Guide

### Step 1: Create a Discord Bot

1. Go to https://discord.com/developers/applications
2. Click **"New Application"** and give it a name
3. Go to the **"Bot"** tab on the left
4. Click **"Add Bot"** and confirm
5. Under the bot's username, click **"Reset Token"** and copy it (you'll need this later)
6. Scroll down and enable these **Privileged Gateway Intents**:
   - ✅ Server Members Intent
   - ✅ Message Content Intent (optional)
7. Go to the **"OAuth2"** tab
8. Copy your **Application ID** (also called Client ID)

### Step 2: Set Up PostgreSQL Database

#### On Windows:
1. Download and install PostgreSQL from https://www.postgresql.org/download/windows/
2. During installation, remember the password you set for the `postgres` user
3. Open **pgAdmin 4** (installed with PostgreSQL)
4. Right-click **"Databases"** → **"Create"** → **"Database"**
5. Name it `roblox_bot` and click **"Save"**

#### On macOS:
```bash
# Install PostgreSQL using Homebrew
brew install postgresql@14
brew services start postgresql@14

# Create database
createdb roblox_bot
```

#### On Linux:
```bash
# Install PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start PostgreSQL
sudo systemctl start postgresql

# Create database
sudo -u postgres createdb roblox_bot
```

### Step 3: Clone and Install the Bot

1. **Download or clone** this repository to your computer
2. Open **Terminal** (macOS/Linux) or **Command Prompt** (Windows)
3. Navigate to the bot folder:
   ```bash
   cd path/to/The-CUSAR-bot
   ```
4. **Install dependencies**:
   ```bash
   npm install
   ```

### Step 4: Configure Environment Variables

1. Copy the example environment file:
   ```bash
   # On Windows:
   copy .env.example .env

   # On macOS/Linux:
   cp .env.example .env
   ```

2. Open `.env` in a text editor (like Notepad, VS Code, etc.)

3. Fill in the values:
   ```env
   DISCORD_TOKEN=your_bot_token_here
   DISCORD_CLIENT_ID=your_application_id_here
   DATABASE_URL=postgresql://postgres:your_password@localhost:5432/roblox_bot
   PORT=3000
   NODE_ENV=production
   ```

   **Explanation:**
   - `DISCORD_TOKEN`: The bot token you copied from Discord Developer Portal
   - `DISCORD_CLIENT_ID`: The Application ID from Discord Developer Portal
   - `DATABASE_URL`: Connection string for your database
     - Replace `your_password` with your PostgreSQL password
     - If your database has a different name, replace `roblox_bot`
   - `PORT`: The port for the API server (default: 3000)

### Step 5: Set Up the Database

Run these commands one by one:

```bash
# Generate Prisma client
npm run prisma:generate

# Create database tables
npm run prisma:migrate
```

If it asks for a migration name, type something like `init` and press Enter.

### Step 6: Start the Bot

#### For Development (with auto-restart):
```bash
npm run dev
```

#### For Production:
```bash
npm run build
npm start
```

You should see:
```
[INFO] Bot is ready! Logged in as YourBotName#1234
[INFO] API server is running on port 3000
```

🎉 **Your bot is now running!**

### Step 7: Invite the Bot to Your Discord Server

1. Go to https://discord.com/developers/applications
2. Select your application
3. Go to **OAuth2** → **URL Generator**
4. Select these scopes:
   - ✅ `bot`
   - ✅ `applications.commands`
5. Select these bot permissions:
   - ✅ Manage Roles
   - ✅ Manage Nicknames
   - ✅ Send Messages
   - ✅ Manage Messages
   - ✅ Embed Links
   - ✅ Read Message History
   - ✅ Add Reactions
6. Copy the generated URL at the bottom
7. Paste it in your browser and select your server
8. Click **"Authorize"**

### Step 8: Configure the Bot in Discord

Run these commands in your Discord server:

```
/setprimarygroup [your_roblox_group_id]
/setlogchannel #logs
/setverifiedrole @Verified
/setunverifiedrole @Unverified
/setofficerrank 100
/setapikey
```

**Explanation:**
- `/setprimarygroup`: Your main Roblox group ID (find it in the group URL)
- `/setlogchannel`: Channel where the bot logs activities
- `/setverifiedrole`: Role given to verified members
- `/setunverifiedrole`: Role given before verification
- `/setofficerrank`: Minimum Roblox rank to give/remove points
- `/setapikey`: Generates an API key for Roblox game integration

### Step 9: Set Up Auto-Restart with PM2 (Optional but Recommended)

PM2 keeps your bot running 24/7 and restarts it if it crashes.

```bash
# Install PM2 globally
npm install -g pm2

# Build the bot first
npm run build

# Start the bot with PM2
pm2 start dist/index.js --name "roblox-bot"

# Make PM2 start on system boot
pm2 startup
pm2 save
```

**Useful PM2 commands:**
```bash
pm2 status          # Check if bot is running
pm2 logs roblox-bot # View bot logs
pm2 restart roblox-bot # Restart the bot
pm2 stop roblox-bot    # Stop the bot
```

## 🎮 Roblox Game Integration

### Setting Up the API

1. Make sure your bot is running and accessible from the internet
2. If running locally, you'll need to:
   - Port forward port 3000 on your router
   - Or use a service like **ngrok**: https://ngrok.com/

3. Get your API key by running `/setapikey` in Discord

### Installing CMDR Commands

See [`roblox/CMDR_SETUP.md`](roblox/CMDR_SETUP.md) for detailed instructions on:
- Installing CMDR in your Roblox game
- Adding the bot commands (givepoints, checkpoints, etc.)
- Configuring the API connection

## 📚 Command List

### Verification Commands
- `/verify [username]` - Start verification process
- `/verify-check [username]` - Complete verification
- `/reverify [username]` - Link a different account
- `/whois [@user or roblox username]` - Look up a user

### Role Binding Commands
- `/setprimarygroup [group id]` - Set primary Roblox group
- `/autobind` - Auto-create and bind all group ranks
- `/bind [role] [rank]` - Manually bind a rank
- `/unbind [role]` - Remove a binding
- `/binds` - List all bindings
- `/rangebind [group id] [min] [max] [role]` - Bind rank range
- `/update [@user]` - Update someone's roles

### Group Binding Commands
- `/groupbind [group id] [role]` - Bind group membership
- `/groupunbind [group id]` - Remove group binding
- `/groupbinds` - List group bindings

### Points Commands
- `/points [@user]` - Check points
- `/givepoints [@user] [amount] [reason]` - Give points
- `/removepoints [@user] [amount] [reason]` - Remove points
- `/batch [amount] [reason] @user1 @user2...` - Batch points
- `/leaderboard` - Top users by points
- `/pointshistory [@user]` - Point transactions
- `/setpoints [@user] [amount]` - Set exact points (admin)
- `/resetpoints [@user]` - Reset to 0 (admin)
- `/setthreshold [points] [message]` - Set point milestone

### Configuration Commands
- `/config` - View server configuration
- `/setlogchannel [#channel]` - Set log channel
- `/setverifiedrole [@role]` - Set verified role
- `/setunverifiedrole [@role]` - Set unverified role
- `/setofficerrank [rank]` - Set officer rank
- `/setadminrole [@role]` - Set admin role
- `/setnickname [format]` - Set nickname format
- `/setapikey [key]` - Set/generate API key
- `/setactivitypoints [type] [points]` - Configure activity points

### Utility Commands
- `/help` - Show all commands
- `/ping` - Check bot latency

## 🔌 API Endpoints

All endpoints require an API key in the request body or query parameter.

### POST `/api/points/give`
Give points to a user from Roblox game
```json
{
  "robloxId": 123456789,
  "amount": 50,
  "reason": "Attended training",
  "givenBy": 987654321,
  "apiKey": "your-api-key"
}
```

### POST `/api/points/remove`
Remove points from a user
```json
{
  "robloxId": 123456789,
  "amount": 25,
  "reason": "Penalty",
  "removedBy": 987654321,
  "apiKey": "your-api-key"
}
```

### GET `/api/points/:robloxId?apiKey=xxx`
Get user's points

### GET `/api/user/:robloxId?apiKey=xxx`
Get full user information

### POST `/api/activity/log`
Log activity (playtime, events, etc.)
```json
{
  "robloxId": 123456789,
  "activityType": "playtime",
  "value": 60,
  "metadata": {},
  "apiKey": "your-api-key"
}
```

### GET `/api/verify/:robloxId?apiKey=xxx`
Check if user is verified

## 🔧 Troubleshooting

### Bot isn't responding to commands
- Make sure the bot is online (green status)
- Check bot permissions in your server
- Try `/ping` to see if bot responds
- Check console for error messages

### "Database connection failed"
- Make sure PostgreSQL is running
- Check your DATABASE_URL in `.env`
- Verify database exists: `psql -l` (should show `roblox_bot`)

### Commands not showing in Discord
- Wait a few minutes (Discord can take time to update)
- Try kicking and re-inviting the bot
- Make sure you used the correct invite link with `applications.commands` scope

### Can't connect to API from Roblox
- Make sure your server is accessible from the internet
- Check firewall settings (allow port 3000)
- Test by visiting `http://your-ip:3000/health` in browser
- For local testing, use ngrok or similar

### Role binding not working
- Make sure bot's role is ABOVE the roles it needs to assign
- Check bot has "Manage Roles" permission
- Verify group ID and rank numbers are correct

## 📝 Opening Port 3000

### Windows Firewall:
1. Open **Windows Defender Firewall**
2. Click **"Advanced settings"**
3. Click **"Inbound Rules"** → **"New Rule"**
4. Select **"Port"** → **"TCP"** → Specific port: **3000**
5. **"Allow the connection"** → Name it "Discord Bot API"

### Router Port Forwarding:
1. Log into your router (usually 192.168.1.1 or 192.168.0.1)
2. Find **"Port Forwarding"** or **"Virtual Server"**
3. Add new rule:
   - External Port: 3000
   - Internal Port: 3000
   - Internal IP: Your computer's local IP
   - Protocol: TCP
4. Save and restart router

### Linux (UFW):
```bash
sudo ufw allow 3000/tcp
sudo ufw reload
```

## 🆘 Need Help?

If you're stuck:
1. Check the console/logs for error messages
2. Make sure all prerequisites are installed correctly
3. Verify all environment variables are set correctly
4. Check that PostgreSQL is running
5. Test the API health endpoint: `http://localhost:3000/health`

## 📁 Project Structure

```
The-CUSAR-bot/
├── src/
│   ├── commands/       # Discord slash commands
│   ├── events/         # Discord event handlers
│   ├── api/            # Express API routes
│   ├── lib/            # Utilities (Roblox API, logger, etc.)
│   ├── db/             # Prisma client
│   └── index.ts        # Main entry point
├── roblox/
│   ├── cmdr-commands/  # Lua commands for CMDR
│   ├── BotConfig.lua   # Roblox configuration
│   └── CMDR_SETUP.md   # CMDR integration guide
├── prisma/
│   └── schema.prisma   # Database schema
├── .env                # Environment variables
├── package.json        # Dependencies
└── README.md           # This file
```

## 🔒 Security Notes

1. **Never share** your `.env` file or API key publicly
2. **Use HTTPS** in production (not HTTP)
3. **Restrict CMDR commands** to trusted admins only
4. **Keep dependencies updated**: `npm update`
5. **Use strong passwords** for your database

## 📄 License

MIT License - Feel free to modify and use for your own projects!
