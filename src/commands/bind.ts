/**
 * /bind command - Manually bind a Roblox rank to a Discord role
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import prisma from '../db/client.js';
import { isAdmin } from '../lib/permissions.js';
import { logger } from '../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('bind')
  .setDescription('Bind a Roblox rank to a Discord role')
  .addRoleOption(option =>
    option
      .setName('discord-role')
      .setDescription('The Discord role to bind')
      .setRequired(true)
  )
  .addIntegerOption(option =>
    option
      .setName('rank')
      .setDescription('The exact Roblox rank number')
      .setRequired(true)
      .setMinValue(0)
      .setMaxValue(255)
  )
  .addStringOption(option =>
    option
      .setName('rank-name')
      .setDescription('The rank name (optional, for reference)')
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

  const discordRole = interaction.options.getRole('discord-role', true);
  const rank = interaction.options.getInteger('rank', true);
  const rankName = interaction.options.getString('rank-name');

  try {
    // Get guild config
    const config = await prisma.guildConfig.findUnique({
      where: { guildId: interaction.guild.id },
    });

    if (!config?.primaryGroupId) {
      return interaction.editReply({
        content: '❌ No primary group set. Use `/setprimarygroup` first.',
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
        content: `❌ ${discordRole} is already bound to rank ${existingBinding.exactRank}. Use \`/unbind\` first to remove it.`,
      });
    }

    // Create binding
    await prisma.roleBinding.create({
      data: {
        guildId: interaction.guild.id,
        discordRoleId: discordRole.id,
        groupId: config.primaryGroupId,
        exactRank: rank,
        rankName: rankName || undefined,
      },
    });

    await interaction.editReply({
      content: `✅ Bound ${discordRole} to rank **${rank}** ${rankName ? `(${rankName})` : ''}`,
    });

    logger.info(`${interaction.user.tag} bound ${discordRole.name} to rank ${rank} in ${interaction.guild.name}`);
  } catch (error) {
    logger.error('Error in /bind command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while creating the binding.',
    });
  }
}
