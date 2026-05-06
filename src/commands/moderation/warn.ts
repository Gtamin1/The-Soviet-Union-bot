/**
 * /warn command - Issue a warning to a user
 * Tracks warnings and can trigger auto-kick/auto-ban
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, GuildMember } from 'discord.js';
import prisma from '../../db/client.js';
import { checkPermission, canModerateUser } from '../../lib/permissions.js';
import { getRobloxUserByUsername } from '../../lib/roblox.js';
import { logWarn } from '../../lib/modLogger.js';
import { logger } from '../../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('warn')
  .setDescription('Issue a warning to a user')
  .addStringOption(option =>
    option
      .setName('reason')
      .setDescription('Reason for the warning')
      .setRequired(true)
      .setMinLength(3)
      .setMaxLength(500)
  )
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('Discord user to warn')
      .setRequired(false)
  )
  .addStringOption(option =>
    option
      .setName('roblox')
      .setDescription('Roblox username to warn')
      .setRequired(false)
  )
  .addStringOption(option =>
    option
      .setName('severity')
      .setDescription('Warning severity level')
      .setRequired(false)
      .addChoices(
        { name: 'Low', value: 'low' },
        { name: 'Medium', value: 'medium' },
        { name: 'High', value: 'high' }
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!await checkPermission(interaction, 'moderator')) {
    return;
  }

  const discordUser = interaction.options.getUser('user');
  const robloxUsername = interaction.options.getString('roblox');
  const reason = interaction.options.getString('reason', true);
  const severity = interaction.options.getString('severity') || 'low';

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

    // Resolve Discord user
    if (discordUser) {
      targetDiscordId = discordUser.id;
      targetDiscordUsername = discordUser.tag;

      try {
        targetMember = await interaction.guild!.members.fetch(discordUser.id);
      } catch {
        // Not in server, still can warn
      }

      // Get Roblox info if verified
      const verifiedUser = await prisma.user.findUnique({
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

      // Check if this Roblox user is verified
      if (!discordUser) {
        const verifiedUser = await prisma.user.findUnique({
          where: { robloxId: targetRobloxId },
        });

        if (verifiedUser) {
          targetDiscordId = verifiedUser.discordId;
          try {
            const user = await interaction.client.users.fetch(verifiedUser.discordId);
            targetDiscordUsername = user.tag;
            targetMember = await interaction.guild!.members.fetch(verifiedUser.discordId);
          } catch {}
        }
      }
    }

    // Permission check
    if (targetMember) {
      const canModerate = await canModerateUser(interaction.member as GuildMember, targetMember);
      if (!canModerate.allowed) {
        return interaction.editReply({
          content: `❌ ${canModerate.reason}`,
        });
      }
    }

    // Create warning
    await prisma.warning.create({
      data: {
        guildId: interaction.guildId!,
        discordId: targetDiscordId,
        robloxId: targetRobloxId,
        targetUsername: targetDiscordUsername || targetRobloxUsername || 'Unknown',
        reason: reason,
        severity: severity,
        moderatorDiscordId: interaction.user.id,
        moderatorUsername: interaction.user.tag,
        active: true,
      },
    });

    // Count total active warnings for this user
    const warningCount = await prisma.warning.count({
      where: {
        guildId: interaction.guildId!,
        active: true,
        OR: [
          { discordId: targetDiscordId || undefined },
          { robloxId: targetRobloxId || undefined },
        ],
      },
    });

    // Check for auto-moderation thresholds
    const modConfig = await prisma.moderationConfig.findUnique({
      where: { id: interaction.guildId! },
    });

    let autoAction: string | null = null;

    // Auto-ban check
    if (modConfig?.autoBanWarnings && warningCount >= modConfig.autoBanWarnings) {
      autoAction = 'banned';

      // Create permanent ban
      await prisma.ban.create({
        data: {
          guildId: interaction.guildId!,
          discordId: targetDiscordId,
          discordUsername: targetDiscordUsername,
          robloxId: targetRobloxId,
          robloxUsername: targetRobloxUsername,
          reason: `Auto-ban: ${warningCount} warnings reached`,
          duration: null,
          expiresAt: null,
          active: true,
          bannedInDiscord: false,
          bannedInRoblox: true,
          moderatorDiscordId: interaction.client.user!.id,
          moderatorUsername: 'Auto-Moderation',
        },
      });

      // Try to ban from Discord
      if (targetMember) {
        try {
          await targetMember.ban({ reason: `Auto-ban: ${warningCount} warnings` });
        } catch (error) {
          logger.error(`[Warn] Failed to auto-ban ${targetDiscordUsername}:`, error);
        }
      }

    } else if (modConfig?.autoKickWarnings && warningCount >= modConfig.autoKickWarnings) {
      autoAction = 'kicked';

      // Create kick record
      await prisma.kick.create({
        data: {
          guildId: interaction.guildId!,
          discordId: targetDiscordId,
          robloxId: targetRobloxId,
          targetUsername: targetDiscordUsername || targetRobloxUsername || 'Unknown',
          reason: `Auto-kick: ${warningCount} warnings reached`,
          kickedFromDiscord: false,
          kickedFromRoblox: false,
          moderatorDiscordId: interaction.client.user!.id,
          moderatorUsername: 'Auto-Moderation',
        },
      });

      // Try to kick from Discord
      if (targetMember) {
        try {
          await targetMember.kick(`Auto-kick: ${warningCount} warnings`);
        } catch (error) {
          logger.error(`[Warn] Failed to auto-kick ${targetDiscordUsername}:`, error);
        }
      }

      // Queue kick for Roblox
      if (targetRobloxId) {
        try {
          await prisma.pendingKick.create({
            data: {
              robloxId: targetRobloxId,
              reason: `Auto-kick: ${warningCount} warnings`,
            },
          });
        } catch (error) {
          logger.error(`[Warn] Failed to queue auto-kick for Roblox:`, error);
        }
      }
    }

    // Try to DM the user
    let dmSent = false;
    if (targetDiscordId) {
      try {
        const targetUser = await interaction.client.users.fetch(targetDiscordId);

        const severityColors = {
          low: 0xffff00,    // Yellow
          medium: 0xffa500, // Orange
          high: 0xed4245    // Red
        };

        const dmEmbed = new EmbedBuilder()
          .setTitle(`⚠️ You have received a ${severity} severity warning`)
          .setColor(severityColors[severity as keyof typeof severityColors])
          .addFields(
            { name: 'Server', value: interaction.guild!.name, inline: true },
            { name: 'Reason', value: reason, inline: false },
            { name: 'Total Warnings', value: `${warningCount}`, inline: true }
          )
          .setTimestamp();

        if (autoAction) {
          dmEmbed.addFields({
            name: '⚠️ Auto-Moderation Action',
            value: `You have been **${autoAction}** for reaching ${warningCount} warnings.`,
            inline: false
          });
        }

        await targetUser.send({ embeds: [dmEmbed] });
        dmSent = true;
      } catch {
        // Could not DM user
      }
    }

    // Response embed
    const severityEmojis = {
      low: '🟡',
      medium: '🟠',
      high: '🔴'
    };

    const embed = new EmbedBuilder()
      .setTitle(`${severityEmojis[severity as keyof typeof severityEmojis]} WARNING ISSUED`)
      .setColor(severity === 'high' ? 0xed4245 : severity === 'medium' ? 0xffa500 : 0xffff00)
      .addFields(
        { name: 'User', value: targetDiscordUsername || targetRobloxUsername || 'Unknown', inline: true },
        { name: 'Warned By', value: interaction.user.tag, inline: true },
        { name: 'Severity', value: severity.toUpperCase(), inline: true },
        { name: 'Reason', value: reason, inline: false },
        { name: 'Total Warnings', value: `${warningCount}`, inline: true },
        { name: 'DM Sent', value: dmSent ? '✅ Yes' : '❌ No', inline: true }
      )
      .setTimestamp();

    if (targetDiscordId) {
      embed.addFields({ name: 'Discord ID', value: targetDiscordId, inline: true });
    }

    if (targetRobloxId) {
      embed.addFields({ name: 'Roblox ID', value: targetRobloxId, inline: true });
    }

    if (autoAction) {
      embed.addFields({
        name: '⚠️ Auto-Moderation Triggered',
        value: `User has been **${autoAction}** for reaching ${warningCount} warnings.`,
        inline: false
      });
    }

    await interaction.editReply({ embeds: [embed] });

    // Log to mod-log channel
    await logWarn(interaction.client, interaction.guildId!, {
      targetUsername: targetDiscordUsername || targetRobloxUsername || 'Unknown',
      targetDiscordId: targetDiscordId || undefined,
      targetRobloxId: targetRobloxId || undefined,
      reason: reason,
      severity: severity,
      warningCount: warningCount,
      moderatorUsername: interaction.user.tag,
      moderatorDiscordId: interaction.user.id,
    });

    logger.info(`[Warn] ${interaction.user.tag} warned ${targetDiscordUsername || targetRobloxUsername} (${severity})`);

  } catch (error) {
    logger.error('[Warn] Error executing warn command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while issuing the warning.',
    });
  }
}
