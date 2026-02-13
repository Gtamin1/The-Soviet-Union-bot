/**
 * /warnings command - View all warnings for a user
 * Supports pagination for users with many warnings
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import prisma from '../../db/client.js';
import { checkPermission } from '../../lib/permissions.js';
import { getRobloxUserByUsername } from '../../lib/roblox.js';
import { logger } from '../../lib/logger.js';

const WARNINGS_PER_PAGE = 5;

export const data = new SlashCommandBuilder()
  .setName('warnings')
  .setDescription('View all warnings for a user')
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
  )
  .addIntegerOption(option =>
    option
      .setName('page')
      .setDescription('Page number (default: 1)')
      .setRequired(false)
      .setMinValue(1)
  )
  .addBooleanOption(option =>
    option
      .setName('include-pardoned')
      .setDescription('Include pardoned warnings (default: false)')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!await checkPermission(interaction, 'moderator')) {
    return;
  }

  const discordUser = interaction.options.getUser('user');
  const robloxUsername = interaction.options.getString('roblox');
  const page = interaction.options.getInteger('page') || 1;
  const includePardoned = interaction.options.getBoolean('include-pardoned') || false;

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

    // Build query
    const whereClause: any = {
      guildId: interaction.guildId!,
      OR: [
        { discordId: targetDiscordId || undefined },
        { robloxId: targetRobloxId || undefined },
      ],
    };

    if (!includePardoned) {
      whereClause.active = true;
    }

    // Get total count
    const totalCount = await prisma.warning.count({ where: whereClause });

    if (totalCount === 0) {
      return interaction.editReply({
        content: `✅ **${targetDiscordUsername || targetRobloxUsername}** has no warnings.`,
      });
    }

    // Calculate pagination
    const totalPages = Math.ceil(totalCount / WARNINGS_PER_PAGE);
    const skip = (page - 1) * WARNINGS_PER_PAGE;

    if (page > totalPages) {
      return interaction.editReply({
        content: `❌ Page ${page} does not exist. There are only ${totalPages} page(s).`,
      });
    }

    // Fetch warnings
    const warnings = await prisma.warning.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      skip: skip,
      take: WARNINGS_PER_PAGE,
    });

    // Build embed
    const embed = new EmbedBuilder()
      .setTitle(`⚠️ Warnings for ${targetDiscordUsername || targetRobloxUsername}`)
      .setColor(0xffa500)
      .setDescription(`Total Warnings: **${totalCount}** ${includePardoned ? '(including pardoned)' : '(active only)'}`)
      .setFooter({ text: `Page ${page} of ${totalPages}` })
      .setTimestamp();

    if (targetDiscordId) {
      embed.addFields({ name: 'Discord ID', value: targetDiscordId, inline: true });
    }

    if (targetRobloxId) {
      embed.addFields({ name: 'Roblox ID', value: targetRobloxId, inline: true });
    }

    // Add warnings
    for (const warning of warnings) {
      const severityEmojis: Record<string, string> = {
        low: '🟡',
        medium: '🟠',
        high: '🔴'
      };

      const statusText = warning.active
        ? '✅ Active'
        : `❌ Pardoned by ${warning.pardonedBy}`;

      const fieldValue = [
        `**Reason:** ${warning.reason}`,
        `**Severity:** ${severityEmojis[warning.severity] || '⚪'} ${warning.severity.toUpperCase()}`,
        `**Moderator:** ${warning.moderatorUsername}`,
        `**Status:** ${statusText}`,
        `**Date:** <t:${Math.floor(warning.createdAt.getTime() / 1000)}:R>`,
      ].join('\n');

      embed.addFields({
        name: `Warning #${warning.id}`,
        value: fieldValue,
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    logger.error('[Warnings] Error executing warnings command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while fetching warnings.',
    });
  }
}
