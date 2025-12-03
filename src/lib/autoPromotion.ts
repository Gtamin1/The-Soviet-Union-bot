/**
 * Auto-promotion logic
 * Handles automatic promotions when users reach point thresholds
 */

import { Client, EmbedBuilder, TextChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import prisma from '../db/client.js';
import { setUserRank, getRoleByRank } from './ranking.js';
import { getUserRankInGroup } from './roblox.js';
import { logger } from '../lib/logger.js';
import { logAudit } from './audit.js';

interface PromotionCheckResult {
  promoted: boolean;
  rank?: { from: number; to: number; name: string };
  error?: string;
  requiresApproval?: boolean;
}

/**
 * Check if a user should be promoted based on their new point total
 * This is called after points are awarded
 */
export async function checkAndHandlePromotion(
  client: Client,
  userId: string,
  guildId: string,
  newPoints: number,
  oldPoints: number
): Promise<PromotionCheckResult> {
  try {
    logger.info(`[Auto-Promotion] Checking promotion for user ${userId} with ${newPoints} points (old: ${oldPoints})`);

    // Get user data
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      logger.warn(`[Auto-Promotion] User ${userId} not found in database`);
      return { promoted: false, error: 'User not found' };
    }

    logger.info(`[Auto-Promotion] User: ${user.robloxUsername} (Roblox ID: ${user.robloxId})`);

    // Get guild config
    const config = await prisma.guildConfig.findUnique({
      where: { guildId },
      include: {
        promotionRanks: true,
        protectedRanks: true,
      },
    });

    if (!config || !config.primaryGroupId) {
      logger.warn(`[Auto-Promotion] No primary group configured for guild ${guildId}`);
      return { promoted: false, error: 'No primary group configured' };
    }

    if (!config.robloxCookie) {
      logger.warn(`[Auto-Promotion] No Roblox cookie configured for guild ${guildId}`);
      return { promoted: false, error: 'No Roblox cookie configured' };
    }

    // Get user's current rank in the group
    const currentRankInfo = await getUserRankInGroup(user.robloxId, config.primaryGroupId);
    if (!currentRankInfo) {
      logger.warn(`[Auto-Promotion] User ${user.robloxUsername} not found in primary group ${config.primaryGroupId}`);
      return { promoted: false, error: 'User not in primary group' };
    }

    logger.info(`[Auto-Promotion] Current rank: ${currentRankInfo.rank} (${currentRankInfo.roleName})`);

    // Check if current rank is protected
    const isProtected = config.protectedRanks.some(pr => pr.rankId === currentRankInfo.rank);
    if (isProtected) {
      logger.info(`[Auto-Promotion] Current rank ${currentRankInfo.rank} is protected, skipping promotion`);
      return { promoted: false, error: 'Current rank is protected' };
    }

    // Find all promotion ranks they're eligible for based on points AND that are higher than current rank
    // FIXED: Removed the "pointsRequired > oldPoints" condition that was causing promotions to be skipped
    const eligiblePromotions = config.promotionRanks
      .filter(pr => {
        const meetsPoints = pr.pointsRequired <= newPoints;
        const higherRank = pr.robloxRankId > currentRankInfo.rank;

        logger.info(`[Auto-Promotion] Checking rank ${pr.robloxRankId} (${pr.rankName}): ` +
          `requires ${pr.pointsRequired} pts, user has ${newPoints} pts, ` +
          `meetsPoints=${meetsPoints}, higherRank=${higherRank} (current: ${currentRankInfo.rank})`);

        return meetsPoints && higherRank;
      })
      .sort((a, b) => b.pointsRequired - a.pointsRequired); // Highest first

    logger.info(`[Auto-Promotion] Found ${eligiblePromotions.length} eligible promotions`);

    if (eligiblePromotions.length === 0) {
      logger.info(`[Auto-Promotion] No eligible promotions for ${user.robloxUsername}`);
      return { promoted: false };
    }

    // Get the highest rank they're eligible for
    const targetPromotion = eligiblePromotions[0];

    logger.info(`[Auto-Promotion] Target promotion: Rank ${targetPromotion.robloxRankId} (${targetPromotion.rankName}) - requires ${targetPromotion.pointsRequired} pts`);

    // Check if target rank is protected
    const targetProtected = config.protectedRanks.some(pr => pr.rankId === targetPromotion.robloxRankId);
    if (targetProtected) {
      logger.info(`[Auto-Promotion] Target rank ${targetPromotion.robloxRankId} is protected, cannot promote`);
      return { promoted: false, error: 'Target rank is protected' };
    }

    // Check if target rank is lower or equal to current rank (shouldn't promote backwards)
    // This should never happen due to the filter above, but keep as safety check
    if (targetPromotion.robloxRankId <= currentRankInfo.rank) {
      logger.warn(`[Auto-Promotion] User ${user.robloxUsername} has ${newPoints} points but target rank ${targetPromotion.robloxRankId} is <= current rank ${currentRankInfo.rank}`);
      return { promoted: false, error: 'Target rank is not higher than current rank' };
    }

    // Check promotion mode
    if (config.promotionMode === 'request') {
      logger.info(`[Auto-Promotion] Promotion mode is 'request', sending approval request for ${user.robloxUsername}`);
      // Send promotion request for approval
      await sendPromotionRequest(client, config, user, currentRankInfo.rank, targetPromotion);
      return {
        promoted: false,
        requiresApproval: true,
      };
    }

    // Auto mode - promote directly
    logger.info(`[Auto-Promotion] Promotion mode is 'auto', proceeding with promotion`);

    const role = await getRoleByRank(config.primaryGroupId, targetPromotion.robloxRankId);
    if (!role) {
      logger.error(`[Auto-Promotion] Target rank ${targetPromotion.robloxRankId} not found in group ${config.primaryGroupId}`);
      return { promoted: false, error: 'Target rank not found in group' };
    }

    logger.info(`[Auto-Promotion] Promoting ${user.robloxUsername} from rank ${currentRankInfo.rank} to rank ${targetPromotion.robloxRankId} (${targetPromotion.rankName})`);

    // Perform the promotion
    const result = await setUserRank(
      config.primaryGroupId,
      user.robloxId,
      role.id,
      config.robloxCookie
    );

    if (!result.success) {
      logger.error(`[Auto-Promotion] Failed to promote ${user.robloxUsername}: ${result.error}`);
      return { promoted: false, error: result.error };
    }

    logger.info(`[Auto-Promotion] ✓ Successfully promoted ${user.robloxUsername} to ${targetPromotion.rankName}!`);


    // Record promotion history
    await prisma.promotionHistory.create({
      data: {
        userId: user.id,
        guildId: guildId,
        fromRank: currentRankInfo.rank,
        toRank: targetPromotion.robloxRankId,
        rankName: targetPromotion.rankName,
        reason: `Auto-promoted for reaching ${targetPromotion.pointsRequired} points`,
        promotedBy: null, // Auto-promotion
      },
    });

    // Log audit
    await logAudit(guildId, 'auto_promotion', 'SYSTEM', user.discordId, {
      from: currentRankInfo.rank,
      to: targetPromotion.robloxRankId,
      rankName: targetPromotion.rankName,
      points: newPoints,
      robloxUsername: user.robloxUsername,
    });

    // Send notifications
    await sendPromotionNotification(client, config, user, currentRankInfo.rank, targetPromotion);

    logger.info(`Auto-promoted ${user.robloxUsername} from rank ${currentRankInfo.rank} to ${targetPromotion.robloxRankId} (${targetPromotion.rankName})`);

    return {
      promoted: true,
      rank: {
        from: currentRankInfo.rank,
        to: targetPromotion.robloxRankId,
        name: targetPromotion.rankName,
      },
    };
  } catch (error: any) {
    logger.error('Error in checkAndHandlePromotion:', error);
    return { promoted: false, error: error.message };
  }
}

