# TSU Bot - Complete Setup Guide

This guide will walk you through setting up the Discord + Roblox bot from scratch on an Ubuntu VPS.

**Server IP**: `164.92.245.185`
**Tech Stack**: Node.js, TypeScript, PostgreSQL, PM2, Discord.js v14, Prisma ORM

---

## 📋 Table of Contents

1. [VPS Setup](#1-vps-setup)
2. [Install Dependencies](#2-install-dependencies)
3. [Discord Bot Setup](#3-discord-bot-setup)
4. [Roblox Setup](#4-roblox-setup)
5. [Clone and Configure](#5-clone-and-configure)
6. [Database Setup](#6-database-setup)
7. [Build and Run](#7-build-and-run)
8. [Roblox Game Integration](#8-roblox-game-integration)
9. [Initial Configuration](#9-initial-configuration)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. VPS Setup

### Requirements
- **OS**: Ubuntu 24.04 LTS
- **RAM**: 2GB minimum (4GB recommended)
- **Storage**: 25GB minimum
- **Provider**: DigitalOcean, Vultr, Linode, or similar

### Initial Server Access

```bash
# SSH into your VPS
ssh root@164.92.245.185

# Update system packages
sudo apt update && sudo apt upgrade -y

# Create a new user (recommended for security)
adduser tsubot
usermod -aG sudo tsubot

# Switch to new user
su - tsubot
```

---

## 2. Install Dependencies

### Install Node.js 20 via nvm

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Install Node.js 20
nvm install 20
nvm use 20
nvm alias default 20

# Verify installation
node --version  # Should show v20.x.x
npm --version   # Should show 10.x.x
```

### Install PostgreSQL

```bash
# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql <<EOF
CREATE DATABASE tsubot;
CREATE USER tsubot WITH ENCRYPTED PASSWORD 'your_secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE tsubot TO tsubot;
\c tsubot
GRANT ALL ON SCHEMA public TO tsubot;
EOF

# Test connection
psql -U tsubot -d tsubot -h localhost
# (Enter password when prompted, then type \q to exit)
```

### Install PM2

```bash
# Install PM2 globally
npm install -g pm2

# Verify installation
pm2 --version
```

### Install Git

```bash
# Install Git
sudo apt install git -y

# Configure Git
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

---

## 3. Discord Bot Setup

### Create Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **"New Application"**
3. Name it (e.g., "TSU Bot")
4. Click **"Create"**

### Configure Bot

1. Go to **"Bot"** tab in the left sidebar
2. Click **"Add Bot"** → Confirm
3. Under **"Privileged Gateway Intents"**, enable:
   - ✅ **Presence Intent**
   - ✅ **Server Members Intent**
   - ✅ **Message Content Intent**
4. Click **"Reset Token"** → Copy the token (save this securely!)

### Get Application ID

1. Go to **"General Information"** tab
2. Copy **"Application ID"** (this is your CLIENT_ID)

### Generate Invite URL

1. Go to **"OAuth2"** → **"URL Generator"**
2. Select scopes:
   - ✅ `bot`
   - ✅ `applications.commands`
3. Select bot permissions:
   - ✅ Administrator (or specific permissions)
4. Copy the generated URL at the bottom
5. Paste URL in browser → Select your server → Authorize

---

## 4. Roblox Setup

### Create/Configure Bot Account

1. Create a new Roblox account for the bot (e.g., "TSUBot")
2. Give this account sufficient permissions in your Roblox group:
   - **Rank**: High enough to promote/demote members
   - **Permissions**: Manage members, view group info

### Get .ROBLOSECURITY Cookie

**⚠️ SECURITY WARNING**: This cookie gives full access to the Roblox account. Keep it secret!

#### Method 1: Browser (Chrome/Edge)

1. Log into Roblox.com with your bot account
2. Press `F12` (Developer Tools)
3. Go to **"Application"** tab (Chrome) or **"Storage"** tab (Firefox)
4. Click **"Cookies"** → `https://www.roblox.com`
5. Find cookie named `.ROBLOSECURITY`
6. Copy the entire **Value** (very long string)

#### Method 2: Browser Extension

1. Install "EditThisCookie" extension
2. Go to Roblox.com (logged in)
3. Click extension icon
4. Find `.ROBLOSECURITY`
5. Copy the value

### Get Group ID

1. Go to your Roblox group page
2. URL format: `https://www.roblox.com/groups/GROUP_ID/Group-Name`
3. Copy the `GROUP_ID` from the URL

### Enable HTTP Requests in Game

1. Open your game in **Roblox Studio**
2. Go to **Home** → **Game Settings** (or press Alt+S)
3. Click **"Security"** tab
4. Check ✅ **"Allow HTTP Requests"**
5. Click **"Save"**

---

## 5. Clone and Configure

### Clone Repository

```bash
# Navigate to home directory
cd /home/user

# Clone the repository
git clone https://github.com/your-username/The-CUSAR-bot.git
cd The-CUSAR-bot

# Install dependencies
npm install
```

### Create .env File

```bash
# Copy example env file
cp .env.example .env

# Edit .env file
nano .env
```

**Fill in the .env file**:

```env
# Discord Bot Configuration
DISCORD_TOKEN=your_discord_bot_token_from_step_3
DISCORD_CLIENT_ID=your_application_id_from_step_3

# Database Configuration
DATABASE_URL=postgresql://tsubot:your_secure_password_here@localhost:5432/tsubot

# Roblox Configuration
ROBLOX_COOKIE=_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items.|_YOUR_COOKIE_HERE
ROBLOX_GROUP_ID=your_group_id_from_step_4

# API Configuration
API_PORT=3000
API_KEY=generate_a_random_32_character_string_here

# Environment
NODE_ENV=production
```

**Generate API Key**:
```bash
# Generate random API key
openssl rand -hex 32
# Copy the output and paste as API_KEY in .env
```

Save and exit (`Ctrl+X`, `Y`, `Enter`)

---

## 6. Database Setup

### Run Migrations

```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate deploy

# Verify database
psql -U tsubot -d tsubot -h localhost -c "\dt"
# You should see tables: User, Ban, Warning, Kick, GuildConfig, etc.
```

---

## 7. Build and Run

### Build TypeScript

```bash
# Compile TypeScript to JavaScript
npm run build

# Verify build
ls dist/  # Should show compiled .js files
```

### Start with PM2

```bash
# Start the bot
pm2 start dist/index.js --name tsu-bot

# Save PM2 process list
pm2 save

# Set PM2 to start on boot
pm2 startup
# Copy and run the command that PM2 outputs
```

### Verify Bot is Running

```bash
# Check PM2 status
pm2 status

# View logs
pm2 logs tsu-bot

# Check health endpoint
curl http://localhost:3000/health
# Should return: {"status":"ok","timestamp":"..."}
```

---

## 8. Roblox Game Integration

### Install BanChecker Script

1. Open your game in **Roblox Studio**
2. In **Explorer** panel, find **ServerScriptService**
3. Right-click **ServerScriptService** → **Insert Object** → **Script**
4. Rename script to `BanChecker`
5. Open `roblox/BanChecker.lua` from the repository
6. Copy entire contents
7. Paste into the script in Roblox Studio
8. **IMPORTANT**: Update these lines:

```lua
local API_URL = "http://164.92.245.185:3000"  -- Your VPS IP
local API_KEY = "your_api_key_from_env_file"   -- From .env
```

9. Save and publish your game

### Verify Ban System

1. In Discord, run: `/ban roblox:TestUser reason:Testing`
2. Try to join game with that Roblox account
3. You should be kicked immediately

---

## 9. Initial Configuration

### Required Commands

Run these commands in your Discord server:

```
# 1. Set primary Roblox group
/setprimarygroup group-id:YOUR_GROUP_ID

# 2. Set verified role (users get this after /verify)
/setverifiedrole role:@Verified

# 3. Set unverified role (users get this on join)
/setunverifiedrole role:@Unverified

# 4. Set admin role
/setadminrole role:@Admin

# 5. Set officer rank (can give/remove points)
/setofficerrank rank:10

# 6. Configure moderation log channel
/setmodlog channel:#mod-logs

# 7. Configure moderator role
/setmodrole role:@Moderator

# 8. (Optional) Set auto-moderation
/setautomod auto-kick-warnings:3 auto-ban-warnings:5

# 9. (Optional) Set welcome message
/setwelcome channel:#welcome message:Welcome {user} to {server}!

# 10. (Optional) Set auto-role
/setautorole role:@Member
```

### Bind Roles to Ranks

```
# Bind Discord roles to Roblox ranks
/rangebind min-rank:1 max-rank:50 discord-role:@Member group-id:YOUR_GROUP_ID
/rangebind min-rank:51 max-rank:100 discord-role:@Officer group-id:YOUR_GROUP_ID
/rangebind min-rank:101 max-rank:255 discord-role:@Leader group-id:YOUR_GROUP_ID
```

### Set Up Auto-Promotion (Optional)

```
# Configure ranks that can be auto-promoted
/addpromotionrank points:100 rank-id:5 rank-name:Private
/addpromotionrank points:250 rank-id:10 rank-name:Corporal
/addpromotionrank points:500 rank-id:15 rank-name:Sergeant
```

### Test the Bot

```
# 1. Verify a user
/verify

# 2. Give points
/givepoints user:@Someone amount:10 reason:Testing

# 3. Check points
/points user:@Someone

# 4. Update roles
/updateroles user:@Someone

# 5. Test ban
/ban user:@Someone reason:Testing duration:1h

# 6. View banlist
/banlist
```

---

## 10. Troubleshooting

### Bot Not Online

```bash
# Check PM2 status
pm2 status

# View logs for errors
pm2 logs tsu-bot --lines 100

# Restart bot
pm2 restart tsu-bot

# If still not working, check environment
cd /home/user/The-CUSAR-bot
node dist/index.js
# Look for error messages
```

### Commands Not Showing in Discord

```bash
# Re-register commands
cd /home/user/The-CUSAR-bot
node dist/index.js

# Wait 1-2 minutes for Discord to update
# Try restarting Discord client
```

### Database Connection Errors

```bash
# Test database connection
psql -U tsubot -d tsubot -h localhost

# Check if PostgreSQL is running
sudo systemctl status postgresql

# Restart PostgreSQL
sudo systemctl restart postgresql

# Check DATABASE_URL in .env
cat .env | grep DATABASE_URL
```

### Roblox API Errors in Game

**Error: "HTTP 403 Forbidden"**
- Make sure HTTP Requests are enabled in Game Settings
- Verify you saved and published the game after enabling

**Error: "HTTP 401 Unauthorized"**
- Check API_KEY in BanChecker.lua matches .env file
- Make sure API_KEY has no spaces or quotes

**Error: "Unable to connect"**
- Verify bot is running: `pm2 status`
- Check API is accessible: `curl http://164.92.245.185:3000/health`
- Make sure firewall allows port 3000

### Permission Errors

```bash
# Give bot Administrator permission in Discord
# Or assign specific permissions:
# - Manage Roles
# - Manage Channels
# - Kick Members
# - Ban Members
# - Send Messages
# - Embed Links
# - Manage Messages
```

### Points Not Tracking

```bash
# Check if user is verified
# Run in Discord: /points user:@User

# Check playtime tracker in Roblox Studio Output
# Look for API request logs in PM2:
pm2 logs tsu-bot | grep "activity"
```

---

## 📊 Maintenance Commands

### Update Bot

```bash
cd /home/user/The-CUSAR-bot
git pull
npm install
npm run build
pm2 restart tsu-bot
```

### View Logs

```bash
# Real-time logs
pm2 logs tsu-bot

# Last 100 lines
pm2 logs tsu-bot --lines 100

# Error logs only
pm2 logs tsu-bot --err
```

### Database Backup

```bash
# Manual backup
./scripts/backup.sh

# Set up automatic daily backups
crontab -e
# Add this line:
0 2 * * * /home/user/The-CUSAR-bot/scripts/backup.sh

# Restore from backup
psql -U tsubot -d tsubot -h localhost < /home/user/backups/tsubot_TIMESTAMP.sql
```

### Monitor Resources

```bash
# Check CPU/RAM usage
pm2 monit

# Check disk space
df -h

# Check database size
sudo -u postgres psql -c "SELECT pg_size_pretty(pg_database_size('tsubot'));"
```

---

## 🔒 Security Recommendations

1. **Never share**:
   - Discord bot token
   - Roblox .ROBLOSECURITY cookie
   - API_KEY
   - Database password

2. **Use strong passwords** for:
   - VPS root/user account
   - PostgreSQL database
   - API key (use `openssl rand -hex 32`)

3. **Set up firewall**:
```bash
sudo ufw allow 22    # SSH
sudo ufw allow 3000  # API
sudo ufw enable
```

4. **Regular updates**:
```bash
sudo apt update && sudo apt upgrade -y
npm update
```

5. **Monitor logs** for suspicious activity:
```bash
pm2 logs tsu-bot | grep "401\|403\|error"
```

---

## 📞 Need Help?

If you encounter issues not covered here:

1. Check bot logs: `pm2 logs tsu-bot`
2. Check database: `psql -U tsubot -d tsubot`
3. Test API: `curl http://164.92.245.185:3000/health`
4. Verify Discord bot token: Check Developer Portal
5. Check Roblox Studio Output window for game errors

---

## ✅ Checklist

After completing setup, verify:

- [ ] Bot is online in Discord (green status)
- [ ] Commands are registered (type `/` in Discord)
- [ ] PostgreSQL is running
- [ ] PM2 shows bot as "online"
- [ ] Health endpoint responds: `curl http://localhost:3000/health`
- [ ] BanChecker script is in Roblox game
- [ ] HTTP Requests enabled in Roblox game settings
- [ ] Initial config commands completed
- [ ] Test `/verify`, `/points`, `/ban` work correctly

---

**🎉 Setup Complete!**

Your TSU Bot is now fully operational with:
- ✅ Discord bot with 50+ commands
- ✅ Roblox integration for bans, kicks, points
- ✅ Complete moderation system
- ✅ Auto-promotion and role management
- ✅ Stats channels, tickets, suggestions, giveaways
- ✅ Playtime tracking and points system

Enjoy your new bot!
