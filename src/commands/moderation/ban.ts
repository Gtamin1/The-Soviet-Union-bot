/**
 * /ban command - Ban a user from Discord AND Roblox game
 * Supports banning by Discord user or Roblox username
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, GuildMember } from 'discord.js';
import prisma from '../../db/client.js';
import { checkPermission, canModerateUser } from '../../lib/permissions.js';
import { getRobloxUserByUsername } from '../../lib/roblox.js';
import { logBan } from '../../lib/modLogger.js';
import { logger } from '../../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('ban')
  .setDescription('Ban a user from Discord and Roblox game')
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('Discord user to ban')
      .setRequired(false)
  )
  .addStringOption(option =>
    option
      .setName('roblox')
      .setDescription('Roblox username to ban (if not in Discord)')
      .setRequired(false)
  )
  .addStringOption(option =>
    option
      .setName('reason')
      .setDescription('Reason for the ban')
      .setRequired(true)
      .setMinLength(3)
      .setMaxLength(500)
  )
  .addStringOption(option =>
    option
      .setName('duration')
      .setDescription('Ban duration (e.g., 1h, 7d, 30d, permanent)')
      .setRequired(false)
      .addChoices(
        { name: '1 hour', value: '1h' },
        { name: '12 hours', value: '12h' },
        { name: '1 day', value: '1d' },
        { name: '3 days', value: '3d' },
        { name: '7 days', value: '7d' },
        { name: '14 days', value: '14d' },
        { name: '30 days', value: '30d' },
        { name: 'Permanent', value: 'permanent' }
      )
  )
  .addStringOption(option =>
    option
      .setName('evidence')
      .setDescription('Evidence (screenshot URL, description, etc.)')
      .setRequired(false)
      .setMaxLength(1000)
  )
  .addBooleanOption(option =>
    option
      .setName('silent')
      .setDescription('Do not DM the user about the ban')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  // Permission check
  if (!await checkPermission(interaction, 'moderator')) {
    return;
  }

  const discordUser = interaction.options.getUser('user');
  const robloxUsername = interaction.options.getString('roblox');
  const reason = interaction.options.getString('reason', true);
  const durationStr = interaction.options.getString('duration') || 'permanent';
  const evidence = interaction.options.getString('evidence');
  const silent = interaction.options.getBoolean('silent') || false;

  // Validate: Must provide either user or roblox
  if (!discordUser && !robloxUsername) {
    return interaction.reply({
      content: '❌ You must provide either a Discord `user` or a `roblox` username.',
      ephemeral: true,
    });
  }

  await interaction.deferReply();

  try {
    let targetDiscordId: string | null = null;
    let targetDiscordUsername: string | null = null;
    let targetRobloxId: string | null = null;
    let targetRobloxUsername: string | null = null;
    let targetMember: GuildMember | null = null;
    let verifiedUser: any = null;

    // Resolve Discord user
    if (discordUser) {
      targetDiscordId = discordUser.id;
      targetDiscordUsername = discordUser.tag;

      // Try to get as guild member
      try {
        targetMember = await interaction.guild!.members.fetch(discordUser.id);
      } catch {
        // Not in server
      }

      // Check if verified -> get Roblox info
      verifiedUser = await prisma.user.findUnique({
        where: { discordId: discordUser.id },
      });

      if (verifiedUser) {
        targetRobloxId = verifiedUser.robloxId;
        targetRobloxUsername = verifiedUser.robloxUsername;
      }
    }

    // Resolve Roblox user
    if (robloxUsername) {
      const robloxData = await getRobloxUserByUsername(robloxUsername);

      if (!robloxData) {
        return interaction.editReply({
          content: `❌ Roblox user **${robloxUsername}** not found.`,
        });
      }

      targetRobloxId = robloxData.id.toString();
      targetRobloxUsername = robloxData.name;

      // Check if this Roblox user is verified -> get Discord info
      if (!discordUser) {
        verifiedUser = await prisma.user.findUnique({
          where: { robloxId: targetRobloxId },
        });

        if (verifiedUser) {
          targetDiscordId = verifiedUser.discordId;
          try {
            const user = await interaction.client.users.fetch(verifiedUser.discordId);
            targetDiscordUsername = user.tag;
            targetMember = await interaction.guild!.members.fetch(verifiedUser.discordId);
          } catch {
            // Not in server
          }
        }
      }
    }

    // Permission check: Can moderator ban this user?
    if (targetMember) {
      const canModerate = await canModerateUser(interaction.member as GuildMember, targetMember);
      if (!canModerate.allowed) {
        return interaction.editReply({
          content: `❌ ${canModerate.reason}`,
        });
      }
    }

    // Check if already banned
    const existingBan = await prisma.ban.findFirst({
      where: {
        guildId: interaction.guildId!,
        active: true,
        OR: [
          { discordId: targetDiscordId || undefined },
          { robloxId: targetRobloxId || undefined },
        ],
      },
    });

    if (existingBan) {
      return interaction.editReply({
        content: `❌ This user is already banned (Ban ID: #${existingBan.id}).`,
      });
    }

    // Parse duration
    let durationSeconds: number | null = null;
    let expiresAt: Date | null = null;

    if (durationStr !== 'permanent') {
      durationSeconds = parseDuration(durationStr);
      if (durationSeconds === null) {
        return interaction.editReply({
          content: `❌ Invalid duration format: ${durationStr}`,
        });
      }
      expiresAt = new Date(Date.now() + durationSeconds * 1000);
    }

    // Try to DM the user BEFORE banning (can't DM after ban)
    let dmSent = false;
    if (targetDiscordId && !silent) {
      try {
        const targetUser = await interaction.client.users.fetch(targetDiscordId);
        const dmEmbed = new EmbedBuilder()
          .setTitle('🔨 You have been banned')
          .setColor(0xed4245)
          .addFields(
            { name: 'Server', value: interaction.guild!.name, inline: true },
            { name: 'Reason', value: reason, inline: false },
            { name: 'Duration', value: durationStr === 'permanent' ? 'Permanent' : formatDuration(durationSeconds!), inline: true }
          )
          .setTimestamp();

        if (expiresAt) {
          dmEmbed.addFields({ name: 'Expires', value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:F>`, inline: true });
        }

        if (evidence) {
          dmEmbed.addFields({ name: 'Evidence', value: evidence, inline: false });
        }

        await targetUser.send({ embeds: [dmEmbed] });
        dmSent = true;
      } catch (error) {
        logger.warn(`Could not DM user ${targetDiscordId} about ban`);
      }
    }

    // Discord ban
    let bannedInDiscord = false;
    if (targetMember) {
      try {
        await targetMember.ban({ reason: `[Ban #TBD] ${reason}` });
        bannedInDiscord = true;
        logger.info(`[Ban] Banned ${targetDiscordUsername} from Discord`);
      } catch (error: any) {
        logger.error(`[Ban] Failed to ban ${targetDiscordUsername} from Discord:`, error);
      }
    }

    // Create ban record in database
    const ban = await prisma.ban.create({
      data: {
        guildId: interaction.guildId!,
        discordId: targetDiscordId,
        discordUsername: targetDiscordUsername,
        robloxId: targetRobloxId,
        robloxUsername: targetRobloxUsername,
        reason: reason,
        evidence: evidence,
        duration: durationSeconds,
        expiresAt: expiresAt,
        active: true,
        bannedInDiscord: bannedInDiscord,
        bannedInRoblox: true, // Will be enforced by game on join
        moderatorDiscordId: interaction.user.id,
        moderatorUsername: interaction.user.tag,
      },
    });

    // Update Discord ban reason with ban ID
    if (bannedInDiscord && targetDiscordId) {
      try {
        await interaction.guild!.bans.create(targetDiscordId, {
          reason: `[Ban #${ban.id}] ${reason}`,
        });
      } catch {}
    }

    // Build response embed
    const responseEmbed = new EmbedBuilder()
      .setTitle('🔨 USER BANNED')
      .setColor(0xed4245)
      .addFields(
        { name: 'Ban ID', value: `#${ban.id}`, inline: true },
        { name: 'Moderator', value: interaction.user.tag, inline: true },
        { name: '\u200b', value: '\u200b', inline: true },
        { name: 'Reason', value: reason, inline: false }
      )
      .setTimestamp();

    if (targetDiscordUsername) {
      responseEmbed.addFields({ name: 'Discord User', value: `${targetDiscordUsername} (${targetDiscordId})`, inline: false });
    }

    if (targetRobloxUsername) {
      responseEmbed.addFields({ name: 'Roblox User', value: `${targetRobloxUsername} (${targetRobloxId})`, inline: false });
    }

    responseEmbed.addFields({
      name: 'Duration',
      value: durationStr === 'permanent' ? 'Permanent' : formatDuration(durationSeconds!),
      inline: true,
    });

    if (expiresAt) {
      responseEmbed.addFields({
        name: 'Expires',
        value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:F>`,
        inline: true,
      });
    }

    if (evidence) {
      responseEmbed.addFields({ name: 'Evidence', value: evidence, inline: false });
    }

    const statusLines: string[] = [];
    statusLines.push(`Discord: ${bannedInDiscord ? '✅ Banned' : '❌ Not in server'}`);
    statusLines.push(`Roblox Game: ✅ Will be banned on join`);
    statusLines.push(`DM Sent: ${dmSent ? '✅ Yes' : '❌ No'}`);

    responseEmbed.addFields({ name: 'Status', value: statusLines.join('\n'), inline: false });

    await interaction.editReply({ embeds: [responseEmbed] });

    // Log to mod-log channel
    await logBan(interaction.client, interaction.guildId!, {
      banId: ban.id,
      targetUsername: targetDiscordUsername || targetRobloxUsername || 'Unknown',
      targetRobloxId: targetRobloxId || undefined,
      targetDiscordId: targetDiscordId || undefined,
      reason: reason,
      duration: durationStr === 'permanent' ? undefined : formatDuration(durationSeconds!),
      expiresAt: expiresAt || undefined,
      evidence: evidence || undefined,
      moderatorUsername: interaction.user.tag,
      moderatorDiscordId: interaction.user.id,
      bannedInDiscord: bannedInDiscord,
      bannedInRoblox: true,
    });

    logger.info(`[Ban] ${interaction.user.tag} banned ${targetDiscordUsername || targetRobloxUsername} (Ban ID: #${ban.id})`);

  } catch (error) {
    logger.error('[Ban] Error executing ban command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while executing the ban.',
    });
  }
}

/**
 * Parse duration string to seconds
 * Examples: "1h" -> 3600, "7d" -> 604800
 */
function parseDuration(str: string): number | null {
  const match = str.match(/^(\d+)(h|d)$/);
  if (!match) return null;

  const value = parseInt(match[1]);
  const unit = match[2];

  if (unit === 'h') return value * 3600;
  if (unit === 'd') return value * 86400;

  return null;
}

/**
 * Format duration seconds to human-readable string
 */
function formatDuration(seconds: number): string {
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }

  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }

  const days = Math.floor(seconds / 86400);
  return `${days} day${days !== 1 ? 's' : ''}`;
}
