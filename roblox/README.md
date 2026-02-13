# Roblox Game Scripts

This folder contains Lua scripts that integrate your Roblox game with the TSU Bot moderation and points system.

## 📋 Prerequisites

Before installing these scripts, make sure you have:

1. **HTTP Requests Enabled**: Game Settings > Security > **Allow HTTP Requests** ✅
2. **API Key**: Copy the `API_KEY` from your bot's `.env` file
3. **Server IP**: Know your VPS IP address (default: `164.92.245.185`)

## 🚀 Installation

### Step 1: Ban Checker Script

**Purpose**: Automatically kicks banned players and processes kick requests from Discord

**Installation**:
1. Open Roblox Studio
2. Open your game
3. In the Explorer panel, find **ServerScriptService**
4. Right-click ServerScriptService → Insert Object → Script
5. Rename the script to `BanChecker`
6. Copy the contents of `BanChecker.lua` from this folder
7. Paste into the script in Roblox Studio
8. **IMPORTANT**: Update these lines at the top:
   ```lua
   local API_URL = "http://YOUR_SERVER_IP:3000"  -- Change to your VPS IP
   local API_KEY = "your_api_key_here"           -- Change to your actual API key
   ```

**What it does**:
- When a player joins, checks if they're banned via API
- If banned, kicks them immediately with the ban reason
- Every 10 seconds, polls for pending kicks (kicks issued from Discord)
- Executes kicks and confirms back to the API

### Step 2: Playtime Tracker Script

**Purpose**: Tracks player playtime and sends it to the bot for points

**Note**: This script should already be in your game from the previous setup. If not:

1. Open **ServerScriptService**
2. Create a new Script called `PlaytimeTracker`
3. Add the playtime tracking code (should track session duration)
4. Make sure it sends data to `/api/activity/log` endpoint

**Example API Call**:
```lua
HttpService:RequestAsync({
    Url = API_URL .. "/api/activity/log",
    Method = "POST",
    Headers = {
        ["Authorization"] = "Bearer " .. API_KEY,
        ["Content-Type"] = "application/json"
    },
    Body = HttpService:JSONEncode({
        robloxId = player.UserId,
        activityType = "playtime",
        duration = sessionDuration
    })
})
```

## 🧪 Testing

### Test Ban System:

1. In Discord, run: `/ban roblox:TestUser reason:Testing bans`
2. Try to join the game with that Roblox account
3. You should be kicked immediately with the ban reason

### Test Kick System:

1. Join the game with a Roblox account
2. In Discord, run: `/kick roblox:YourUsername reason:Testing kicks`
3. Within 10 seconds, you should be kicked from the game

### Test Playtime Tracking:

1. Join the game and play for a few minutes
2. Leave the game
3. In Discord, run: `/points @YourDiscordUser`
4. You should see points awarded for playtime

## 🔧 Troubleshooting

### "HTTP 403 Forbidden" errors:
- Make sure HTTP Requests are enabled in Game Settings
- Check that your API key is correct (copy from `.env` file)

### "HTTP 401 Unauthorized" errors:
- Your API key is incorrect or missing
- Make sure you're using `Bearer YOUR_API_KEY` format

### "Unable to connect" errors:
- Check that your VPS is running (`pm2 status`)
- Verify the API URL is correct (should be `http://YOUR_IP:3000`)
- Make sure port 3000 is not blocked by firewall

### Players not getting kicked:
- Check the server console in Roblox Studio (View → Output)
- Look for `[BanChecker]` messages
- Verify the ban exists in Discord with `/banlist`

### Playtime not tracking:
- Make sure PlaytimeTracker script is running
- Check API logs: SSH into server, run `pm2 logs tsu-bot`
- Verify user is verified in Discord with `/verify`

## 📊 Monitoring

To see if scripts are working:

1. **In Roblox Studio**: View → Output (look for `[BanChecker]` messages)
2. **On VPS**: `pm2 logs tsu-bot` (see API requests from game)
3. **In Discord**: Use `/modlogs`, `/banlist`, `/points` commands

## 🔒 Security Notes

- **NEVER share your API key publicly**
- Keep the `API_KEY` variable in your Roblox scripts private
- If your API key is compromised, regenerate it in the `.env` file and update all scripts
- The ban checker runs on the server (ServerScriptService), not client-side, so it's secure

## 📞 Need Help?

If you encounter issues:

1. Check the Roblox Studio Output window for errors
2. Check bot logs on VPS: `pm2 logs tsu-bot`
3. Verify HTTP requests are enabled in Game Settings
4. Make sure the bot is running: `pm2 status`
5. Test the API manually: `curl http://YOUR_IP:3000/health`

## 🎯 API Endpoints Used

These scripts call these endpoints:

- `GET /api/moderation/check/:robloxId` - Check if user is banned
- `GET /api/moderation/pending-kicks` - Get kicks from Discord
- `POST /api/moderation/kick-confirm` - Confirm kick execution
- `POST /api/activity/log` - Log playtime (for PlaytimeTracker)

All endpoints require Bearer token authentication with your API key.
