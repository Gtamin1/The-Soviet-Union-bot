/**
 * /binds command - List all current role bindings
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import prisma from '../db/client.js';
import { logger } from '../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('binds')
  .setDescription('List all current role bindings');

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    return interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
  }

  await interaction.deferReply();

  try {
    const config = await prisma.guildConfig.findUnique({
      where: { guildId: interaction.guild.id },
      include: {
        roleBindings: true,
      },
    });

    if (!config?.primaryGroupId) {
      return interaction.editReply({
        content: '❌ No primary group set. Use `/setprimarygroup` first.',
      });
    }

    const roleBindings = config.roleBindings;

    if (roleBindings.length === 0) {
      return interaction.editReply({
        content: '❌ No role bindings configured. Use `/autobind` or `/bind` to create bindings.',
      });
    }

    const embed = new EmbedBuilder()
      .setTitle('🔗 Role Bindings')
      .setDescription(`Primary Group: \`${config.primaryGroupId}\``)
      .setColor(0x0099ff)
      .setTimestamp();

    // Sort by rank
    const sortedBindings = roleBindings.sort((a, b) => {
      const rankA = a.exactRank ?? a.minRank ?? 0;
      const rankB = b.exactRank ?? b.minRank ?? 0;
      return rankB - rankA;
    });

    for (const binding of sortedBindings) {
      let rankDisplay = '';
      if (binding.exactRank !== null) {
        rankDisplay = `Rank ${binding.exactRank}`;
      } else if (binding.minRank !== null && binding.maxRank !== null) {
        rankDisplay = `Ranks ${binding.minRank}-${binding.maxRank}`;
      }

      const roleName = binding.rankName ? ` (${binding.rankName})` : '';

      embed.addFields({
        name: `<@&${binding.discordRoleId}>`,
        value: `${rankDisplay}${roleName}`,
        inline: true,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Error in /binds command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while fetching bindings.',
    });
  }
}
