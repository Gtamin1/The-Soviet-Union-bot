/**
 * /setmodlog command - Configure the moderation log channel
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ChannelType } from 'discord.js';
import prisma from '../../db/client.js';
import { checkPermission } from '../../lib/permissions.js';
import { logger } from '../../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('setmodlog')
  .setDescription('Set the moderation log channel')
  .addChannelOption(option =>
    option
      .setName('channel')
      .setDescription('The channel where moderation actions will be logged')
      .setRequired(true)
      .addChannelTypes(ChannelType.GuildText)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!await checkPermission(interaction, 'admin')) {
    return;
  }

  const channel = interaction.options.getChannel('channel', true);

  await interaction.deferReply();

  try {
    // Upsert ModerationConfig
    await prisma.moderationConfig.upsert({
      where: { id: interaction.guildId! },
      update: { modLogChannelId: channel.id },
      create: {
        id: interaction.guildId!,
        modLogChannelId: channel.id,
      },
    });

    const embed = new EmbedBuilder()
      .setTitle('✅ Moderation Log Channel Set')
      .setColor(0x57f287)
      .addFields(
        { name: 'Channel', value: `<#${channel.id}>`, inline: true },
        { name: 'Set By', value: interaction.user.tag, inline: true }
      )
      .setDescription('All moderation actions (bans, kicks, warnings, etc.) will be logged to this channel.')
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    logger.info(`[SetModLog] ${interaction.user.tag} set mod-log channel to #${channel.id} in ${interaction.guild!.name}`);

  } catch (error) {
    logger.error('[SetModLog] Error executing setmodlog command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while setting the moderation log channel.',
    });
  }
}
