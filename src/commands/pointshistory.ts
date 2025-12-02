/**
 * /pointshistory command - Show recent point transactions for a user
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import prisma from '../db/client.js';
import { logger } from '../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('pointshistory')
  .setDescription('Show recent point transactions for a user')
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('User to check (leave empty to check yourself)')
      .setRequired(false)
  )
  .addIntegerOption(option =>
    option
      .setName('limit')
      .setDescription('Number of transactions to show (default: 10)')
      .setRequired(false)
      .setMinValue(5)
      .setMaxValue(25)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const targetUser = interaction.options.getUser('user') || interaction.user;
  const limit = interaction.options.getInteger('limit') || 10;

  try {
    const user = await prisma.user.findUnique({
      where: { discordId: targetUser.id },
    });

    if (!user) {
      return interaction.editReply({
        content: `❌ ${targetUser.tag} is not verified.`,
      });
    }

    const transactions = await prisma.pointTransaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    if (transactions.length === 0) {
      return interaction.editReply({
        content: `❌ No point transactions found for ${user.robloxUsername}.`,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(`📜 Point History for ${user.robloxUsername}`)
      .setColor(0x0099ff)
      .setTimestamp();

    let description = '';
    for (const transaction of transactions) {
      const sign = transaction.type === 'add' ? '+' : '-';
      const emoji = transaction.type === 'add' ? '➕' : '➖';
      const timestamp = `<t:${Math.floor(transaction.createdAt.getTime() / 1000)}:R>`;

      description += `${emoji} **${sign}${transaction.amount}** points - ${transaction.reason}\n`;
      description += `   By: ${transaction.givenByUsername || 'System'} | ${timestamp}\n\n`;
    }

    embed.setDescription(description);

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Error in /pointshistory command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while fetching point history.',
    });
  }
}
