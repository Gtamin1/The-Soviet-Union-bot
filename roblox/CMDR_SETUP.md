# CMDR Integration Setup Guide

This guide explains how to integrate the Discord bot commands into your Roblox game using CMDR.

## Prerequisites

1. **CMDR** - Download from: https://github.com/evaera/Cmdr
2. **HttpService enabled** - In your game settings, enable "Allow HTTP Requests"
3. **API Key** - Get this from your Discord bot using `/setapikey`

## Installation Steps

### Step 1: Install CMDR

1. Get CMDR from the GitHub repository or Roblox library
2. Place the CMDR folder in `ReplicatedStorage`
3. Follow CMDR's setup instructions to initialize it in your game

### Step 2: Configure the Bot API

1. Open `BotConfig.lua` in this folder
2. Replace `API_URL` with your server's IP address and port
   - Example: `http://123.456.789.0:3000`
   - If running locally for testing: `http://localhost:3000`
3. Replace `API_KEY` with the key from `/setapikey` Discord command
4. Place `BotConfig.lua` in `ServerScriptService`

```lua
-- Example BotConfig.lua
local BotConfig = {}

BotConfig.API_URL = "http://123.456.789.0:3000"
BotConfig.API_KEY = "abc123def456..."

return BotConfig
```

### Step 3: Add Commands to CMDR

1. In your CMDR installation, locate the `Commands` folder (usually in `ReplicatedStorage.Cmdr.Commands`)
2. Copy all `.lua` files from the `cmdr-commands` folder into the CMDR Commands folder:
   - `givepoints.lua`
   - `givepointsServer.lua`
   - `removepoints.lua`
   - `removepointsServer.lua`
   - `checkpoints.lua`
   - `checkpointsServer.lua`
   - `isverified.lua`
   - `isverifiedServer.lua`

### Step 4: Test the Commands

1. Join your game
2. Open the CMDR console (usually by pressing `;` or `/`)
3. Try the commands:
   ```
   givepoints PlayerName 50 "Good job at the training"
   checkpoints PlayerName
   isverified PlayerName
   removepoints PlayerName 10 "Minus points for being late"
   ```

## Available Commands

### `givepoints [player] [amount] [reason]`
Give points to a player
- **Example:** `givepoints JohnDoe 100 "Excellent performance"`

### `removepoints [player] [amount] [reason]`
Remove points from a player
- **Example:** `removepoints JohnDoe 50 "Penalty for rule violation"`

### `checkpoints [player]`
Check how many points a player has
- **Example:** `checkpoints JohnDoe`
- **Alias:** `points [player]`

### `isverified [player]`
Check if a player is verified with the Discord bot
- **Example:** `isverified JohnDoe`
- **Alias:** `checkverified [player]`

## Troubleshooting

### "Failed to connect to API"
- Check that your server is running and accessible
- Verify the API_URL in BotConfig.lua is correct
- Ensure your firewall allows traffic on port 3000
- Test the API by visiting `http://your-ip:3000/health` in a browser

### "Invalid API key"
- Run `/setapikey` in Discord to get a new API key
- Make sure you copied the entire key into BotConfig.lua
- The key is case-sensitive

### "Player is not verified"
- The player needs to verify using `/verify` in Discord first
- Check if they completed the verification process with `/verify-check`

### HttpService errors
- Make sure "Allow HTTP Requests" is enabled in Game Settings
- You may need to whitelist your API URL in Roblox Studio settings

## Security Notes

1. **Never commit your API key** to version control
2. **Keep your API URL private** - don't share it publicly
3. **Use HTTPS in production** - HTTP is only for local testing
4. **Restrict CMDR access** - only trusted admins should use these commands

## Advanced Usage

### Logging Activity

You can also log playtime, events, etc. using the activity API:

```lua
local HttpService = game:GetService("HttpService")
local Config = require(script.Parent.BotConfig)

-- Log 60 minutes of playtime
local function logPlaytime(player, minutes)
    local url = Config.API_URL .. "/api/activity/log"
    local body = HttpService:JSONEncode({
        robloxId = player.UserId,
        activityType = "playtime",
        value = minutes,
        apiKey = Config.API_KEY
    })

    HttpService:RequestAsync({
        Url = url,
        Method = "POST",
        Headers = {["Content-Type"] = "application/json"},
        Body = body
    })
end
```

### Auto-Points for Activities

If you set up activity points in Discord (e.g., `/setactivitypoints playtime 1`), players will automatically earn points when you log their activity via the API.

## Need Help?

If you encounter issues, check:
1. Server logs for error messages
2. Discord bot's log channel (if configured)
3. Roblox Studio output for error messages
