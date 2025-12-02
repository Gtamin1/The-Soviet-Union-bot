/**
 * /groupunbind command - Remove a group binding
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import prisma from '../db/client.js';
import { isAdmin } from '../lib/permissions.js';
import { logger } from '../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('groupunbind')
  .setDescription('Remove a group binding')
  .addStringOption(option =>
    option
      .setName('group-id')
      .setDescription('The Roblox group ID to unbind')
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

  const groupId = interaction.options.getString('group-id', true);

  try {
    // Find and delete binding
    const binding = await prisma.groupBinding.findFirst({
      where: {
        guildId: interaction.guild.id,
        groupId: groupId,
      },
    });

    if (!binding) {
      return interaction.editReply({
        content: `❌ Group \`${groupId}\` is not bound to any role.`,
      });
    }

    await prisma.groupBinding.delete({
      where: { id: binding.id },
    });

    await interaction.editReply({
      content: `✅ Removed group binding for group \`${groupId}\``,
    });

    logger.info(`${interaction.user.tag} unbound group ${groupId} in ${interaction.guild.name}`);
  } catch (error) {
    logger.error('Error in /groupunbind command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while removing the group binding.',
    });
  }
}
