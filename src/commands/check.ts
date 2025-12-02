/**
 * /check command - View comprehensive player stats
 * Can look up by Discord user OR Roblox username
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import prisma from '../db/client.js';
import { getRobloxUserByUsername, getUserRankInGroup } from '../lib/roblox.js';
import { logger } from '../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('check')
  .setDescription('View comprehensive player stats')
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
    } else if (robloxUsername) {
      // Look up by Roblox username
      robloxData = await getRobloxUserByUsername(robloxUsername);

      if (!robloxData) {
        return interaction.editReply({
          content: `❌ Roblox user **${robloxUsername}** not found.`,
        });
      }

      user = await prisma.user.findUnique({
        where: { robloxId: robloxData.id.toString() },
      });
    }

    // If we found a verified user, get full data
    if (user) {
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

      // Fetch Discord user
      let discordUserObj;
      try {
        discordUserObj = await interaction.client.users.fetch(user.discordId);
      } catch {
        discordUserObj = null;
      }

      const embed = new EmbedBuilder()
        .setTitle(`🔍 Player Lookup: ${user.robloxUsername}`)
        .setDescription('━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${user.robloxId}&width=150&height=150&format=png`)
        .addFields(
          {
            name: '👤 Discord',
            value: discordUserObj ? `${discordUserObj.tag}` : `<@${user.discordId}>`,
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
    } else {
      // User exists on Roblox but not verified
      if (robloxData) {
        // Get playtime even for unverified
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todaySessions = await prisma.playtimeSession.findMany({
          where: {
            robloxId: robloxData.id.toString(),
            date: today,
          },
        });

        const totalSecondsToday = todaySessions.reduce((sum, session) => sum + session.duration, 0);
        const hoursToday = Math.floor(totalSecondsToday / 3600);
        const minutesToday = Math.floor((totalSecondsToday % 3600) / 60);

        const lastSession = await prisma.playtimeSession.findFirst({
          where: { robloxId: robloxData.id.toString() },
          orderBy: { createdAt: 'desc' },
        });

        const lastSeenText = lastSession
          ? `<t:${Math.floor(lastSession.createdAt.getTime() / 1000)}:R>`
          : 'Never';

        const embed = new EmbedBuilder()
          .setTitle(`🔍 Player Lookup: ${robloxData.name}`)
          .setDescription('━━━━━━━━━━━━━━━━━━━━━━━━━━━')
          .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${robloxData.id}&width=150&height=150&format=png`)
          .addFields(
            {
              name: '🎮 Roblox',
              value: `${robloxData.name}\n(ID: ${robloxData.id})`,
              inline: true,
            },
            {
              name: '✕ Status',
              value: 'Not Verified',
              inline: true,
            },
            {
              name: '📊 Statistics',
              value: `**Points:** 0 (not verified)\n` +
                     `**Time Today:** ${hoursToday}h ${minutesToday}m\n` +
                     `**Last Seen:** ${lastSeenText}`,
              inline: false,
            }
          )
          .setColor(0xff9900)
          .setFooter({ text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━' })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      }
    }
  } catch (error) {
    logger.error('Error in /check command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while fetching player data.',
    });
  }
}
