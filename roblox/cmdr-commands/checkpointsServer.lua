-- Server-side implementation for checkpoints command

local HttpService = game:GetService("HttpService")
local Config = require(script.Parent.Parent.BotConfig)

return function(context, player)
	-- Get player's Roblox ID
	local robloxId = player.UserId

	-- Prepare API request
	local url = string.format("%s/api/points/%d?apiKey=%s", Config.API_URL, robloxId, Config.API_KEY)

	-- Make request
	local success, response = pcall(function()
		return HttpService:RequestAsync({
			Url = url,
			Method = "GET"
		})
	end)

	if not success then
		return "Failed to connect to API: " .. tostring(response)
	end

	if response.StatusCode == 404 then
		return player.Name .. " is not verified with the Discord bot"
	end

	if response.StatusCode ~= 200 then
		local errorData = HttpService:JSONDecode(response.Body)
		return "Error: " .. (errorData.error or "Unknown error")
	end

	local data = HttpService:JSONDecode(response.Body)

	if data.success then
		return string.format(
			"📊 %s (@%s) has %d points",
			player.Name,
			data.user.robloxUsername,
			data.user.points
		)
	else
		return "Failed to check points"
	end
end
