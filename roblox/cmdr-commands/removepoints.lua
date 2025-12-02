-- removepoints command for CMDR
-- Usage: removepoints [player] [amount] [reason]

return {
	Name = "removepoints",
	Aliases = {},
	Description = "Remove points from a player",
	Group = "Admin",
	Args = {
		{
			Type = "player",
			Name = "Player",
			Description = "The player to remove points from",
		},
		{
			Type = "number",
			Name = "Amount",
			Description = "Amount of points to remove",
		},
		{
			Type = "string",
			Name = "Reason",
			Description = "Reason for removing points",
			Default = "No reason provided",
		},
	},
}
