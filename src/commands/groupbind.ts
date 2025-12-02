/**
 * /groupbind command - Bind membership in a Roblox group to a Discord role
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import prisma from '../db/client.js';
import { isAdmin } from '../lib/permissions.js';
import { logger } from '../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('groupbind')
  .setDescription('Bind membership in a Roblox group to a Discord role')
  .addStringOption(option =>
    option
      .setName('group-id')
      .setDescription('The Roblox group ID')
      .setRequired(true)
  )
  .addRoleOption(option =>
    option
      .setName('discord-role')
      .setDescription('The Discord role to bind')
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
  const discordRole = interaction.options.getRole('discord-role', true);

  try {
    // Validate that the group exists
    const groupResponse = await fetch(`https://groups.roblox.com/v1/groups/${groupId}`);

    if (!groupResponse.ok) {
      return interaction.editReply({
        content: `❌ Roblox group with ID **${groupId}** not found. Please check the ID and try again.`,
      });
    }

    const groupData = await groupResponse.json();

    // Check if binding already exists
    const existingBinding = await prisma.groupBinding.findFirst({
      where: {
        guildId: interaction.guild.id,
        groupId: groupId,
      },
    });

    if (existingBinding) {
      return interaction.editReply({
        content: `❌ Group **${groupData.name}** is already bound to <@&${existingBinding.discordRoleId}>`,
      });
    }

    // Create guild config if it doesn't exist
    await prisma.guildConfig.upsert({
      where: { guildId: interaction.guild.id },
      update: {},
      create: { guildId: interaction.guild.id },
    });

    // Create binding
    await prisma.groupBinding.create({
      data: {
        guildId: interaction.guild.id,
        groupId: groupId,
        discordRoleId: discordRole.id,
      },
    });

    await interaction.editReply({
      content: `✅ Bound ${discordRole} to group **${groupData.name}** (${groupId})\n\nMembers in this group will automatically receive this role.`,
    });

    logger.info(`${interaction.user.tag} bound ${discordRole.name} to group ${groupId} in ${interaction.guild.name}`);
  } catch (error) {
    logger.error('Error in /groupbind command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while creating the group binding.',
    });
  }
}
