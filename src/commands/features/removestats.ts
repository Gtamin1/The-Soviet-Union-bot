/**
 * /removestats command - Remove stats channels
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import prisma from '../../db/client.js';
import { checkPermission } from '../../lib/permissions.js';
import { logger } from '../../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('removestats')
  .setDescription('Remove auto-updating stats channels')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!await checkPermission(interaction, 'admin')) {
    return;
  }

  await interaction.deferReply();

  try {
    const guild = interaction.guild!;

    // Get config
    const config = await prisma.guildConfig.findUnique({
      where: { guildId: guild.id },
    });

    if (!config?.statsEnabled) {
      return interaction.editReply({
        content: '❌ Stats channels are not set up.',
      });
    }

    let deletedCount = 0;

    // Delete all stats channels
    const channelIds = [
      config.statsMembersChannel,
      config.statsVerifiedChannel,
      config.statsInGameChannel,
      config.statsPointsChannel,
      config.statsBansChannel,
    ];

    for (const channelId of channelIds) {
      if (channelId) {
        try {
          const channel = await guild.channels.fetch(channelId);
          if (channel) {
            await channel.delete();
            deletedCount++;
          }
        } catch (error) {
          // Channel already deleted or doesn't exist
        }
      }
    }

    // Delete category
    if (config.statsCategory) {
      try {
        const category = await guild.channels.fetch(config.statsCategory);
        if (category) {
          await category.delete();
        }
      } catch (error) {
        // Category already deleted or doesn't exist
      }
    }

    // Update config
    await prisma.guildConfig.update({
      where: { guildId: guild.id },
      data: {
        statsEnabled: false,
        statsCategory: null,
        statsMembersChannel: null,
        statsVerifiedChannel: null,
        statsInGameChannel: null,
        statsPointsChannel: null,
        statsBansChannel: null,
      },
    });

    const embed = new EmbedBuilder()
      .setTitle('✅ Stats Channels Removed')
      .setColor(0x57f287)
      .setDescription(`Successfully removed ${deletedCount} stats channel(s) and the stats category.`)
      .setFooter({ text: 'Use /setupstats to recreate them' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    logger.info(`[RemoveStats] ${interaction.user.tag} removed stats channels in ${guild.name}`);

  } catch (error) {
    logger.error('[RemoveStats] Error executing removestats command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while removing stats channels.',
    });
  }
}