/**
 * Send promotion notification to user and log channel
 */
async function sendPromotionNotification(
  client: Client,
  config: any,
  user: any,
  fromRank: number,
  promotion: any
) {
  try {
    // DM the user
    const discordUser = await client.users.fetch(user.discordId);
    const dmEmbed = new EmbedBuilder()
      .setTitle('🎉 Congratulations! You\'ve been promoted!')
      .setDescription(
        `You've been promoted in the Roblox group!\n\n` +
        `**Previous Rank:** ${fromRank}\n` +
        `**New Rank:** ${promotion.robloxRankId} - ${promotion.rankName}\n` +
        `**Points:** ${user.points}\n\n` +
        `Keep up the great work!`
      )
      .setColor(0xffd700)
      .setTimestamp();

    await discordUser.send({ embeds: [dmEmbed] }).catch(() => {
      logger.warn(`Could not DM ${discordUser.tag} about promotion`);
    });

    // Log to log channel
    if (config.logChannelId) {
      const guild = await client.guilds.fetch(config.guildId);
      const logChannel = await guild.channels.fetch(config.logChannelId) as TextChannel;

      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setTitle('🎖️ Auto-Promotion')
          .addFields(
            { name: 'User', value: `<@${user.discordId}>`, inline: true },
            { name: 'Roblox', value: user.robloxUsername, inline: true },
            { name: 'Points', value: user.points.toString(), inline: true },
            { name: 'From Rank', value: fromRank.toString(), inline: true },
            { name: 'To Rank', value: `${promotion.robloxRankId} - ${promotion.rankName}`, inline: true }
          )
          .setColor(0xffd700)
          .setTimestamp();

        await logChannel.send({ embeds: [logEmbed] });
      }
    }
  } catch (error) {
    logger.error('Error sending promotion notification:', error);
  }
}

