/**
 * /leaderboard command - Show top users by points or playtime
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import prisma from '../db/client.js';
import { logger } from '../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('Show top users by points or playtime')
  .addStringOption(option =>
    option
      .setName('type')
      .setDescription('Leaderboard type')
      .setRequired(false)
      .addChoices(
        { name: 'Points', value: 'points' },
        { name: 'Playtime', value: 'playtime' }
      )
  )
  .addStringOption(option =>
    option
      .setName('period')
      .setDescription('Time period (for playtime only)')
      .setRequired(false)
      .addChoices(
        { name: 'Today', value: 'today' },
        { name: 'This Week', value: 'week' },
        { name: 'This Month', value: 'month' },
        { name: 'All Time', value: 'alltime' }
      )
  )
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

  const type = interaction.options.getString('type') || 'points';
  const period = interaction.options.getString('period') || 'alltime';
  const limit = interaction.options.getInteger('limit') || 10;

  try {
    if (type === 'points') {
      // Points leaderboard
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
    } else if (type === 'playtime') {
      // Playtime leaderboard
      // Calculate time periods
      const now = new Date();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Sunday
      startOfWeek.setHours(0, 0, 0, 0);

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      // Determine query date range
      let dateFilter: any = {};
      let periodLabel = '';
      let emoji = '';

      switch (period) {
        case 'today':
          dateFilter = { date: today };
          periodLabel = 'Today';
          emoji = '📅';
          break;
        case 'week':
          dateFilter = { date: { gte: startOfWeek } };
          periodLabel = 'This Week';
          emoji = '📆';
          break;
        case 'month':
          dateFilter = { date: { gte: startOfMonth } };
          periodLabel = 'This Month';
          emoji = '🗓️';
          break;
        case 'alltime':
          dateFilter = {}; // No filter
          periodLabel = 'All Time';
          emoji = '🌍';
          break;
      }

      // Get all sessions for the period
      const sessions = await prisma.playtimeSession.findMany({
        where: dateFilter,
      });

      if (sessions.length === 0) {
        return interaction.editReply({
          content: `❌ No playtime data found for ${periodLabel.toLowerCase()}.`,
        });
      }

      // Group by robloxId and sum durations
      const playtimeByUser = new Map<string, number>();
      sessions.forEach(session => {
        const current = playtimeByUser.get(session.robloxId) || 0;
        playtimeByUser.set(session.robloxId, current + session.duration);
      });

      // Convert to array and sort by duration
      const sortedUsers = Array.from(playtimeByUser.entries())
        .map(([robloxId, duration]) => ({ robloxId, duration }))
        .sort((a, b) => b.duration - a.duration)
        .slice(0, limit);

      if (sortedUsers.length === 0) {
        return interaction.editReply({
          content: `❌ No playtime data found for ${periodLabel.toLowerCase()}.`,
        });
      }

      // Fetch user data for display names
      const robloxIds = sortedUsers.map(u => u.robloxId);
      const users = await prisma.user.findMany({
        where: { robloxId: { in: robloxIds } },
        select: { robloxId: true, robloxUsername: true, discordId: true },
      });

      const userMap = new Map(users.map(u => [u.robloxId, { username: u.robloxUsername, discordId: u.discordId }]));

      // Format time helper
      const formatTime = (seconds: number): string => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${minutes}m`;
      };

      // Build leaderboard text
      const medals = ['🥇', '🥈', '🥉'];
      let description = '';
      for (let i = 0; i < sortedUsers.length; i++) {
        const entry = sortedUsers[i];
        const medal = i < 3 ? medals[i] : `**${i + 1}.**`;
        const userData = userMap.get(entry.robloxId);
        const username = userData ? userData.username : `Roblox ID: ${entry.robloxId}`;
        const time = formatTime(entry.duration);

        let discordTag = '';
        if (userData) {
          try {
            const discordUser = await interaction.client.users.fetch(userData.discordId);
            discordTag = ` (${discordUser.tag})`;
          } catch {
            discordTag = '';
          }
        }

        description += `${medal} **${username}**${discordTag} - ${time}\n`;
      }

      // Build embed
      const embed = new EmbedBuilder()
        .setTitle(`${emoji} Playtime Leaderboard - ${periodLabel}`)
        .setDescription(description)
        .setColor(0xffd700)
        .setFooter({ text: `Showing top ${sortedUsers.length} players` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  } catch (error) {
    logger.error('Error in /leaderboard command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while fetching the leaderboard.',
    });
  }
}
