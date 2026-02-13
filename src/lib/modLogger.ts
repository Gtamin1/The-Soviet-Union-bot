/**
 * Moderation logging utility
 * Handles logging moderation actions to mod-log channel and database
 */

import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import prisma from '../db/client.js';
import { logger } from './logger.js';
import { logAudit } from './audit.js';

export interface BanLogData {
  banId: number;
  targetUsername: string;
  targetRobloxId?: string;
  targetDiscordId?: string;
  reason: string;
  duration?: string;
  expiresAt?: Date;
  evidence?: string;
  moderatorUsername: string;
  moderatorDiscordId: string;
  bannedInDiscord: boolean;
  bannedInRoblox: boolean;
}

export interface UnbanLogData {
  banId: number;
  targetUsername: string;
  reason: string;
  moderatorUsername: string;
  moderatorDiscordId: string;
}

export interface KickLogData {
  targetUsername: string;
  targetDiscordId?: string;
  targetRobloxId?: string;
  reason: string;
  moderatorUsername: string;
  moderatorDiscordId: string;
  kickedFromDiscord: boolean;
  kickedFromRoblox: boolean;
}

export interface WarnLogData {
  warningId: number;
  targetUsername: string;
  targetDiscordId?: string;
  reason: string;
  severity: string;
  moderatorUsername: string;
  moderatorDiscordId: string;
  totalWarnings: number;
  autoActionTaken?: 'kick' | 'ban';
}

export interface PardonLogData {
  warningId: number;
  targetUsername: string;
  reason: string;
  moderatorUsername: string;
  moderatorDiscordId: string;
}

/**
 * Log a ban action
 */
export async function logBan(client: Client, guildId: string, data: BanLogData): Promise<void> {
  try {
    // Get mod log channel
    const modConfig = await prisma.moderationConfig.findUnique({
      where: { id: guildId },
    });

    if (!modConfig?.modLogChannelId) {
      logger.warn(`[ModLog] No mod log channel configured for guild ${guildId}`);
      return;
    }

    const guild = await client.guilds.fetch(guildId);
    const logChannel = await guild.channels.fetch(modConfig.modLogChannelId) as TextChannel;

    if (!logChannel || !logChannel.isTextBased()) {
      logger.warn(`[ModLog] Could not find mod log channel ${modConfig.modLogChannelId}`);
      return;
    }

    // Build embed
    const embed = new EmbedBuilder()
      .setTitle('🔨 USER BANNED')
      .setColor(0xed4245) // Red
      .addFields(
        { name: 'User', value: data.targetUsername, inline: true },
        { name: 'Ban ID', value: `#${data.banId}`, inline: true },
        { name: 'Moderator', value: `<@${data.moderatorDiscordId}>`, inline: true },
        { name: 'Reason', value: data.reason, inline: false }
      )
      .setTimestamp();

    if (data.targetDiscordId) {
      embed.addFields({ name: 'Discord ID', value: data.targetDiscordId, inline: true });
    }

    if (data.targetRobloxId) {
      embed.addFields({ name: 'Roblox ID', value: data.targetRobloxId, inline: true });
    }

    if (data.duration) {
      embed.addFields({ name: 'Duration', value: data.duration, inline: true });
    } else {
      embed.addFields({ name: 'Duration', value: 'Permanent', inline: true });
    }

    if (data.expiresAt) {
      embed.addFields({ name: 'Expires', value: `<t:${Math.floor(data.expiresAt.getTime() / 1000)}:F>`, inline: true });
    }

    if (data.evidence) {
      embed.addFields({ name: 'Evidence', value: data.evidence, inline: false });
    }

    const statusLines: string[] = [];
    statusLines.push(`Discord: ${data.bannedInDiscord ? '✅ Banned' : '❌ Not in server'}`);
    statusLines.push(`Roblox Game: ${data.bannedInRoblox ? '✅ Banned' : '✅ Will be banned on join'}`);

    embed.addFields({ name: 'Status', value: statusLines.join('\n'), inline: false });

    await logChannel.send({ embeds: [embed] });

    // Log to audit database
    await logAudit(guildId, 'ban', data.moderatorDiscordId, data.targetDiscordId || data.targetRobloxId || '', {
      banId: data.banId,
      targetUsername: data.targetUsername,
      reason: data.reason,
      duration: data.duration,
    });

  } catch (error) {
    logger.error('[ModLog] Error logging ban:', error);
  }
}

