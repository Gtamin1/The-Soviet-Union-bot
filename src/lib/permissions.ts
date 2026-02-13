/**
 * Permission checking utilities
 * Centralized permission system for all commands
 */

import { ChatInputCommandInteraction, GuildMember, PermissionFlagsBits } from 'discord.js';
import prisma from '../db/client.js';
import { getUserRankInGroup } from './roblox.js';
import { logger } from './logger.js';

export type PermissionLevel = 'owner' | 'admin' | 'moderator' | 'officer' | 'verified' | 'everyone';

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

/**
 * Check if a user is a moderator (can use moderation commands)
 */
export async function isModerator(member: GuildMember): Promise<boolean> {
  // Server owner is always moderator
  if (member.guild.ownerId === member.id) {
    return true;
  }

  // Admins are always moderators
  if (await isAdmin(member)) {
    return true;
  }

  // Check if they have Ban/Kick permissions
  if (member.permissions.has(PermissionFlagsBits.BanMembers) ||
      member.permissions.has(PermissionFlagsBits.KickMembers)) {
    return true;
  }

  // Check if they have the configured moderator role
  const modConfig = await prisma.moderationConfig.findUnique({
    where: { id: member.guild.id },
  });

  if (modConfig?.moderatorRoleId && member.roles.cache.has(modConfig.moderatorRoleId)) {
    return true;
  }

  return false;
}

/**
 * Centralized permission checker for all commands
 * Auto-replies with error message if permission denied
 */
export async function checkPermission(
  interaction: ChatInputCommandInteraction,
  level: PermissionLevel
): Promise<boolean> {
  if (!interaction.guild || !interaction.member) {
    await interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
    return false;
  }

  const member = interaction.member as GuildMember;

  try {
    // Server owner always has access
    if (interaction.guild.ownerId === member.id) {
      return true;
    }

    // Check permission levels in order (higher includes lower)
    switch (level) {
      case 'owner':
        if (interaction.guild.ownerId !== member.id) {
          await interaction.reply({
            content: '❌ **Permission Denied**\n\nOnly the server owner can use this command.',
            ephemeral: true,
          });
          return false;
        }
        return true;

      case 'admin':
        if (!(await isAdmin(member))) {
          await interaction.reply({
            content: '❌ **Permission Denied**\n\nYou need the **Administrator** permission or the configured admin role to use this command.',
            ephemeral: true,
          });
          return false;
        }
        return true;

      case 'moderator':
        if (!(await isModerator(member))) {
          await interaction.reply({
            content: '❌ **Permission Denied**\n\nYou need the **Moderator** role or Ban/Kick permissions to use this command.',
            ephemeral: true,
          });
          return false;
        }
        return true;

      case 'officer':
        if (!(await isOfficer(member))) {
          await interaction.reply({
            content: '❌ **Permission Denied**\n\nYou need to be an **Officer** (or have the required Roblox rank) to use this command.',
            ephemeral: true,
          });
          return false;
        }
        return true;

      case 'verified':
        const isUserVerified = await isVerified(member.id);
        if (!isUserVerified) {
          await interaction.reply({
            content: '❌ **Permission Denied**\n\nYou must be verified to use this command. Use `/verify` to link your Roblox account.',
            ephemeral: true,
          });
          return false;
        }
        return true;

      case 'everyone':
        return true;

      default:
        logger.warn(`Unknown permission level: ${level}`);
        return false;
    }
  } catch (error) {
    logger.error('Error checking permissions:', error);
    await interaction.reply({
      content: '❌ An error occurred while checking permissions.',
      ephemeral: true,
    });
    return false;
  }
}

/**
 * Check if a moderator can take action against a target user
 * Prevents moderators from banning/kicking higher-ranked users
 */
export async function canModerateUser(
  moderator: GuildMember,
  targetMember: GuildMember | null
): Promise<{ allowed: boolean; reason?: string }> {
  // Can't moderate the server owner
  if (targetMember && targetMember.id === targetMember.guild.ownerId) {
    return { allowed: false, reason: 'Cannot moderate the server owner.' };
  }

  // Can't moderate yourself
  if (targetMember && moderator.id === targetMember.id) {
    return { allowed: false, reason: 'You cannot moderate yourself.' };
  }

  // If target has higher role position, deny
  if (targetMember && targetMember.roles.highest.position >= moderator.roles.highest.position) {
    return { allowed: false, reason: 'You cannot moderate someone with a higher or equal role.' };
  }

  // If bot cannot manage the target's roles (for bans), deny
  if (targetMember) {
    const botMember = targetMember.guild.members.me;
    if (botMember && targetMember.roles.highest.position >= botMember.roles.highest.position) {
      return { allowed: false, reason: 'The bot cannot moderate this user due to role hierarchy.' };
    }
  }

  return { allowed: true };
}
