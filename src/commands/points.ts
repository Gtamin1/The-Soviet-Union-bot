/**
 * /points command - Check a user's points
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import prisma from '../db/client.js';
import { logger } from '../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('points')
  .setDescription('Check points for a user')
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('User to check (leave empty to check yourself)')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const targetUser = interaction.options.getUser('user') || interaction.user;

  try {
    const user = await prisma.user.findUnique({
      where: { discordId: targetUser.id },
    });

    if (!user) {
      return interaction.editReply({
        content: `❌ ${targetUser.tag} is not verified.`,
      });
    }

    // Get points for different time periods
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const weeklyTransactions = await prisma.pointTransaction.findMany({
      where: {
        userId: user.id,
        createdAt: { gte: weekAgo },
      },
    });

    const monthlyTransactions = await prisma.pointTransaction.findMany({
      where: {
        userId: user.id,
        createdAt: { gte: monthAgo },
      },
    });

    const weeklyPoints = weeklyTransactions.reduce((sum, t) => {
      return sum + (t.type === 'add' ? t.amount : -t.amount);
    }, 0);

    const monthlyPoints = monthlyTransactions.reduce((sum, t) => {
      return sum + (t.type === 'add' ? t.amount : -t.amount);
    }, 0);

    const embed = new EmbedBuilder()
      .setTitle(`📊 Points for ${user.robloxUsername}`)
      .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${user.robloxId}&width=150&height=150&format=png`)
      .addFields(
        { name: '🏆 Total Points', value: user.points.toString(), inline: true },
        { name: '📅 This Week', value: weeklyPoints.toString(), inline: true },
        { name: '📅 This Month', value: monthlyPoints.toString(), inline: true }
      )
      .setColor(0xffd700)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Error in /points command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while fetching points.',
    });
  }
}
