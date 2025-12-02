/**
 * /mystats command - View your own comprehensive player stats
 * Quick way to check your own stats without needing to mention yourself
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import prisma from '../db/client.js';
import { getUserRankInGroup } from '../lib/roblox.js';
import { logger } from '../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('mystats')
  .setDescription('View your own comprehensive player stats');

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    return interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
  }

  await interaction.deferReply();

  try {
    // Look up the user who ran the command
    const user = await prisma.user.findUnique({
      where: { discordId: interaction.user.id },
    });

    if (!user) {
      return interaction.editReply({
        content: '❌ You are not verified. Use `/verify` to link your Roblox account.',
      });
    }

    // Get config
    const config = await prisma.guildConfig.findUnique({
      where: { guildId: interaction.guildId! },
    });

    // Get group rank
    let rankText = 'N/A';
    if (config?.primaryGroupId) {
      const rankInfo = await getUserRankInGroup(user.robloxId, config.primaryGroupId);
      if (rankInfo) {
        rankText = `${rankInfo.roleName} (Rank ${rankInfo.rank})`;
      }
    }

    // Get playtime stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaySessions = await prisma.playtimeSession.findMany({
      where: {
        robloxId: user.robloxId,
        date: today,
      },
    });

    const totalSecondsToday = todaySessions.reduce((sum, session) => sum + session.duration, 0);
    const hoursToday = Math.floor(totalSecondsToday / 3600);
    const minutesToday = Math.floor((totalSecondsToday % 3600) / 60);

    // Get last session
    const lastSession = await prisma.playtimeSession.findFirst({
      where: { robloxId: user.robloxId },
      orderBy: { createdAt: 'desc' },
    });

    const lastSeenText = lastSession
      ? `<t:${Math.floor(lastSession.createdAt.getTime() / 1000)}:R>`
      : 'Never';

    // Calculate milestones
    const thirtyMinReached = totalSecondsToday >= 1800;
    const oneHourReached = totalSecondsToday >= 3600;
    const threeHourReached = totalSecondsToday >= 10800;

    const embed = new EmbedBuilder()
      .setTitle(`🔍 Your Stats: ${user.robloxUsername}`)
      .setDescription('━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${user.robloxId}&width=150&height=150&format=png`)
      .addFields(
        {
          name: '👤 Discord',
          value: `${interaction.user.tag}`,
          inline: true,
        },
        {
          name: '🎮 Roblox',
          value: `${user.robloxUsername}\n(ID: ${user.robloxId})`,
          inline: true,
        },
        {
          name: '✓ Status',
          value: 'Verified',
          inline: true,
        },
        {
          name: '📊 Statistics',
          value: `**Points:** ${user.points}\n` +
                 `**Group Rank:** ${rankText}\n` +
                 `**Time Today:** ${hoursToday}h ${minutesToday}m\n` +
                 `**Last Seen:** ${lastSeenText}`,
          inline: false,
        },
        {
          name: '🎖️ Milestones Today',
          value: `${thirtyMinReached ? '✓' : '○'} 30 minutes  ${oneHourReached ? '✓' : '○'} 1 hour  ${threeHourReached ? '✓' : '○'} 3 hours`,
          inline: false,
        }
      )
      .setColor(0x0099ff)
      .setFooter({ text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Error in /mystats command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while fetching your player data.',
    });
  }
}
