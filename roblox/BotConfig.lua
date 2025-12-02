-- Configuration module for Discord Bot API integration
-- Place this in ServerScriptService or ReplicatedStorage

local BotConfig = {}

-- IMPORTANT: Set these values!
BotConfig.API_URL = "http://your-server-ip:3000"  -- Replace with your server's IP and port
BotConfig.API_KEY = "your_api_key_here"           -- Get this from /setapikey command in Discord

return BotConfig
