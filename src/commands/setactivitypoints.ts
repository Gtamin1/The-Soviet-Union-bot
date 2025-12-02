/**
 * /setactivitypoints command - Configure automatic points for activities
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import prisma from '../db/client.js';
import { isAdmin } from '../lib/permissions.js';
import { logger } from '../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('setactivitypoints')
  .setDescription('Configure automatic points for activities')
  .addStringOption(option =>
    option
      .setName('activity-type')
      .setDescription('Type of activity (e.g., playtime, training, event)')
      .setRequired(true)
  )
  .addNumberOption(option =>
    option
      .setName('points-per-unit')
      .setDescription('Points awarded per unit (e.g., 1 point per minute, 50 points per training)')
      .setRequired(true)
      .setMinValue(0)
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

  const activityType = interaction.options.getString('activity-type', true);
  const pointsPerUnit = interaction.options.getNumber('points-per-unit', true);

  try {
    // Create guild config if it doesn't exist
    await prisma.guildConfig.upsert({
      where: { guildId: interaction.guild.id },
      update: {},
      create: { guildId: interaction.guild.id },
    });

    // Create or update activity config
    await prisma.activityConfig.upsert({
      where: {
        guildId_activityType: {
          guildId: interaction.guild.id,
          activityType: activityType,
        },
      },
      update: {
        pointsPerUnit: pointsPerUnit,
      },
      create: {
        guildId: interaction.guild.id,
        activityType: activityType,
        pointsPerUnit: pointsPerUnit,
      },
    });

    await interaction.editReply({
      content: `✅ Activity points configured!\n\n` +
               `**Activity Type:** ${activityType}\n` +
               `**Points Per Unit:** ${pointsPerUnit}\n\n` +
               `Users will now automatically receive ${pointsPerUnit} points per unit of this activity when logged via the API.`,
    });

    logger.info(`${interaction.user.tag} set activity points for ${activityType} to ${pointsPerUnit} in ${interaction.guild.name}`);
  } catch (error) {
    logger.error('Error in /setactivitypoints command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while setting activity points.',
    });
  }
}