/**
 * Log an unban action
 */
export async function logUnban(client: Client, guildId: string, data: UnbanLogData): Promise<void> {
  try {
    const modConfig = await prisma.moderationConfig.findUnique({
      where: { id: guildId },
    });

    if (!modConfig?.modLogChannelId) return;

    const guild = await client.guilds.fetch(guildId);
    const logChannel = await guild.channels.fetch(modConfig.modLogChannelId) as TextChannel;

    if (!logChannel || !logChannel.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setTitle('✅ USER UNBANNED')
      .setColor(0x57f287) // Green
      .addFields(
        { name: 'User', value: data.targetUsername, inline: true },
        { name: 'Ban ID', value: `#${data.banId}`, inline: true },
        { name: 'Moderator', value: `<@${data.moderatorDiscordId}>`, inline: true },
        { name: 'Reason', value: data.reason, inline: false }
      )
      .setTimestamp();

    await logChannel.send({ embeds: [embed] });

    await logAudit(guildId, 'unban', data.moderatorDiscordId, '', {
      banId: data.banId,
      targetUsername: data.targetUsername,
      reason: data.reason,
    });

  } catch (error) {
    logger.error('[ModLog] Error logging unban:', error);
  }
}

/**
 * Log a kick action
 */
export async function logKick(client: Client, guildId: string, data: KickLogData): Promise<void> {
  try {
    const modConfig = await prisma.moderationConfig.findUnique({
      where: { id: guildId },
    });

    if (!modConfig?.modLogChannelId) return;

    const guild = await client.guilds.fetch(guildId);
    const logChannel = await guild.channels.fetch(modConfig.modLogChannelId) as TextChannel;

    if (!logChannel || !logChannel.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setTitle('👢 USER KICKED')
      .setColor(0xffa500) // Orange
      .addFields(
        { name: 'User', value: data.targetUsername, inline: true },
        { name: 'Moderator', value: `<@${data.moderatorDiscordId}>`, inline: true },
        { name: 'Reason', value: data.reason, inline: false }
      )
      .setTimestamp();

    if (data.targetDiscordId) {
      embed.addFields({ name: 'Discord ID', value: data.targetDiscordId, inline: true });
    }

    if (data.targetRobloxId) {
      embed.addFields({ name: 'Roblox ID', value: data.targetRobloxId, inline: true });
    }

    const statusLines: string[] = [];
    statusLines.push(`Discord: ${data.kickedFromDiscord ? '✅ Kicked' : '❌ Not in server'}`);
    statusLines.push(`Roblox Game: ${data.kickedFromRoblox ? '✅ Kicked' : '❌ Not in game'}`);

    embed.addFields({ name: 'Status', value: statusLines.join('\n'), inline: false });

    await logChannel.send({ embeds: [embed] });

    await logAudit(guildId, 'kick', data.moderatorDiscordId, data.targetDiscordId || data.targetRobloxId || '', {
      targetUsername: data.targetUsername,
      reason: data.reason,
    });

  } catch (error) {
    logger.error('[ModLog] Error logging kick:', error);
  }
}

/**
 * Log a warning
 */
export async function logWarn(client: Client, guildId: string, data: WarnLogData): Promise<void> {
  try {
    const modConfig = await prisma.moderationConfig.findUnique({
      where: { id: guildId },
    });

    if (!modConfig?.modLogChannelId) return;

    const guild = await client.guilds.fetch(guildId);
    const logChannel = await guild.channels.fetch(modConfig.modLogChannelId) as TextChannel;

    if (!logChannel || !logChannel.isTextBased()) return;

    // Color based on severity
    let color = 0xfee75c; // Yellow (low)
    if (data.severity === 'medium') color = 0xffa500; // Orange
    if (data.severity === 'high') color = 0xed4245; // Red

    const embed = new EmbedBuilder()
      .setTitle('⚠️ WARNING ISSUED')
      .setColor(color)
      .addFields(
        { name: 'User', value: data.targetUsername, inline: true },
        { name: 'Warning ID', value: `#${data.warningId}`, inline: true },
        { name: 'Moderator', value: `<@${data.moderatorDiscordId}>`, inline: true },
        { name: 'Severity', value: data.severity.toUpperCase(), inline: true },
        { name: 'Total Warnings', value: data.totalWarnings.toString(), inline: true },
        { name: '\u200b', value: '\u200b', inline: true },
        { name: 'Reason', value: data.reason, inline: false }
      )
      .setTimestamp();

    if (data.targetDiscordId) {
      embed.addFields({ name: 'Discord User', value: `<@${data.targetDiscordId}>`, inline: true });
    }

    if (data.autoActionTaken) {
      embed.addFields({ name: '🚨 Auto-Action', value: `User auto-${data.autoActionTaken}ed due to warning threshold`, inline: false });
    }

    await logChannel.send({ embeds: [embed] });

    await logAudit(guildId, 'warn', data.moderatorDiscordId, data.targetDiscordId || '', {
      warningId: data.warningId,
      targetUsername: data.targetUsername,
      reason: data.reason,
      severity: data.severity,
      totalWarnings: data.totalWarnings,
    });

  } catch (error) {
    logger.error('[ModLog] Error logging warning:', error);
  }
}

/**
 * Log a warning pardon
 */
export async function logPardon(client: Client, guildId: string, data: PardonLogData): Promise<void> {
  try {
    const modConfig = await prisma.moderationConfig.findUnique({
      where: { id: guildId },
    });

    if (!modConfig?.modLogChannelId) return;

    const guild = await client.guilds.fetch(guildId);
    const logChannel = await guild.channels.fetch(modConfig.modLogChannelId) as TextChannel;

    if (!logChannel || !logChannel.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setTitle('✅ WARNING PARDONED')
      .setColor(0x57f287) // Green
      .addFields(
        { name: 'User', value: data.targetUsername, inline: true },
        { name: 'Warning ID', value: `#${data.warningId}`, inline: true },
        { name: 'Pardoned By', value: `<@${data.moderatorDiscordId}>`, inline: true },
        { name: 'Reason', value: data.reason, inline: false }
      )
      .setTimestamp();

    await logChannel.send({ embeds: [embed] });

    await logAudit(guildId, 'pardon_warning', data.moderatorDiscordId, '', {
      warningId: data.warningId,
      targetUsername: data.targetUsername,
      reason: data.reason,
    });

  } catch (error) {
    logger.error('[ModLog] Error logging pardon:', error);
  }
}

/**
 * Log a ban expiry
 */
export async function logBanExpiry(client: Client, guildId: string, banId: number, username: string): Promise<void> {
  try {
    const modConfig = await prisma.moderationConfig.findUnique({
      where: { id: guildId },
    });

    if (!modConfig?.modLogChannelId) return;

    const guild = await client.guilds.fetch(guildId);
    const logChannel = await guild.channels.fetch(modConfig.modLogChannelId) as TextChannel;

    if (!logChannel || !logChannel.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setTitle('⏰ BAN EXPIRED')
      .setColor(0x5865f2) // Blue
      .addFields(
        { name: 'User', value: username, inline: true },
        { name: 'Ban ID', value: `#${banId}`, inline: true }
      )
      .setDescription('This ban has reached its expiration time and has been automatically lifted.')
      .setTimestamp();

    await logChannel.send({ embeds: [embed] });

    await logAudit(guildId, 'ban_expired', 'SYSTEM', '', {
      banId,
      username,
    });

  } catch (error) {
    logger.error('[ModLog] Error logging ban expiry:', error);
  }
}
