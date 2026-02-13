--[[
	BAN CHECKER SCRIPT
	Place this in ServerScriptService

	Features:
	- Checks if players are banned when they join
	- Kicks banned players with reason
	- Polls for pending kicks every 10 seconds
	- Confirms kicks back to the API

	SETUP:
	1. Enable HTTP Requests in Game Settings > Security > Allow HTTP Requests
	2. Update API_URL and API_KEY below
	3. Place this script in ServerScriptService
]]

local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")

-- ============================================
-- CONFIGURATION
-- ============================================

-- Your API URL (no trailing slash)
local API_URL = "http://164.92.245.185:3000"

-- Your API key from .env
local API_KEY = "your_api_key_here"

-- ============================================
-- FUNCTIONS
-- ============================================

-- Check if a player is banned
local function checkBan(userId)
	local success, response = pcall(function()
		return HttpService:RequestAsync({
			Url = API_URL .. "/api/moderation/check/" .. tostring(userId),
			Method = "GET",
			Headers = {
				["Authorization"] = "Bearer " .. API_KEY,
				["Content-Type"] = "application/json"
			}
		})
	end)

	if success and response.StatusCode == 200 then
		local data = HttpService:JSONDecode(response.Body)
		return data.banned, data.banReason
	else
		warn("[BanChecker] Failed to check ban for user " .. userId)
		return false, nil
	end
end

-- Get pending kicks from API
local function getPendingKicks()
	local success, response = pcall(function()
		return HttpService:RequestAsync({
			Url = API_URL .. "/api/moderation/pending-kicks",
			Method = "GET",
			Headers = {
				["Authorization"] = "Bearer " .. API_KEY,
				["Content-Type"] = "application/json"
			}
		})
	end)

	if success and response.StatusCode == 200 then
		local data = HttpService:JSONDecode(response.Body)
		return data.kicks or {}
	else
		warn("[BanChecker] Failed to get pending kicks")
		return {}
	end
end

-- Confirm kick execution
local function confirmKick(robloxId)
	local success, response = pcall(function()
		return HttpService:RequestAsync({
			Url = API_URL .. "/api/moderation/kick-confirm",
			Method = "POST",
			Headers = {
				["Authorization"] = "Bearer " .. API_KEY,
				["Content-Type"] = "application/json"
			},
			Body = HttpService:JSONEncode({
				robloxId = tostring(robloxId)
			})
		})
	end)

	if success and response.StatusCode == 200 then
		print("[BanChecker] Confirmed kick for " .. robloxId)
		return true
	else
		warn("[BanChecker] Failed to confirm kick for " .. robloxId)
		return false
	end
end

-- ============================================
-- PLAYER JOIN HANDLER
-- ============================================

Players.PlayerAdded:Connect(function(player)
	-- Check if player is banned
	local isBanned, banReason = checkBan(player.UserId)

	if isBanned then
		print("[BanChecker] Kicking banned player: " .. player.Name .. " (" .. player.UserId .. ")")

		-- Kick the player
		player:Kick("You are banned from this game.\n\nReason: " .. (banReason or "No reason provided"))
	else
		print("[BanChecker] Player " .. player.Name .. " is not banned")
	end
end)

-- ============================================
-- PENDING KICK CHECKER (runs every 10 seconds)
-- ============================================

spawn(function()
	while true do
		wait(10) -- Check every 10 seconds

		-- Get pending kicks
		local pendingKicks = getPendingKicks()

		if #pendingKicks > 0 then
			print("[BanChecker] Processing " .. #pendingKicks .. " pending kick(s)")

			for _, kick in ipairs(pendingKicks) do
				local robloxId = tonumber(kick.robloxId)
				local reason = kick.reason or "Kicked by moderator"

				-- Find the player in-game
				for _, player in ipairs(Players:GetPlayers()) do
					if player.UserId == robloxId then
						print("[BanChecker] Kicking player: " .. player.Name .. " (" .. robloxId .. ")")

						-- Kick the player
						player:Kick(reason)

						-- Confirm kick
						confirmKick(robloxId)

						break
					end
				end
			end
		end
	end
end)

print("[BanChecker] Ban Checker initialized successfully!")
print("[BanChecker] API URL: " .. API_URL)
print("[BanChecker] Checking for bans on player join...")
print("[BanChecker] Checking for pending kicks every 10 seconds...")
