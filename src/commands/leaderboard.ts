/**
 * /leaderboard command - Show top users by points
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import prisma from '../db/client.js';
import { logger } from '../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('Show top users by points')
  .addIntegerOption(option =>
    option
      .setName('limit')
      .setDescription('Number of users to show (default: 10)')
      .setRequired(false)
      .setMinValue(5)
      .setMaxValue(25)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const limit = interaction.options.getInteger('limit') || 10;

  try {
    const topUsers = await prisma.user.findMany({
      orderBy: { points: 'desc' },
      take: limit,
    });

    if (topUsers.length === 0) {
      return interaction.editReply({
        content: '❌ No verified users found.',
      });
    }

    const embed = new EmbedBuilder()
      .setTitle('🏆 Points Leaderboard')
      .setColor(0xffd700)
      .setTimestamp();

    let description = '';
    for (let i = 0; i < topUsers.length; i++) {
      const user = topUsers[i];
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i + 1}.**`;

      let discordTag = 'Unknown User';
      try {
        const discordUser = await interaction.client.users.fetch(user.discordId);
        discordTag = discordUser.tag;
      } catch {
        discordTag = `Unknown (${user.discordId})`;
      }

      description += `${medal} **${user.robloxUsername}** (${discordTag}) - ${user.points} points\n`;
    }

    embed.setDescription(description);

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Error in /leaderboard command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while fetching the leaderboard.',
    });
  }
}
