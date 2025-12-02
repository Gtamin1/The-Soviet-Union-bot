/**
 * /setofficerrank command - Set the minimum Roblox rank to be considered an officer
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import prisma from '../db/client.js';
import { isAdmin } from '../lib/permissions.js';
import { logger } from '../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('setofficerrank')
  .setDescription('Set the minimum Roblox rank to be considered an officer')
  .addIntegerOption(option =>
    option
      .setName('rank')
      .setDescription('Minimum rank number')
      .setRequired(true)
      .setMinValue(0)
      .setMaxValue(255)
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

  const rank = interaction.options.getInteger('rank', true);

  try {
    await prisma.guildConfig.upsert({
      where: { guildId: interaction.guild.id },
      update: { officerRank: rank },
      create: {
        guildId: interaction.guild.id,
        officerRank: rank,
      },
    });

    await interaction.editReply({
      content: `✅ Officer rank set to **${rank}**\n\nUsers with rank ${rank} or higher in the primary group can now give/remove points.`,
    });

    logger.info(`${interaction.user.tag} set officer rank to ${rank} in ${interaction.guild.name}`);
  } catch (error) {
    logger.error('Error in /setofficerrank command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while setting the officer rank.',
    });
  }
}
