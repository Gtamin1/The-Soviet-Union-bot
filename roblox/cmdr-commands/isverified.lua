-- isverified command for CMDR
-- Usage: isverified [player]

return {
	Name = "isverified",
	Aliases = {"checkverified"},
	Description = "Check if a player is verified with the Discord bot",
	Group = "Admin",
	Args = {
		{
			Type = "player",
			Name = "Player",
			Description = "The player to check",
		},
	},
}
