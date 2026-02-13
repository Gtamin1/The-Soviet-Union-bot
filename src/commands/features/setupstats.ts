/**
 * /setupstats command - Create auto-updating stats channels
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';
import prisma from '../../db/client.js';
import { checkPermission } from '../../lib/permissions.js';
import { logger } from '../../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('setupstats')
  .setDescription('Create auto-updating server stats channels')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!await checkPermission(interaction, 'admin')) {
    return;
  }

  await interaction.deferReply();

  try {
    const guild = interaction.guild!;

    // Check if stats are already enabled
    const config = await prisma.guildConfig.findUnique({
      where: { guildId: guild.id },
    });

    if (config?.statsEnabled) {
      return interaction.editReply({
        content: '❌ Stats channels are already set up. Use `/removestats` first if you want to recreate them.',
      });
    }

    // Create category
    const category = await guild.channels.create({
      name: '📈 SERVER STATS',
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          allow: [PermissionFlagsBits.ViewChannel],
          deny: [PermissionFlagsBits.Connect],
        },
      ],
    });

    // Get initial counts
    const verifiedCount = await prisma.user.count();
    const totalPoints = await prisma.user.aggregate({
      _sum: { points: true },
    });
    const activeBans = await prisma.ban.count({
      where: {
        guildId: guild.id,
        active: true,
      },
    });

    // Create voice channels
    const membersChannel = await guild.channels.create({
      name: `👥 Members: ${guild.memberCount}`,
      type: ChannelType.GuildVoice,
      parent: category.id,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          allow: [PermissionFlagsBits.ViewChannel],
          deny: [PermissionFlagsBits.Connect],
        },
      ],
    });

    const verifiedChannel = await guild.channels.create({
      name: `✅ Verified: ${verifiedCount}`,
      type: ChannelType.GuildVoice,
      parent: category.id,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          allow: [PermissionFlagsBits.ViewChannel],
          deny: [PermissionFlagsBits.Connect],
        },
      ],
    });

    const inGameChannel = await guild.channels.create({
      name: `🎮 In-Game: 0`,
      type: ChannelType.GuildVoice,
      parent: category.id,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          allow: [PermissionFlagsBits.ViewChannel],
          deny: [PermissionFlagsBits.Connect],
        },
      ],
    });

    const pointsChannel = await guild.channels.create({
      name: `⭐ Total Points: ${totalPoints._sum.points || 0}`,
      type: ChannelType.GuildVoice,
      parent: category.id,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          allow: [PermissionFlagsBits.ViewChannel],
          deny: [PermissionFlagsBits.Connect],
        },
      ],
    });

    const bansChannel = await guild.channels.create({
      name: `🔨 Active Bans: ${activeBans}`,
      type: ChannelType.GuildVoice,
      parent: category.id,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          allow: [PermissionFlagsBits.ViewChannel],
          deny: [PermissionFlagsBits.Connect],
        },
      ],
    });

    // Save to database
    await prisma.guildConfig.upsert({
      where: { guildId: guild.id },
      update: {
        statsEnabled: true,
        statsCategory: category.id,
        statsMembersChannel: membersChannel.id,
        statsVerifiedChannel: verifiedChannel.id,
        statsInGameChannel: inGameChannel.id,
        statsPointsChannel: pointsChannel.id,
        statsBansChannel: bansChannel.id,
      },
      create: {
        guildId: guild.id,
        statsEnabled: true,
        statsCategory: category.id,
        statsMembersChannel: membersChannel.id,
        statsVerifiedChannel: verifiedChannel.id,
        statsInGameChannel: inGameChannel.id,
        statsPointsChannel: pointsChannel.id,
        statsBansChannel: bansChannel.id,
      },
    });

    const embed = new EmbedBuilder()
      .setTitle('✅ Stats Channels Created')
      .setColor(0x57f287)
      .setDescription('Auto-updating stats channels have been created successfully!')
      .addFields(
        { name: 'Category', value: category.name, inline: false },
        { name: 'Update Interval', value: 'Every 5 minutes', inline: true },
        { name: 'Channels Created', value: '5 stats channels', inline: true }
      )
      .setFooter({ text: 'Use /removestats to delete these channels' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    logger.info(`[SetupStats] ${interaction.user.tag} created stats channels in ${guild.name}`);

  } catch (error) {
    logger.error('[SetupStats] Error executing setupstats command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while creating stats channels. Make sure the bot has the "Manage Channels" permission.',
    });
  }
}
