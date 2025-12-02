/**
 * /topplaytime command - Show playtime leaderboard
 * Displays top 10 players by playtime for today/week/month
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import prisma from '../db/client.js';
import { logger } from '../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('topplaytime')
  .setDescription('View playtime leaderboard')
  .addStringOption(option =>
    option
      .setName('period')
      .setDescription('Time period to show')
      .setRequired(false)
      .addChoices(
        { name: 'Today', value: 'today' },
        { name: 'This Week', value: 'week' },
        { name: 'This Month', value: 'month' },
        { name: 'All Time', value: 'alltime' }
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    return interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
  }

  await interaction.deferReply();

  const period = interaction.options.getString('period') || 'today';

  try {
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
      .slice(0, 10); // Top 10

    if (sortedUsers.length === 0) {
      return interaction.editReply({
        content: `❌ No playtime data found for ${periodLabel.toLowerCase()}.`,
      });
    }

    // Fetch user data for display names
    const robloxIds = sortedUsers.map(u => u.robloxId);
    const users = await prisma.user.findMany({
      where: { robloxId: { in: robloxIds } },
      select: { robloxId: true, robloxUsername: true },
    });

    const userMap = new Map(users.map(u => [u.robloxId, u.robloxUsername]));

    // Format time helper
    const formatTime = (seconds: number): string => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    };

    // Build leaderboard text
    const medals = ['🥇', '🥈', '🥉'];
    const leaderboardText = sortedUsers.map((entry, index) => {
      const medal = index < 3 ? medals[index] : `${index + 1}.`;
      const username = userMap.get(entry.robloxId) || `Roblox ID: ${entry.robloxId}`;
      const time = formatTime(entry.duration);
      return `${medal} **${username}** - ${time}`;
    }).join('\n');

    // Build embed
    const embed = new EmbedBuilder()
      .setTitle(`${emoji} Top Playtime - ${periodLabel}`)
      .setDescription('━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' + leaderboardText)
      .setColor(0xffd700)
      .setFooter({ text: `Showing top ${sortedUsers.length} players` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Error in /topplaytime command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while fetching playtime leaderboard.',
    });
  }
}
