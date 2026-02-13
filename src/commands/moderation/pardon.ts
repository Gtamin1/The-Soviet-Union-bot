/**
 * /pardon command - Pardon (remove) a warning
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import prisma from '../../db/client.js';
import { checkPermission } from '../../lib/permissions.js';
import { logPardon } from '../../lib/modLogger.js';
import { logger } from '../../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('pardon')
  .setDescription('Pardon (remove) a warning from a user')
  .addIntegerOption(option =>
    option
      .setName('warning-id')
      .setDescription('The warning ID to pardon')
      .setRequired(true)
      .setMinValue(1)
  )
  .addStringOption(option =>
    option
      .setName('reason')
      .setDescription('Reason for pardoning')
      .setRequired(false)
      .setMaxLength(500)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!await checkPermission(interaction, 'moderator')) {
    return;
  }

  const warningId = interaction.options.getInteger('warning-id', true);
  const reason = interaction.options.getString('reason') || 'No reason provided';

  await interaction.deferReply();

  try {
    // Find the warning
    const warning = await prisma.warning.findFirst({
      where: {
        id: warningId,
        guildId: interaction.guildId!,
      },
    });

    if (!warning) {
      return interaction.editReply({
        content: `❌ Warning #${warningId} not found in this server.`,
      });
    }

    if (!warning.active) {
      return interaction.editReply({
        content: `❌ Warning #${warningId} has already been pardoned.`,
      });
    }

    // Pardon the warning
    await prisma.warning.update({
      where: { id: warningId },
      data: {
        active: false,
        pardonedAt: new Date(),
        pardonedBy: interaction.user.tag,
      },
    });

    // Count remaining active warnings
    const remainingWarnings = await prisma.warning.count({
      where: {
        guildId: interaction.guildId!,
        active: true,
        OR: [
          { discordId: warning.discordId || undefined },
          { robloxId: warning.robloxId || undefined },
        ],
      },
    });

    // Try to DM the user
    let dmSent = false;
    if (warning.discordId) {
      try {
        const targetUser = await interaction.client.users.fetch(warning.discordId);

        const dmEmbed = new EmbedBuilder()
          .setTitle('✅ Warning Pardoned')
          .setColor(0x57f287)
          .addFields(
            { name: 'Server', value: interaction.guild!.name, inline: true },
            { name: 'Warning ID', value: `#${warningId}`, inline: true },
            { name: 'Reason', value: reason, inline: false },
            { name: 'Remaining Warnings', value: `${remainingWarnings}`, inline: true }
          )
          .setTimestamp();

        await targetUser.send({ embeds: [dmEmbed] });
        dmSent = true;
      } catch {
        // Could not DM user
      }
    }

    // Response embed
    const embed = new EmbedBuilder()
      .setTitle('✅ WARNING PARDONED')
      .setColor(0x57f287)
      .addFields(
        { name: 'Warning ID', value: `#${warningId}`, inline: true },
        { name: 'User', value: warning.targetUsername, inline: true },
        { name: 'Pardoned By', value: interaction.user.tag, inline: true },
        { name: 'Original Reason', value: warning.reason, inline: false },
        { name: 'Pardon Reason', value: reason, inline: false },
        { name: 'Remaining Warnings', value: `${remainingWarnings}`, inline: true },
        { name: 'DM Sent', value: dmSent ? '✅ Yes' : '❌ No', inline: true }
      )
      .setTimestamp();

    if (warning.discordId) {
      embed.addFields({ name: 'Discord ID', value: warning.discordId, inline: true });
    }

    if (warning.robloxId) {
      embed.addFields({ name: 'Roblox ID', value: warning.robloxId, inline: true });
    }

    await interaction.editReply({ embeds: [embed] });

    // Log to mod-log channel
    await logPardon(interaction.client, interaction.guildId!, {
      warningId: warningId,
      targetUsername: warning.targetUsername,
      targetDiscordId: warning.discordId || undefined,
      targetRobloxId: warning.robloxId || undefined,
      originalReason: warning.reason,
      pardonReason: reason,
      remainingWarnings: remainingWarnings,
      moderatorUsername: interaction.user.tag,
      moderatorDiscordId: interaction.user.id,
    });

    logger.info(`[Pardon] ${interaction.user.tag} pardoned warning #${warningId} for ${warning.targetUsername}`);

  } catch (error) {
    logger.error('[Pardon] Error executing pardon command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while pardoning the warning.',
    });
  }
}
