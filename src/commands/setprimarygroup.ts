/**
 * /setprimarygroup command - Set the primary Roblox group for role binding
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import prisma from '../db/client.js';
import { isAdmin } from '../lib/permissions.js';
import { logger } from '../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('setprimarygroup')
  .setDescription('Set the primary Roblox group for role binding')
  .addStringOption(option =>
    option
      .setName('group-id')
      .setDescription('The Roblox group ID')
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
    // Validate that the group exists
    const groupResponse = await fetch(`https://groups.roblox.com/v1/groups/${groupId}`);

    if (!groupResponse.ok) {
      return interaction.editReply({
        content: `❌ Roblox group with ID **${groupId}** not found. Please check the ID and try again.`,
      });
    }

    const groupData = await groupResponse.json();

    // Update or create guild config
    await prisma.guildConfig.upsert({
      where: { guildId: interaction.guild.id },
      update: { primaryGroupId: groupId },
      create: {
        guildId: interaction.guild.id,
        primaryGroupId: groupId,
      },
    });

    await interaction.editReply({
      content: `✅ Primary group set to **${groupData.name}** (${groupId})`,
    });

    logger.info(`${interaction.user.tag} set primary group to ${groupId} in ${interaction.guild.name}`);
  } catch (error) {
    logger.error('Error in /setprimarygroup command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while setting the primary group.',
    });
  }
}
