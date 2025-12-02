/**
 * /setpromotionrank - Configure auto-promotions
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import prisma from '../db/client.js';
import { isAdmin } from '../lib/permissions.js';
import { logger } from '../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('setpromotionrank')
  .setDescription('Set up automatic promotion at a point threshold')
  .addIntegerOption(option =>
    option
      .setName('points')
      .setDescription('Points required for this promotion')
      .setRequired(true)
      .setMinValue(1)
  )
  .addIntegerOption(option =>
    option
      .setName('rank-id')
      .setDescription('Roblox rank number (1-255) to promote to')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(255)
  )
  .addStringOption(option =>
    option
      .setName('rank-name')
      .setDescription('Name of the rank')
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

  const points = interaction.options.getInteger('points', true);
  const rankId = interaction.options.getInteger('rank-id', true);
  const rankName = interaction.options.getString('rank-name', true);

  try {
    // Create guild config if doesn't exist
    await prisma.guildConfig.upsert({
      where: { guildId: interaction.guild.id },
      update: {},
      create: { guildId: interaction.guild.id },
    });

    // Create or update promotion rank
    await prisma.promotionRank.upsert({
      where: {
        guildId_pointsRequired: {
          guildId: interaction.guild.id,
          pointsRequired: points,
        },
      },
      update: {
        robloxRankId: rankId,
        rankName: rankName,
      },
      create: {
        guildId: interaction.guild.id,
        pointsRequired: points,
        robloxRankId: rankId,
        rankName: rankName,
      },
    });

    await interaction.editReply({
      content: `✅ Auto-promotion configured!\n\n` +
               `**Points Required:** ${points}\n` +
               `**Rank:** ${rankId} - ${rankName}\n\n` +
               `Users will be automatically promoted when they reach this threshold.`,
    });

    logger.info(`${interaction.user.tag} set promotion rank at ${points} points in ${interaction.guild.name}`);
  } catch (error) {
    logger.error('Error in /setpromotionrank command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while setting the promotion rank.',
    });
  }
}
