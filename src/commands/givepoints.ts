/**
 * /givepoints command - Give points to a user
 * NOW WITH: Cooldowns, anti-abuse, auto-promotions, and audit logging
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import prisma from '../db/client.js';
import { isOfficer } from '../lib/permissions.js';
import { logger } from '../lib/logger.js';
import { checkPointsAllowed, recordPointsGiven } from '../lib/antiAbuse.js';
import { checkAndHandlePromotion } from '../lib/autoPromotion.js';
import { logAudit } from '../lib/audit.js';

export const data = new SlashCommandBuilder()
  .setName('givepoints')
  .setDescription('Give points to a user')
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('User to give points to')
      .setRequired(true)
  )
  .addIntegerOption(option =>
    option
      .setName('amount')
      .setDescription('Amount of points to give')
      .setRequired(true)
      .setMinValue(1)
  )
  .addStringOption(option =>
    option
      .setName('reason')
      .setDescription('Reason for giving points')
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild || !interaction.member) {
    return interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
  }

  // Check permissions
  if (!(await isOfficer(interaction.member as any))) {
    return interaction.reply({ content: '❌ You do not have permission to give points.', ephemeral: true });
  }

  await interaction.deferReply();

  const targetUser = interaction.options.getUser('user', true);
  const amount = interaction.options.getInteger('amount', true);
  const reason = interaction.options.getString('reason', true);

  try {
    const user = await prisma.user.findUnique({
      where: { discordId: targetUser.id },
    });

    if (!user) {
      return interaction.editReply({
        content: `❌ ${targetUser.tag} is not verified.`,
      });
    }

    // Anti-abuse checks
    const cooldownCheck = await checkPointsAllowed(
      interaction.guildId!,
      interaction.user.id,
      targetUser.id,
      amount
    );

    if (!cooldownCheck.allowed) {
      return interaction.editReply({
        content: `❌ ${cooldownCheck.reason}`,
      });
    }

    // Store old points for promotion check
    const oldPoints = user.points;

    // Update user points
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { points: { increment: amount } },
    });

    // Create transaction record
    await prisma.pointTransaction.create({
      data: {
        userId: user.id,
        amount: amount,
        reason: reason,
        givenByDiscordId: interaction.user.id,
        givenByUsername: interaction.user.tag,
        type: 'add',
        source: 'discord',
      },
    });

    // Record for cooldown/daily limit tracking
    await recordPointsGiven(interaction.guildId!, interaction.user.id, targetUser.id, amount);

    const embed = new EmbedBuilder()
      .setTitle('✅ Points Given')
      .addFields(
        { name: 'User', value: `${targetUser.tag}`, inline: true },
        { name: 'Amount', value: `+${amount}`, inline: true },
        { name: 'New Total', value: updatedUser.points.toString(), inline: true },
        { name: 'Reason', value: reason, inline: false },
        { name: 'Given By', value: interaction.user.tag, inline: false }
      )
      .setColor(0x00ff00)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // Check thresholds
    await checkPointThresholds(interaction, user.id, updatedUser.points, targetUser.id);

    // Check for auto-promotion
    const promotionResult = await checkAndHandlePromotion(
      interaction.client,
      user.id,
      interaction.guildId!,
      updatedUser.points,
      oldPoints
    );

    if (promotionResult.promoted && promotionResult.rank) {
      await interaction.followUp({
        content: `🎉 **${targetUser.tag}** has been auto-promoted to **${promotionResult.rank.name}**!`,
      });
    } else if (promotionResult.requiresApproval) {
      await interaction.followUp({
        content: `📋 **${targetUser.tag}** is eligible for promotion! A request has been sent for approval.`,
        ephemeral: true,
      });
    }

    // Log to log channel
    await logPointTransaction(interaction, embed);

    // Audit log
    await logAudit(interaction.guildId!, 'points_given', interaction.user.id, targetUser.id, {
      amount,
      reason,
      newTotal: updatedUser.points,
      robloxUsername: user.robloxUsername,
    });

    logger.info(`${interaction.user.tag} gave ${amount} points to ${targetUser.tag}`);
  } catch (error) {
    logger.error('Error in /givepoints command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while giving points.',
    });
  }
}

async function checkPointThresholds(interaction: ChatInputCommandInteraction, userId: string, newPoints: number, targetDiscordId: string) {
  try {
    const thresholds = await prisma.pointThreshold.findMany({
      where: {
        guildId: interaction.guildId!,
        pointsRequired: { lte: newPoints },
      },
    });

    for (const threshold of thresholds) {
      // Check if they just crossed this threshold
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) continue;

      const oldPoints = user.points - newPoints;
      if (oldPoints < threshold.pointsRequired && newPoints >= threshold.pointsRequired) {
        // They just crossed this threshold, send notification
        try {
          const targetUser = await interaction.client.users.fetch(targetDiscordId);
          await targetUser.send(threshold.message);
        } catch (error) {
          logger.warn(`Failed to send threshold notification to user ${targetDiscordId}`);
        }
      }
    }
  } catch (error) {
    logger.error('Error checking point thresholds:', error);
  }
}

async function logPointTransaction(interaction: ChatInputCommandInteraction, embed: EmbedBuilder) {
  try {
    const config = await prisma.guildConfig.findUnique({
      where: { guildId: interaction.guildId! },
    });

    if (config?.logChannelId) {
      const logChannel = await interaction.guild?.channels.fetch(config.logChannelId);
      if (logChannel?.isTextBased()) {
        await logChannel.send({ embeds: [embed] });
      }
    }
  } catch (error) {
    logger.error('Error logging point transaction:', error);
  }
}
