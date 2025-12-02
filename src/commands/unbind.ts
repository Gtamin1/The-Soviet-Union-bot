/**
 * /unbind command - Remove a role binding
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import prisma from '../db/client.js';
import { isAdmin } from '../lib/permissions.js';
import { logger } from '../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('unbind')
  .setDescription('Remove a role binding')
  .addRoleOption(option =>
    option
      .setName('discord-role')
      .setDescription('The Discord role to unbind')
      .setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild || !interaction.member) {
    return interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
  }

  // Check permissions
  if (!(await isAdmin(interaction.member as any))) {
    return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
  }

  await interaction.deferReply();

  const discordRole = interaction.options.getRole('discord-role', true);

  try {
    // Find and delete binding
    const binding = await prisma.roleBinding.findFirst({
      where: {
        guildId: interaction.guild.id,
        discordRoleId: discordRole.id,
      },
    });

    if (!binding) {
      return interaction.editReply({
        content: `❌ ${discordRole} is not bound to any rank.`,
      });
    }

    await prisma.roleBinding.delete({
      where: { id: binding.id },
    });

    await interaction.editReply({
      content: `✅ Unbound ${discordRole} from rank **${binding.exactRank || `${binding.minRank}-${binding.maxRank}`}**`,
    });

    logger.info(`${interaction.user.tag} unbound ${discordRole.name} in ${interaction.guild.name}`);
  } catch (error) {
    logger.error('Error in /unbind command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while removing the binding.',
    });
  }
}
