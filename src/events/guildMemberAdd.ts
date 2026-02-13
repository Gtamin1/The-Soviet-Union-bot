/**
 * Event handler for when a new member joins the server
 * - Sends welcome message if configured
 * - Gives auto-role if configured
 * - Gives unverified role if configured
 */

import { Events, GuildMember, EmbedBuilder } from 'discord.js';
import prisma from '../db/client.js';
import { logger } from '../lib/logger.js';

export const name = Events.GuildMemberAdd;

export async function execute(member: GuildMember) {
  try {
    // Get server configuration
    const config = await prisma.guildConfig.findUnique({
      where: { guildId: member.guild.id },
    });

    if (!config) return;

    // Send welcome message
    if (config.welcomeChannelId && config.welcomeMessage) {
      try {
        const channel = await member.guild.channels.fetch(config.welcomeChannelId);
        if (channel && channel.isTextBased()) {
          const welcomeText = config.welcomeMessage
            .replace(/{user}/g, `<@${member.id}>`)
            .replace(/{username}/g, member.user.username)
            .replace(/{server}/g, member.guild.name)
            .replace(/{membercount}/g, member.guild.memberCount.toString());

          const embed = new EmbedBuilder()
            .setTitle('👋 Welcome!')
            .setDescription(welcomeText)
            .setColor(0x57f287)
            .setThumbnail(member.user.displayAvatarURL())
            .setTimestamp();

          await channel.send({ embeds: [embed] });
          logger.info(`Sent welcome message for ${member.user.tag} in ${member.guild.name}`);
        }
      } catch (error) {
        logger.error(`Error sending welcome message:`, error);
      }
    }

    // Give auto-role
    if (config.autoRoleId) {
      try {
        const autoRole = member.guild.roles.cache.get(config.autoRoleId);
        if (autoRole) {
          await member.roles.add(autoRole);
          logger.info(`Gave auto-role to ${member.user.tag} in ${member.guild.name}`);
        }
      } catch (error) {
        logger.error(`Error giving auto-role:`, error);
      }
    }

    // Give unverified role
    if (config.unverifiedRoleId) {
      try {
        const unverifiedRole = member.guild.roles.cache.get(config.unverifiedRoleId);
        if (unverifiedRole) {
          await member.roles.add(unverifiedRole);
          logger.info(`Gave unverified role to ${member.user.tag} in ${member.guild.name}`);
        }
      } catch (error) {
        logger.error(`Error giving unverified role:`, error);
      }
    }

  } catch (error) {
    logger.error('Error in guildMemberAdd event:', error);
  }
}
