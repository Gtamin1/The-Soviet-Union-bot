-- checkpoints command for CMDR
-- Usage: checkpoints [player]

return {
	Name = "checkpoints",
	Aliases = {"points"},
	Description = "Check a player's points",
	Group = "Admin",
	Args = {
		{
			Type = "player",
			Name = "Player",
			Description = "The player to check points for",
		},
	},
}
