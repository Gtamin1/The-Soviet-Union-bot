/**
 * /playtime command - View detailed playtime statistics
 * Can look up by Discord user OR Roblox username
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import prisma from '../db/client.js';
import { getRobloxUserByUsername } from '../lib/roblox.js';
import { logger } from '../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('playtime')
  .setDescription('View detailed playtime statistics')
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('Discord user to check')
      .setRequired(false)
  )
  .addStringOption(option =>
    option
      .setName('roblox')
      .setDescription('Roblox username to check')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    return interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
  }

  await interaction.deferReply();

  const discordUser = interaction.options.getUser('user');
  const robloxUsername = interaction.options.getString('roblox');

  if (!discordUser && !robloxUsername) {
    return interaction.editReply({
      content: '❌ Please provide either a Discord user or Roblox username.',
    });
  }

  try {
    let user;
    let robloxData;
    let robloxId: string;
    let displayName: string;

    if (discordUser) {
      // Look up by Discord user
      user = await prisma.user.findUnique({
        where: { discordId: discordUser.id },
      });

      if (!user) {
        return interaction.editReply({
          content: `❌ ${discordUser.tag} is not verified.`,
        });
      }

      robloxId = user.robloxId;
      displayName = user.robloxUsername;
    } else if (robloxUsername) {
      // Look up by Roblox username
      robloxData = await getRobloxUserByUsername(robloxUsername);

      if (!robloxData) {
        return interaction.editReply({
          content: `❌ Roblox user **${robloxUsername}** not found.`,
        });
      }

      robloxId = robloxData.id.toString();
      displayName = robloxData.name;

      // Check if verified
      user = await prisma.user.findUnique({
        where: { robloxId: robloxId },
      });
    } else {
      return interaction.editReply({
        content: '❌ Please provide either a Discord user or Roblox username.',
      });
    }

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

    // Get all playtime sessions for this user
    const allSessions = await prisma.playtimeSession.findMany({
      where: { robloxId: robloxId },
      orderBy: { date: 'desc' },
    });

    if (allSessions.length === 0) {
      return interaction.editReply({
        content: `❌ No playtime data found for **${displayName}**.`,
      });
    }

    // Calculate totals
    const todaySessions = allSessions.filter(s => {
      const sessionDate = new Date(s.date);
      sessionDate.setHours(0, 0, 0, 0);
      return sessionDate.getTime() === today.getTime();
    });

    const weekSessions = allSessions.filter(s => {
      const sessionDate = new Date(s.date);
      sessionDate.setHours(0, 0, 0, 0);
      return sessionDate >= startOfWeek;
    });

    const monthSessions = allSessions.filter(s => {
      const sessionDate = new Date(s.date);
      sessionDate.setHours(0, 0, 0, 0);
      return sessionDate >= startOfMonth;
    });

    const totalSecondsToday = todaySessions.reduce((sum, s) => sum + s.duration, 0);
    const totalSecondsWeek = weekSessions.reduce((sum, s) => sum + s.duration, 0);
    const totalSecondsMonth = monthSessions.reduce((sum, s) => sum + s.duration, 0);
    const totalSecondsAllTime = allSessions.reduce((sum, s) => sum + s.duration, 0);

    // Calculate average daily playtime
    const uniqueDays = new Set(allSessions.map(s => {
      const date = new Date(s.date);
      return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    }));
    const daysPlayed = uniqueDays.size;
    const averageSecondsPerDay = daysPlayed > 0 ? totalSecondsAllTime / daysPlayed : 0;

    // Format time helper
    const formatTime = (seconds: number): string => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    };

    // Get last session
    const lastSession = allSessions[0]; // Already ordered by date desc
    const lastSeenText = lastSession
      ? `<t:${Math.floor(lastSession.createdAt.getTime() / 1000)}:R>`
      : 'Never';

    // Build embed
    const embed = new EmbedBuilder()
      .setTitle(`⏱️ Playtime Stats: ${displayName}`)
      .setDescription('━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${robloxId}&width=150&height=150&format=png`)
      .addFields(
        {
          name: '📅 Today',
          value: formatTime(totalSecondsToday),
          inline: true,
        },
        {
          name: '📆 This Week',
          value: formatTime(totalSecondsWeek),
          inline: true,
        },
        {
          name: '🗓️ This Month',
          value: formatTime(totalSecondsMonth),
          inline: true,
        },
        {
          name: '🌍 All Time',
          value: formatTime(totalSecondsAllTime),
          inline: true,
        },
        {
          name: '📊 Average Daily',
          value: formatTime(averageSecondsPerDay),
          inline: true,
        },
        {
          name: '🎮 Days Played',
          value: `${daysPlayed} days`,
          inline: true,
        },
        {
          name: '👀 Last Seen',
          value: lastSeenText,
          inline: false,
        }
      )
      .setColor(0x00ff00)
      .setFooter({ text: user ? '✓ Verified' : '✕ Not Verified' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Error in /playtime command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while fetching playtime data.',
    });
  }
}
