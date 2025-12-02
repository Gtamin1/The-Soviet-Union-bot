/**
 * /setlogchannel command - Set the log channel for the bot
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ChannelType } from 'discord.js';
import prisma from '../db/client.js';
import { isAdmin } from '../lib/permissions.js';
import { logger } from '../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('setlogchannel')
  .setDescription('Set the log channel for bot activities')
  .addChannelOption(option =>
    option
      .setName('channel')
      .setDescription('The channel to use for logs')
      .setRequired(true)
      .addChannelTypes(ChannelType.GuildText)
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

  const channel = interaction.options.getChannel('channel', true);

  try {
    await prisma.guildConfig.upsert({
      where: { guildId: interaction.guild.id },
      update: { logChannelId: channel.id },
      create: {
        guildId: interaction.guild.id,
        logChannelId: channel.id,
      },
    });

    await interaction.editReply({
      content: `✅ Log channel set to <#${channel.id}>`,
    });

    logger.info(`${interaction.user.tag} set log channel to ${channel.id} in ${interaction.guild.name}`);
  } catch (error) {
    logger.error('Error in /setlogchannel command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while setting the log channel.',
    });
  }
}
