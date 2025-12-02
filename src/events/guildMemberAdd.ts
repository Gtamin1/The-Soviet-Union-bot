/**
 * Event handler for when a new member joins the server
 * Automatically gives them the unverified role if configured
 */

import { Events, GuildMember } from 'discord.js';
import prisma from '../db/client.js';
import { logger } from '../lib/logger.js';

export const name = Events.GuildMemberAdd;

export async function execute(member: GuildMember) {
  try {
    // Get server configuration
    const config = await prisma.guildConfig.findUnique({
      where: { guildId: member.guild.id },
    });

    if (!config || !config.unverifiedRoleId) return;

    // Give them the unverified role
    const role = member.guild.roles.cache.get(config.unverifiedRoleId);
    if (role) {
      await member.roles.add(role);
      logger.info(`Gave unverified role to ${member.user.tag} in ${member.guild.name}`);
    }
  } catch (error) {
    logger.error('Error in guildMemberAdd event:', error);
  }
}
