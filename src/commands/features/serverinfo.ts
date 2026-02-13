/**
 * /serverinfo command - Display server information
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import prisma from '../../db/client.js';
import { logger } from '../../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('serverinfo')
  .setDescription('Display information about this server');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    const guild = interaction.guild!;

    // Get stats
    const [verifiedCount, activeBans] = await Promise.all([
      prisma.user.count(),
      prisma.ban.count({
        where: {
          guildId: guild.id,
          active: true,
        },
      }),
    ]);

    // Count members
    const members = guild.members.cache;
    const onlineMembers = members.filter(m => m.presence?.status === 'online' || m.presence?.status === 'idle' || m.presence?.status === 'dnd').size;
    const botCount = members.filter(m => m.user.bot).size;

    const embed = new EmbedBuilder()
      .setTitle(`📊 ${guild.name} Server Information`)
      .setColor(0x5865f2)
      .setThumbnail(guild.iconURL() || '')
      .addFields(
        { name: '👑 Owner', value: `<@${guild.ownerId}>`, inline: true },
        { name: '📅 Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
        { name: '🆔 Server ID', value: guild.id, inline: true },
        { name: '👥 Members', value: `Total: ${guild.memberCount}\nOnline: ${onlineMembers}\nBots: ${botCount}`, inline: true },
        { name: '📢 Channels', value: `${guild.channels.cache.size} total`, inline: true },
        { name: '🎭 Roles', value: `${guild.roles.cache.size} total`, inline: true },
        { name: '⭐ Boost Level', value: `Level ${guild.premiumTier}\n${guild.premiumSubscriptionCount || 0} boosts`, inline: true },
        { name: '✅ Verified Users', value: `${verifiedCount} users`, inline: true },
        { name: '🔨 Active Bans', value: `${activeBans} bans`, inline: true }
      )
      .setFooter({ text: `Requested by ${interaction.user.tag}` })
      .setTimestamp();

    if (guild.description) {
      embed.setDescription(guild.description);
    }

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    logger.error('[ServerInfo] Error executing serverinfo command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while fetching server information.',
    });
  }
}
