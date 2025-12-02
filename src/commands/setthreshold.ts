/**
 * /setthreshold command - Set a point threshold for automatic notifications
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import prisma from '../db/client.js';
import { isAdmin } from '../lib/permissions.js';
import { logger } from '../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('setthreshold')
  .setDescription('Set a point threshold for automatic notifications')
  .addIntegerOption(option =>
    option
      .setName('points')
      .setDescription('Points required to trigger notification')
      .setRequired(true)
      .setMinValue(1)
  )
  .addStringOption(option =>
    option
      .setName('message')
      .setDescription('Message to send when threshold is reached')
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
  const message = interaction.options.getString('message', true);

  try {
    // Create guild config if it doesn't exist
    await prisma.guildConfig.upsert({
      where: { guildId: interaction.guild.id },
      update: {},
      create: { guildId: interaction.guild.id },
    });

    // Create threshold
    await prisma.pointThreshold.create({
      data: {
        guildId: interaction.guild.id,
        pointsRequired: points,
        message: message,
      },
    });

    await interaction.editReply({
      content: `✅ Threshold set! Users will receive a DM when they reach **${points}** points:\n\n"${message}"`,
    });

    logger.info(`${interaction.user.tag} set a point threshold at ${points} in ${interaction.guild.name}`);
  } catch (error) {
    logger.error('Error in /setthreshold command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while setting the threshold.',
    });
  }
}
