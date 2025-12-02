/**
 * /config command - View current server configuration
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import prisma from '../db/client.js';
import { logger } from '../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('config')
  .setDescription('View current server configuration');

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    return interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
  }

  await interaction.deferReply();

  try {
    const config = await prisma.guildConfig.findUnique({
      where: { guildId: interaction.guild.id },
    });

    if (!config) {
      return interaction.editReply({
        content: '❌ No configuration found for this server. Use configuration commands to set up the bot.',
      });
    }

    const embed = new EmbedBuilder()
      .setTitle('⚙️ Server Configuration')
      .setColor(0x0099ff)
      .addFields(
        {
          name: 'Primary Group',
          value: config.primaryGroupId || 'Not set',
          inline: true,
        },
        {
          name: 'Verified Role',
          value: config.verifiedRoleId ? `<@&${config.verifiedRoleId}>` : 'Not set',
          inline: true,
        },
        {
          name: 'Unverified Role',
          value: config.unverifiedRoleId ? `<@&${config.unverifiedRoleId}>` : 'Not set',
          inline: true,
        },
        {
          name: 'Log Channel',
          value: config.logChannelId ? `<#${config.logChannelId}>` : 'Not set',
          inline: true,
        },
        {
          name: 'Officer Rank',
          value: config.officerRank ? config.officerRank.toString() : 'Not set',
          inline: true,
        },
        {
          name: 'Admin Role',
          value: config.adminRoleId ? `<@&${config.adminRoleId}>` : 'Not set',
          inline: true,
        },
        {
          name: 'Nickname Format',
          value: config.nicknameFormat ? `\`${config.nicknameFormat}\`` : 'Not set',
          inline: false,
        },
        {
          name: 'API Key',
          value: config.apiKey ? '✅ Set (hidden)' : '❌ Not set',
          inline: false,
        }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Error in /config command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while fetching configuration.',
    });
  }
}
