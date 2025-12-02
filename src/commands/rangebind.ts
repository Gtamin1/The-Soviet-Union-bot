/**
 * /rangebind command - Bind a range of Roblox ranks to a Discord role
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import prisma from '../db/client.js';
import { isAdmin } from '../lib/permissions.js';
import { logger } from '../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('rangebind')
  .setDescription('Bind a range of Roblox ranks to a Discord role')
  .addIntegerOption(option =>
    option
      .setName('min-rank')
      .setDescription('Minimum rank number')
      .setRequired(true)
      .setMinValue(0)
      .setMaxValue(255)
  )
  .addIntegerOption(option =>
    option
      .setName('max-rank')
      .setDescription('Maximum rank number')
      .setRequired(true)
      .setMinValue(0)
      .setMaxValue(255)
  )
  .addRoleOption(option =>
    option
      .setName('discord-role')
      .setDescription('The Discord role to bind')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('group-id')
      .setDescription('The Roblox group ID (or use primary group if empty)')
      .setRequired(false)
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

  const groupIdOption = interaction.options.getString('group-id');
  const minRank = interaction.options.getInteger('min-rank', true);
  const maxRank = interaction.options.getInteger('max-rank', true);
  const discordRole = interaction.options.getRole('discord-role', true);

  if (minRank > maxRank) {
    return interaction.editReply({
      content: '❌ Minimum rank cannot be greater than maximum rank.',
    });
  }

  try {
    // Get guild config
    const config = await prisma.guildConfig.findUnique({
      where: { guildId: interaction.guild.id },
    });

    const groupId = groupIdOption || config?.primaryGroupId;

    if (!groupId) {
      return interaction.editReply({
        content: '❌ No primary group set and no group ID provided. Use `/setprimarygroup` first or provide a group ID.',
      });
    }

    // Check if binding already exists for this role
    const existingBinding = await prisma.roleBinding.findFirst({
      where: {
        guildId: interaction.guild.id,
        discordRoleId: discordRole.id,
      },
    });

    if (existingBinding) {
      return interaction.editReply({
        content: `❌ ${discordRole} is already bound. Use \`/unbind\` first to remove it.`,
      });
    }

    // Create binding
    await prisma.roleBinding.create({
      data: {
        guildId: interaction.guild.id,
        discordRoleId: discordRole.id,
        groupId: groupId,
        minRank: minRank,
        maxRank: maxRank,
      },
    });

    await interaction.editReply({
      content: `✅ Bound ${discordRole} to ranks **${minRank}-${maxRank}** in group \`${groupId}\``,
    });

    logger.info(`${interaction.user.tag} bound ${discordRole.name} to ranks ${minRank}-${maxRank} in ${interaction.guild.name}`);
  } catch (error) {
    logger.error('Error in /rangebind command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while creating the binding.',
    });
  }
}
