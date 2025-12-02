-- givepoints command for CMDR
-- Usage: givepoints [player] [amount] [reason]

return {
	Name = "givepoints",
	Aliases = {},
	Description = "Give points to a player",
	Group = "Admin",
	Args = {
		{
			Type = "player",
			Name = "Player",
			Description = "The player to give points to",
		},
		{
			Type = "number",
			Name = "Amount",
			Description = "Amount of points to give",
		},
		{
			Type = "string",
			Name = "Reason",
			Description = "Reason for giving points",
			Default = "No reason provided",
		},
	},
}
