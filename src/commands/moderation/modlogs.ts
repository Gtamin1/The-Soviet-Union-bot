/**
 * /modlogs command - View complete moderation history for a user
 * Combines bans, warnings, and kicks into a single timeline
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import prisma from '../../db/client.js';
import { checkPermission } from '../../lib/permissions.js';
import { getRobloxUserByUsername } from '../../lib/roblox.js';
import { logger } from '../../lib/logger.js';

const LOGS_PER_PAGE = 10;

interface ModLogEntry {
  type: 'ban' | 'warning' | 'kick';
  id: number;
  date: Date;
  reason: string;
  moderator: string;
  status: string;
  severity?: string;
}

export const data = new SlashCommandBuilder()
  .setName('modlogs')
  .setDescription('View complete moderation history for a user')
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('Discord user to check')
      .setRequired(false)
  )
  .addStringOption(option =>
    option
      .setName('roblox')
      .setDescription('Roblox username to check')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!await checkPermission(interaction, 'moderator')) {
    return;
  }

  const discordUser = interaction.options.getUser('user');
  const robloxUsername = interaction.options.getString('roblox');

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

    // Resolve Discord user
    if (discordUser) {
      targetDiscordId = discordUser.id;
      targetDiscordUsername = discordUser.tag;

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

      if (!discordUser) {
        const verifiedUser = await prisma.user.findUnique({
          where: { robloxId: targetRobloxId },
        });

        if (verifiedUser) {
          targetDiscordId = verifiedUser.discordId;
          try {
            const user = await interaction.client.users.fetch(verifiedUser.discordId);
            targetDiscordUsername = user.tag;
          } catch {}
        }
      }
    }

    // Fetch all moderation logs
    const whereClause: any = {
      OR: [
        { discordId: targetDiscordId || undefined },
        { robloxId: targetRobloxId || undefined },
      ],
    };

    const [bans, warnings, kicks] = await Promise.all([
      prisma.ban.findMany({
        where: {
          guildId: interaction.guildId!,
          ...whereClause,
        },
      }),
      prisma.warning.findMany({
        where: {
          guildId: interaction.guildId!,
          ...whereClause,
        },
      }),
      prisma.kick.findMany({
        where: {
          guildId: interaction.guildId!,
          ...whereClause,
        },
      }),
    ]);

    // Combine into timeline
    const timeline: ModLogEntry[] = [];

    for (const ban of bans) {
      timeline.push({
        type: 'ban',
        id: ban.id,
        date: ban.createdAt,
        reason: ban.reason,
        moderator: ban.moderatorUsername,
        status: ban.active ? '✅ Active' : `❌ Unbanned${ban.unbannedBy ? ` by ${ban.unbannedBy}` : ''}`,
      });
    }

    for (const warning of warnings) {
      timeline.push({
        type: 'warning',
        id: warning.id,
        date: warning.createdAt,
        reason: warning.reason,
        moderator: warning.moderatorUsername,
        status: warning.active ? '✅ Active' : `❌ Pardoned${warning.pardonedBy ? ` by ${warning.pardonedBy}` : ''}`,
        severity: warning.severity,
      });
    }

    for (const kick of kicks) {
      timeline.push({
        type: 'kick',
        id: kick.id,
        date: kick.createdAt,
        reason: kick.reason,
        moderator: kick.moderatorUsername,
        status: '✅ Completed',
      });
    }

    // Sort by date (newest first)
    timeline.sort((a, b) => b.date.getTime() - a.date.getTime());

    if (timeline.length === 0) {
      return interaction.editReply({
        content: `✅ **${targetDiscordUsername || targetRobloxUsername}** has no moderation history.`,
      });
    }

    // Store in interaction customId for pagination
    const page = 1;
    await sendModLogsPage(interaction, timeline, targetDiscordUsername || targetRobloxUsername || 'Unknown', targetDiscordId, targetRobloxId, page);

  } catch (error) {
    logger.error('[ModLogs] Error executing modlogs command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while fetching moderation logs.',
    });
  }
}

async function sendModLogsPage(
  interaction: ChatInputCommandInteraction | any,
  timeline: ModLogEntry[],
  username: string,
  discordId: string | null,
  robloxId: string | null,
  page: number
) {
  const totalPages = Math.ceil(timeline.length / LOGS_PER_PAGE);
  const start = (page - 1) * LOGS_PER_PAGE;
  const end = start + LOGS_PER_PAGE;
  const pageEntries = timeline.slice(start, end);

  const embed = new EmbedBuilder()
    .setTitle(`📋 Moderation History: ${username}`)
    .setColor(0x5865f2)
    .setDescription(`Total Entries: **${timeline.length}**`)
    .setFooter({ text: `Page ${page} of ${totalPages}` })
    .setTimestamp();

  if (discordId) {
    embed.addFields({ name: 'Discord ID', value: discordId, inline: true });
  }

  if (robloxId) {
    embed.addFields({ name: 'Roblox ID', value: robloxId, inline: true });
  }

  // Add entries
  for (const entry of pageEntries) {
    const icons = {
      ban: '🔨',
      warning: '⚠️',
      kick: '👢',
    };

    const severityEmojis: Record<string, string> = {
      low: '🟡',
      medium: '🟠',
      high: '🔴',
    };

    let fieldValue = [
      `**Reason:** ${entry.reason}`,
      `**Moderator:** ${entry.moderator}`,
      `**Status:** ${entry.status}`,
    ];

    if (entry.severity) {
      fieldValue.splice(1, 0, `**Severity:** ${severityEmojis[entry.severity] || '⚪'} ${entry.severity.toUpperCase()}`);
    }

    fieldValue.push(`**Date:** <t:${Math.floor(entry.date.getTime() / 1000)}:R>`);

    embed.addFields({
      name: `${icons[entry.type]} ${entry.type.toUpperCase()} #${entry.id}`,
      value: fieldValue.join('\n'),
      inline: false,
    });
  }

  // Pagination buttons
  const row = new ActionRowBuilder<ButtonBuilder>();

  if (page > 1) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`modlogs_prev_${page}_${discordId || robloxId}`)
        .setLabel('◀ Previous')
        .setStyle(ButtonStyle.Primary)
    );
  }

  if (page < totalPages) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`modlogs_next_${page}_${discordId || robloxId}`)
        .setLabel('Next ▶')
        .setStyle(ButtonStyle.Primary)
    );
  }

  const messageOptions: any = { embeds: [embed] };
  if (row.components.length > 0) {
    messageOptions.components = [row];
  }

  if (interaction.replied || interaction.deferred) {
    await interaction.editReply(messageOptions);
  } else {
    await interaction.reply(messageOptions);
  }
}
