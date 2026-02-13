/**
 * /setgoodbye command - Configure goodbye messages
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ChannelType } from 'discord.js';
import prisma from '../../db/client.js';
import { checkPermission } from '../../lib/permissions.js';
import { logger } from '../../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('setgoodbye')
  .setDescription('Configure goodbye messages for members who leave')
  .addChannelOption(option =>
    option
      .setName('channel')
      .setDescription('The channel to send goodbye messages')
      .setRequired(true)
      .addChannelTypes(ChannelType.GuildText)
  )
  .addStringOption(option =>
    option
      .setName('message')
      .setDescription('Goodbye message (use {username}, {server}, {membercount})')
      .setRequired(true)
      .setMaxLength(1000)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!await checkPermission(interaction, 'admin')) {
    return;
  }

  const channel = interaction.options.getChannel('channel', true);
  const message = interaction.options.getString('message', true);

  await interaction.deferReply();

  try {
    // Update config
    await prisma.guildConfig.upsert({
      where: { guildId: interaction.guildId! },
      update: {
        goodbyeChannelId: channel.id,
        goodbyeMessage: message,
      },
      create: {
        guildId: interaction.guildId!,
        goodbyeChannelId: channel.id,
        goodbyeMessage: message,
      },
    });

    // Show preview
    const previewMessage = message
      .replace(/{username}/g, interaction.user.username)
      .replace(/{server}/g, interaction.guild!.name)
      .replace(/{membercount}/g, interaction.guild!.memberCount.toString());

    const previewEmbed = new EmbedBuilder()
      .setTitle('👋 Goodbye Message Preview')
      .setDescription(previewMessage)
      .setColor(0xffa500)
      .setFooter({ text: `Will be sent in #${channel.name}` })
      .setTimestamp();

    const confirmEmbed = new EmbedBuilder()
      .setTitle('✅ Goodbye Message Configured')
      .setColor(0x57f287)
      .addFields(
        { name: 'Channel', value: `<#${channel.id}>`, inline: true },
        { name: 'Set By', value: interaction.user.tag, inline: true }
      )
      .setDescription('**Available Placeholders:**\n`{username}` - User\'s name\n`{server}` - Server name\n`{membercount}` - Total members')
      .setTimestamp();

    await interaction.editReply({ embeds: [confirmEmbed, previewEmbed] });

    logger.info(`[SetGoodbye] ${interaction.user.tag} configured goodbye message in ${interaction.guild!.name}`);

  } catch (error) {
    logger.error('[SetGoodbye] Error executing setgoodbye command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while configuring the goodbye message.',
    });
  }
}
