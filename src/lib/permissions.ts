/**
 * Permission checking utilities
 */

import { GuildMember, PermissionFlagsBits } from 'discord.js';
import prisma from '../db/client.js';
import { getUserRankInGroup } from './roblox.js';

/**
 * Check if a user is an administrator
 */
export async function isAdmin(member: GuildMember): Promise<boolean> {
  // Check if they have Administrator permission
  if (member.permissions.has(PermissionFlagsBits.Administrator)) {
    return true;
  }

  // Check if they have the configured admin role
  const config = await prisma.guildConfig.findUnique({
    where: { guildId: member.guild.id },
  });

  if (config?.adminRoleId && member.roles.cache.has(config.adminRoleId)) {
    return true;
  }

  return false;
}

/**
 * Check if a user is an officer (can give/remove points)
 */
export async function isOfficer(member: GuildMember): Promise<boolean> {
  // Admins are always officers
  if (await isAdmin(member)) {
    return true;
  }

  const config = await prisma.guildConfig.findUnique({
    where: { guildId: member.guild.id },
  });

  if (!config?.primaryGroupId || !config.officerRank) {
    return false;
  }

  // Check if user is verified
  const user = await prisma.user.findUnique({
    where: { discordId: member.id },
  });

  if (!user) return false;

  // Check their rank in the primary group
  const rank = await getUserRankInGroup(user.robloxId, config.primaryGroupId);

  if (!rank) return false;

  return rank.rank >= config.officerRank;
}

/**
 * Check if a user is verified
 */
export async function isVerified(discordId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { discordId },
  });

  return !!user;
}
