/**
 * /userinfo command - Display user information
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import prisma from '../../db/client.js';
import { logger } from '../../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('userinfo')
  .setDescription('Display information about a user')
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('The user to get information about (default: yourself)')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const member = await interaction.guild!.members.fetch(targetUser.id);

    // Check if verified
    const verifiedUser = await prisma.user.findUnique({
      where: { discordId: targetUser.id },
    });

    // Get stats
    const [warningCount, totalPlaytime] = await Promise.all([
      prisma.warning.count({
        where: {
          guildId: interaction.guildId!,
          discordId: targetUser.id,
          active: true,
        },
      }),
      prisma.playtimeSession.aggregate({
        where: { userId: verifiedUser?.id },
        _sum: { duration: true },
      }),
    ]);

    const embed = new EmbedBuilder()
      .setTitle(`👤 ${targetUser.tag}`)
      .setColor(member.displayHexColor || 0x5865f2)
      .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: '🆔 Discord ID', value: targetUser.id, inline: true },
        { name: '📅 Account Created', value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>`, inline: true },
        { name: '📥 Joined Server', value: member.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>` : 'Unknown', inline: true }
      );

    // Roles
    const roles = member.roles.cache
      .filter(r => r.id !== interaction.guildId)
      .sort((a, b) => b.position - a.position)
      .map(r => `<@&${r.id}>`)
      .slice(0, 10);

    if (roles.length > 0) {
      embed.addFields({
        name: `🎭 Roles [${member.roles.cache.size - 1}]`,
        value: roles.join(', ') + (member.roles.cache.size > 11 ? '...' : ''),
        inline: false,
      });
    }

    // Verification & Roblox info
    if (verifiedUser) {
      embed.addFields(
        { name: '✅ Verified', value: 'Yes', inline: true },
        { name: '🎮 Roblox Username', value: verifiedUser.robloxUsername, inline: true },
        { name: '🆔 Roblox ID', value: verifiedUser.robloxId, inline: true },
        { name: '⭐ Points', value: verifiedUser.points.toString(), inline: true },
        { name: '🕒 Total Playtime', value: formatDuration(totalPlaytime._sum.duration || 0), inline: true },
        { name: '⚠️ Active Warnings', value: warningCount.toString(), inline: true }
      );
    } else {
      embed.addFields({ name: '✅ Verified', value: 'No', inline: true });
    }

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    logger.error('[UserInfo] Error executing userinfo command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while fetching user information.',
    });
  }
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours === 0 && minutes === 0) {
    return '0 minutes';
  }

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);

  return parts.join(' ');
}
