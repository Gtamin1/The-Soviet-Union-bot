/**
 * /unban command - Unban a user
 * Can unban by Discord user, Roblox username, or Ban ID
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import prisma from '../../db/client.js';
import { checkPermission } from '../../lib/permissions.js';
import { getRobloxUserByUsername } from '../../lib/roblox.js';
import { logUnban } from '../../lib/modLogger.js';
import { logger } from '../../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('unban')
  .setDescription('Unban a user')
  .addStringOption(option =>
    option
      .setName('reason')
      .setDescription('Reason for unbanning')
      .setRequired(true)
      .setMinLength(3)
      .setMaxLength(500)
  )
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('Discord user to unban')
      .setRequired(false)
  )
  .addStringOption(option =>
    option
      .setName('roblox')
      .setDescription('Roblox username to unban')
      .setRequired(false)
  )
  .addIntegerOption(option =>
    option
      .setName('ban-id')
      .setDescription('Ban ID number')
      .setRequired(false)
      .setMinValue(1)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  // Permission check
  if (!await checkPermission(interaction, 'moderator')) {
    return;
  }

  const discordUser = interaction.options.getUser('user');
  const robloxUsername = interaction.options.getString('roblox');
  const banId = interaction.options.getInteger('ban-id');
  const reason = interaction.options.getString('reason', true);

  // Validate: Must provide one of the three
  if (!discordUser && !robloxUsername && !banId) {
    return interaction.reply({
      content: '❌ You must provide either a Discord `user`, `roblox` username, or `ban-id`.',
      ephemeral: true,
    });
  }

  await interaction.deferReply();

  try {
    let ban: any = null;

    // Find ban by ID
    if (banId) {
      ban = await prisma.ban.findFirst({
        where: {
          id: banId,
          guildId: interaction.guildId!,
          active: true,
        },
      });

      if (!ban) {
        return interaction.editReply({
          content: `❌ No active ban found with ID #${banId}.`,
        });
      }
    }
    // Find ban by Discord user
    else if (discordUser) {
      ban = await prisma.ban.findFirst({
        where: {
          discordId: discordUser.id,
          guildId: interaction.guildId!,
          active: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!ban) {
        return interaction.editReply({
          content: `❌ No active ban found for ${discordUser.tag}.`,
        });
      }
    }
    // Find ban by Roblox username
    else if (robloxUsername) {
      const robloxData = await getRobloxUserByUsername(robloxUsername);

      if (!robloxData) {
        return interaction.editReply({
          content: `❌ Roblox user **${robloxUsername}** not found.`,
        });
      }

      ban = await prisma.ban.findFirst({
        where: {
          robloxId: robloxData.id.toString(),
          guildId: interaction.guildId!,
          active: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!ban) {
        return interaction.editReply({
          content: `❌ No active ban found for Roblox user **${robloxData.name}**.`,
        });
      }
    }

    if (!ban) {
      return interaction.editReply({
        content: '❌ No active ban found.',
      });
    }

    // Update ban record
    await prisma.ban.update({
      where: { id: ban.id },
      data: {
        active: false,
        unbannedAt: new Date(),
        unbannedBy: interaction.user.id,
        unbanReason: reason,
      },
    });

    // Unban from Discord if they were Discord-banned
    if (ban.bannedInDiscord && ban.discordId) {
      try {
        await interaction.guild!.bans.remove(ban.discordId, `[Unban by ${interaction.user.tag}] ${reason}`);
        logger.info(`[Unban] Unbanned ${ban.discordUsername} from Discord`);
      } catch (error: any) {
        logger.warn(`[Unban] Could not unban ${ban.discordUsername} from Discord (may not be banned):`, error.message);
      }
    }

    // Game ban is automatically lifted (API will return no active ban)

    // Build response embed
    const embed = new EmbedBuilder()
      .setTitle('✅ USER UNBANNED')
      .setColor(0x57f287) // Green
      .addFields(
        { name: 'Ban ID', value: `#${ban.id}`, inline: true },
        { name: 'Unbanned By', value: interaction.user.tag, inline: true },
        { name: '\u200b', value: '\u200b', inline: true },
        { name: 'User', value: ban.discordUsername || ban.robloxUsername || 'Unknown', inline: false },
        { name: 'Original Reason', value: ban.reason, inline: false },
        { name: 'Unban Reason', value: reason, inline: false }
      )
      .setTimestamp();

    if (ban.discordId) {
      embed.addFields({ name: 'Discord ID', value: ban.discordId, inline: true });
    }

    if (ban.robloxId) {
      embed.addFields({ name: 'Roblox ID', value: ban.robloxId, inline: true });
    }

    await interaction.editReply({ embeds: [embed] });

    // Log to mod-log channel
    await logUnban(interaction.client, interaction.guildId!, {
      banId: ban.id,
      targetUsername: ban.discordUsername || ban.robloxUsername || 'Unknown',
      reason: reason,
      moderatorUsername: interaction.user.tag,
      moderatorDiscordId: interaction.user.id,
    });

    logger.info(`[Unban] ${interaction.user.tag} unbanned Ban ID #${ban.id}`);

  } catch (error) {
    logger.error('[Unban] Error executing unban command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while executing the unban.',
    });
  }
}
