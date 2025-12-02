-- Server-side implementation for givepoints command

local HttpService = game:GetService("HttpService")
local Config = require(script.Parent.Parent.BotConfig) -- You'll create this

return function(context, player, amount, reason)
	-- Validate amount
	if amount <= 0 then
		return "Amount must be positive"
	end

	-- Get player's Roblox ID
	local robloxId = player.UserId
	local givenBy = context.Executor.UserId

	-- Prepare API request
	local url = Config.API_URL .. "/api/points/give"
	local headers = {
		["Content-Type"] = "application/json"
	}
	local body = HttpService:JSONEncode({
		robloxId = robloxId,
		amount = amount,
		reason = reason,
		givenBy = givenBy,
		apiKey = Config.API_KEY
	})

	-- Make request
	local success, response = pcall(function()
		return HttpService:RequestAsync({
			Url = url,
			Method = "POST",
			Headers = headers,
			Body = body
		})
	end)

	if not success then
		return "Failed to connect to API: " .. tostring(response)
	end

	if response.StatusCode ~= 200 then
		local errorData = HttpService:JSONDecode(response.Body)
		return "Error: " .. (errorData.error or "Unknown error")
	end

	local data = HttpService:JSONDecode(response.Body)

	if data.success then
		return string.format(
			"✅ Gave %d points to %s. New total: %d points",
			amount,
			player.Name,
			data.user.points
		)
	else
		return "Failed to give points"
	end
end