/**
 * Send promotion request for approval
 */
async function sendPromotionRequest(
  client: Client,
  config: any,
  user: any,
  fromRank: number,
  promotion: any
) {
  try {
    if (!config.promotionsChannelId) {
      logger.warn('Promotion request mode enabled but no promotions channel set');
      return;
    }

    const guild = await client.guilds.fetch(config.guildId);
    const promotionsChannel = await guild.channels.fetch(config.promotionsChannelId) as TextChannel;

    if (!promotionsChannel) {
      logger.warn('Promotions channel not found');
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('📋 Promotion Request')
      .setDescription(
        `${user.robloxUsername} has reached the required points for promotion!`
      )
      .addFields(
        { name: 'Discord User', value: `<@${user.discordId}>`, inline: true },
        { name: 'Roblox User', value: user.robloxUsername, inline: true },
        { name: 'Points', value: user.points.toString(), inline: true },
        { name: 'Current Rank', value: fromRank.toString(), inline: true },
        { name: 'Target Rank', value: `${promotion.robloxRankId} - ${promotion.rankName}`, inline: true },
        { name: 'Points Required', value: promotion.pointsRequired.toString(), inline: true }
      )
      .setColor(0x0099ff)
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`approve_promotion_${user.id}_${promotion.id}`)
          .setLabel('Approve')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅'),
        new ButtonBuilder()
          .setCustomId(`deny_promotion_${user.id}_${promotion.id}`)
          .setLabel('Deny')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('❌')
      );

    await promotionsChannel.send({ embeds: [embed], components: [row] });

    // DM the user that their promotion is pending
    const discordUser = await client.users.fetch(user.discordId);
    await discordUser.send(
      `🎉 Congratulations! You've reached ${promotion.pointsRequired} points and are eligible for promotion to **${promotion.rankName}**!\n\n` +
      `Your promotion is pending approval. You'll be notified once it's been reviewed.`
    ).catch(() => {});

  } catch (error) {
    logger.error('Error sending promotion request:', error);
  }
}
