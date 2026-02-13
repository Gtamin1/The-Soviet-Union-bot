/**
 * /banlist command - View all active bans in the server
 * Paginated list with Previous/Next buttons
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import prisma from '../../db/client.js';
import { checkPermission } from '../../lib/permissions.js';
import { logger } from '../../lib/logger.js';

const BANS_PER_PAGE = 10;

export const data = new SlashCommandBuilder()
  .setName('banlist')
  .setDescription('View all active bans in this server')
  .addIntegerOption(option =>
    option
      .setName('page')
      .setDescription('Page number (default: 1)')
      .setRequired(false)
      .setMinValue(1)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!await checkPermission(interaction, 'moderator')) {
    return;
  }

  const page = interaction.options.getInteger('page') || 1;

  await interaction.deferReply();

  try {
    // Get total count of active bans
    const totalCount = await prisma.ban.count({
      where: {
        guildId: interaction.guildId!,
        active: true,
      },
    });

    if (totalCount === 0) {
      return interaction.editReply({
        content: '✅ There are no active bans in this server.',
      });
    }

    // Calculate pagination
    const totalPages = Math.ceil(totalCount / BANS_PER_PAGE);
    const skip = (page - 1) * BANS_PER_PAGE;

    if (page > totalPages) {
      return interaction.editReply({
        content: `❌ Page ${page} does not exist. There are only ${totalPages} page(s).`,
      });
    }

    // Fetch bans
    const bans = await prisma.ban.findMany({
      where: {
        guildId: interaction.guildId!,
        active: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: skip,
      take: BANS_PER_PAGE,
    });

    // Build embed
    const embed = new EmbedBuilder()
      .setTitle('🔨 Active Bans')
      .setColor(0xed4245)
      .setDescription(`Total Active Bans: **${totalCount}**`)
      .setFooter({ text: `Page ${page} of ${totalPages}` })
      .setTimestamp();

    // Add ban entries
    for (const ban of bans) {
      const username = ban.discordUsername || ban.robloxUsername || 'Unknown';
      const expires = ban.expiresAt
        ? `<t:${Math.floor(ban.expiresAt.getTime() / 1000)}:R>`
        : '**Permanent**';

      const fieldValue = [
        `**User:** ${username}`,
        `**Reason:** ${ban.reason}`,
        `**Expires:** ${expires}`,
        `**Moderator:** ${ban.moderatorUsername}`,
      ];

      if (ban.discordId) {
        fieldValue.push(`**Discord ID:** ${ban.discordId}`);
      }

      if (ban.robloxId) {
        fieldValue.push(`**Roblox ID:** ${ban.robloxId}`);
      }

      fieldValue.push(`**Banned:** <t:${Math.floor(ban.createdAt.getTime() / 1000)}:R>`);

      embed.addFields({
        name: `Ban #${ban.id}`,
        value: fieldValue.join('\n'),
        inline: false,
      });
    }

    // Pagination buttons
    const row = new ActionRowBuilder<ButtonBuilder>();

    if (page > 1) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`banlist_prev_${page}`)
          .setLabel('◀ Previous')
          .setStyle(ButtonStyle.Primary)
      );
    }

    if (page < totalPages) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`banlist_next_${page}`)
          .setLabel('Next ▶')
          .setStyle(ButtonStyle.Primary)
      );
    }

    const messageOptions: any = { embeds: [embed] };
    if (row.components.length > 0) {
      messageOptions.components = [row];
    }

    await interaction.editReply(messageOptions);

  } catch (error) {
    logger.error('[BanList] Error executing banlist command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while fetching the ban list.',
    });
  }
}
