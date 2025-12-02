/**
 * /help command - Show list of all commands
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Show all available commands');

export async function execute(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setTitle('🤖 Bot Commands')
    .setColor(0x0099ff)
    .addFields(
      {
        name: '🔐 Verification',
        value: '`/verify` - Link your Roblox account\n' +
               '`/verify-check` - Check your verification code\n' +
               '`/reverify` - Link to a different Roblox account\n' +
               '`/whois` - Look up a verified user',
        inline: false,
      },
      {
        name: '🔗 Role Binding',
        value: '`/setprimarygroup` - Set primary Roblox group\n' +
               '`/autobind` - Auto-create role bindings\n' +
               '`/bind` - Manually bind rank to role\n' +
               '`/unbind` - Remove a role binding\n' +
               '`/binds` - List all role bindings\n' +
               '`/rangebind` - Bind a rank range\n' +
               '`/update` - Update user roles',
        inline: false,
      },
      {
        name: '📦 Group Bindings',
        value: '`/groupbind` - Bind group membership to role\n' +
               '`/groupunbind` - Remove group binding\n' +
               '`/groupbinds` - List group bindings',
        inline: false,
      },
      {
        name: '🏆 Points System',
        value: '`/points` - Check points\n' +
               '`/givepoints` - Give points (officer)\n' +
               '`/removepoints` - Remove points (officer)\n' +
               '`/batch` - Give points to multiple users\n' +
               '`/leaderboard` - View top users\n' +
               '`/pointshistory` - View point transactions\n' +
               '`/setpoints` - Set exact points (admin)\n' +
               '`/resetpoints` - Reset points to 0 (admin)\n' +
               '`/setthreshold` - Set point threshold (admin)',
        inline: false,
      },
      {
        name: '⚙️ Configuration',
        value: '`/config` - View server configuration\n' +
               '`/setlogchannel` - Set log channel\n' +
               '`/setverifiedrole` - Set verified role\n' +
               '`/setunverifiedrole` - Set unverified role\n' +
               '`/setofficerrank` - Set officer rank\n' +
               '`/setadminrole` - Set admin role\n' +
               '`/setnickname` - Set nickname format\n' +
               '`/setapikey` - Set API key (admin)',
        inline: false,
      },
      {
        name: '🔧 Utility',
        value: '`/help` - Show this message\n' +
               '`/ping` - Check bot latency',
        inline: false,
      }
    )
    .setFooter({ text: 'Commands marked (officer) or (admin) require special permissions' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
