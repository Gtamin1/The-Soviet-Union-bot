/**
 * /promote - Manually promote a user based on their points
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import prisma from '../db/client.js';
import { isAdmin } from '../lib/permissions.js';
import { setUserRank, getRoleByRank } from '../lib/ranking.js';
import { getUserRankInGroup } from '../lib/roblox.js';
import { logAudit } from '../lib/audit.js';
import { logger } from '../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('promote')
  .setDescription('Manually promote a user to their eligible rank')
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('User to promote')
      .setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild || !interaction.member) {
    return interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
  }

  // Check permissions
  if (!(await isAdmin(interaction.member as any))) {
    return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
  }

  await interaction.deferReply();

  const targetUser = interaction.options.getUser('user', true);

  try {
    // Get user data
    const user = await prisma.user.findUnique({
      where: { discordId: targetUser.id },
    });

    if (!user) {
      return interaction.editReply({
        content: `❌ ${targetUser.tag} is not verified.`,
      });
    }

    // Get guild config
    const config = await prisma.guildConfig.findUnique({
      where: { guildId: interaction.guild.id },
      include: {
        promotionRanks: true,
        protectedRanks: true,
      },
    });

    if (!config || !config.primaryGroupId) {
      return interaction.editReply({
        content: '❌ No primary group configured. Use `/setprimarygroup` first.',
      });
    }

    if (!config.robloxCookie) {
      return interaction.editReply({
        content: '❌ No Roblox cookie set. Use `/setroblosecurity` first.',
      });
    }

    // Get user's current rank
    const currentRankInfo = await getUserRankInGroup(user.robloxId, config.primaryGroupId);
    if (!currentRankInfo) {
      return interaction.editReply({
        content: `❌ ${user.robloxUsername} is not in the primary group.`,
      });
    }

    // Check if current rank is protected
    const isProtected = config.protectedRanks.some(pr => pr.rankId === currentRankInfo.rank);
    if (isProtected) {
      return interaction.editReply({
        content: `❌ ${user.robloxUsername}'s current rank (${currentRankInfo.rank}) is protected.`,
      });
    }

    // Find highest eligible promotion
    const eligiblePromotions = config.promotionRanks
      .filter(pr => pr.pointsRequired <= user.points && pr.robloxRankId > currentRankInfo.rank)
      .sort((a, b) => b.pointsRequired - a.pointsRequired);

    if (eligiblePromotions.length === 0) {
      return interaction.editReply({
        content: `❌ ${user.robloxUsername} doesn't have enough points for any promotions.\n\n` +
                 `**Current Points:** ${user.points}\n` +
                 `**Current Rank:** ${currentRankInfo.rank} - ${currentRankInfo.roleName}`,
      });
    }

    const targetPromotion = eligiblePromotions[0];

    // Check if target rank is protected
    const targetProtected = config.protectedRanks.some(pr => pr.rankId === targetPromotion.robloxRankId);
    if (targetProtected) {
      return interaction.editReply({
        content: `❌ Target rank ${targetPromotion.robloxRankId} is protected.`,
      });
    }

    // Get role info
    const role = await getRoleByRank(config.primaryGroupId, targetPromotion.robloxRankId);
    if (!role) {
      return interaction.editReply({
        content: `❌ Target rank ${targetPromotion.robloxRankId} not found in group.`,
      });
    }

    // Perform promotion
    const result = await setUserRank(
      config.primaryGroupId,
      user.robloxId,
      role.id,
      config.robloxCookie
    );

    if (!result.success) {
      return interaction.editReply({
        content: `❌ Failed to promote ${user.robloxUsername}: ${result.error}`,
      });
    }

    // Record promotion history
    await prisma.promotionHistory.create({
      data: {
        userId: user.id,
        guildId: interaction.guild.id,
        fromRank: currentRankInfo.rank,
        toRank: targetPromotion.robloxRankId,
        rankName: targetPromotion.rankName,
        reason: `Manually promoted by ${interaction.user.tag}`,
        promotedBy: interaction.user.id,
      },
    });

    // Audit log
    await logAudit(interaction.guild.id, 'manual_promotion', interaction.user.id, targetUser.id, {
      from: currentRankInfo.rank,
      to: targetPromotion.robloxRankId,
      rankName: targetPromotion.rankName,
      points: user.points,
      robloxUsername: user.robloxUsername,
    });

    const embed = new EmbedBuilder()
      .setTitle('✅ User Promoted')
      .addFields(
        { name: 'User', value: `${targetUser.tag} (${user.robloxUsername})`, inline: false },
        { name: 'Previous Rank', value: `${currentRankInfo.rank} - ${currentRankInfo.roleName}`, inline: true },
        { name: 'New Rank', value: `${targetPromotion.robloxRankId} - ${targetPromotion.rankName}`, inline: true },
        { name: 'Points', value: user.points.toString(), inline: true }
      )
      .setColor(0x00ff00)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // Log to log channel
    if (config.logChannelId) {
      const logChannel = await interaction.guild.channels.fetch(config.logChannelId);
      if (logChannel?.isTextBased()) {
        await logChannel.send({ embeds: [embed] });
      }
    }

    // DM the user
    try {
      await targetUser.send(
        `🎉 You've been manually promoted to **${targetPromotion.rankName}** by ${interaction.user.tag}!`
      );
    } catch {}

    logger.info(`${interaction.user.tag} manually promoted ${user.robloxUsername} to rank ${targetPromotion.robloxRankId}`);
  } catch (error) {
    logger.error('Error in /promote command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while promoting the user.',
    });
  }
}
