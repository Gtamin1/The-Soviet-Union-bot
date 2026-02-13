/**
 * Event handler for when a member leaves the server
 * Sends goodbye message if configured
 */

import { Events, GuildMember, EmbedBuilder, PartialGuildMember } from 'discord.js';
import prisma from '../db/client.js';
import { logger } from '../lib/logger.js';

export const name = Events.GuildMemberRemove;

export async function execute(member: GuildMember | PartialGuildMember) {
  try {
    // Get server configuration
    const config = await prisma.guildConfig.findUnique({
      where: { guildId: member.guild.id },
    });

    if (!config || !config.goodbyeChannelId || !config.goodbyeMessage) return;

    // Send goodbye message
    try {
      const channel = await member.guild.channels.fetch(config.goodbyeChannelId);
      if (channel && channel.isTextBased()) {
        const goodbyeText = config.goodbyeMessage
          .replace(/{username}/g, member.user.username)
          .replace(/{server}/g, member.guild.name)
          .replace(/{membercount}/g, member.guild.memberCount.toString());

        const embed = new EmbedBuilder()
          .setTitle('👋 Goodbye!')
          .setDescription(goodbyeText)
          .setColor(0xffa500)
          .setThumbnail(member.user.displayAvatarURL())
          .setTimestamp();

        await channel.send({ embeds: [embed] });
        logger.info(`Sent goodbye message for ${member.user.username} in ${member.guild.name}`);
      }
    } catch (error) {
      logger.error(`Error sending goodbye message:`, error);
    }

  } catch (error) {
    logger.error('Error in guildMemberRemove event:', error);
  }
}
