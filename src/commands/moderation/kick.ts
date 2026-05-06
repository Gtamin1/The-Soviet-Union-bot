/**
 * /kick command - Kick a user from Discord AND Roblox game
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, GuildMember } from 'discord.js';
import prisma from '../../db/client.js';
import { checkPermission, canModerateUser } from '../../lib/permissions.js';
import { getRobloxUserByUsername } from '../../lib/roblox.js';
import { logKick } from '../../lib/modLogger.js';
import { logger } from '../../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('kick')
  .setDescription('Kick a user from Discord and Roblox game')
  .addStringOption(option =>
    option
      .setName('reason')
      .setDescription('Reason for the kick')
      .setRequired(true)
      .setMinLength(3)
      .setMaxLength(500)
  )
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('Discord user to kick')
      .setRequired(false)
  )
  .addStringOption(option =>
    option
      .setName('roblox')
      .setDescription('Roblox username to kick from game')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!await checkPermission(interaction, 'moderator')) {
    return;
  }

  const discordUser = interaction.options.getUser('user');
  const robloxUsername = interaction.options.getString('roblox');
  const reason = interaction.options.getString('reason', true);

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
        return interaction.editReply({
          content: `❌ ${discordUser.tag} is not in this server.`,
        });
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

      // If no Discord user provided, check if this Roblox user is verified
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

    // Try to DM before kicking
    if (targetDiscordId) {
      try {
        const targetUser = await interaction.client.users.fetch(targetDiscordId);
        const dmEmbed = new EmbedBuilder()
          .setTitle('👢 You have been kicked')
          .setColor(0xffa500)
          .addFields(
            { name: 'Server', value: interaction.guild!.name, inline: true },
            { name: 'Reason', value: reason, inline: false }
          )
          .setTimestamp();

        await targetUser.send({ embeds: [dmEmbed] });
      } catch {}
    }

    // Kick from Discord
    let kickedFromDiscord = false;
    if (targetMember) {
      try {
        await targetMember.kick(reason);
        kickedFromDiscord = true;
        logger.info(`[Kick] Kicked ${targetDiscordUsername} from Discord`);
      } catch (error: any) {
        logger.error(`[Kick] Failed to kick ${targetDiscordUsername} from Discord:`, error);
      }
    }

    // Queue kick from Roblox game
    let kickedFromRoblox = false;
    if (targetRobloxId) {
      try {
        await prisma.pendingKick.create({
          data: {
            robloxId: targetRobloxId,
            reason: reason,
          },
        });
        kickedFromRoblox = true;
        logger.info(`[Kick] Queued kick for Roblox user ${targetRobloxId}`);
      } catch (error) {
        logger.error(`[Kick] Failed to queue Roblox kick:`, error);
      }
    }

    // Create kick record
    await prisma.kick.create({
      data: {
        guildId: interaction.guildId!,
        discordId: targetDiscordId,
        robloxId: targetRobloxId,
        targetUsername: targetDiscordUsername || targetRobloxUsername || 'Unknown',
        reason: reason,
        kickedFromDiscord: kickedFromDiscord,
        kickedFromRoblox: kickedFromRoblox,
        moderatorDiscordId: interaction.user.id,
        moderatorUsername: interaction.user.tag,
      },
    });

    // Response embed
    const embed = new EmbedBuilder()
      .setTitle('👢 USER KICKED')
      .setColor(0xffa500)
      .addFields(
        { name: 'User', value: targetDiscordUsername || targetRobloxUsername || 'Unknown', inline: true },
        { name: 'Kicked By', value: interaction.user.tag, inline: true },
        { name: '\u200b', value: '\u200b', inline: true },
        { name: 'Reason', value: reason, inline: false }
      )
      .setTimestamp();

    if (targetDiscordId) {
      embed.addFields({ name: 'Discord ID', value: targetDiscordId, inline: true });
    }

    if (targetRobloxId) {
      embed.addFields({ name: 'Roblox ID', value: targetRobloxId, inline: true });
    }

    const statusLines: string[] = [];
    statusLines.push(`Discord: ${kickedFromDiscord ? '✅ Kicked' : '❌ Not in server'}`);
    statusLines.push(`Roblox Game: ${kickedFromRoblox ? '✅ Queued for kick' : '❌ Not available'}`);

    embed.addFields({ name: 'Status', value: statusLines.join('\n'), inline: false });

    await interaction.editReply({ embeds: [embed] });

    // Log
    await logKick(interaction.client, interaction.guildId!, {
      targetUsername: targetDiscordUsername || targetRobloxUsername || 'Unknown',
      targetDiscordId: targetDiscordId || undefined,
      targetRobloxId: targetRobloxId || undefined,
      reason: reason,
      moderatorUsername: interaction.user.tag,
      moderatorDiscordId: interaction.user.id,
      kickedFromDiscord: kickedFromDiscord,
      kickedFromRoblox: kickedFromRoblox,
    });

  } catch (error) {
    logger.error('[Kick] Error executing kick command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while executing the kick.',
    });
  }
}
