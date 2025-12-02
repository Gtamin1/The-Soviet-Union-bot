/**
 * /promotionranks - List all configured auto-promotion thresholds
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import prisma from '../db/client.js';
import { logger } from '../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('promotionranks')
  .setDescription('List all configured auto-promotion thresholds');

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    return interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
  }

  await interaction.deferReply();

  try {
    const promotionRanks = await prisma.promotionRank.findMany({
      where: { guildId: interaction.guild.id },
      orderBy: { pointsRequired: 'asc' },
    });

    if (promotionRanks.length === 0) {
      return interaction.editReply({
        content: '❌ No promotion ranks configured. Use `/setpromotionrank` to add one.',
      });
    }

    const embed = new EmbedBuilder()
      .setTitle('🎖️ Auto-Promotion Thresholds')
      .setColor(0xffd700)
      .setTimestamp();

    for (const rank of promotionRanks) {
      embed.addFields({
        name: `${rank.pointsRequired} Points`,
        value: `Rank ${rank.robloxRankId} - ${rank.rankName}`,
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Error in /promotionranks command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while fetching promotion ranks.',
    });
  }
}
