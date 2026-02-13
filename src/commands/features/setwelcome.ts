/**
 * /setwelcome command - Configure welcome messages
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ChannelType } from 'discord.js';
import prisma from '../../db/client.js';
import { checkPermission } from '../../lib/permissions.js';
import { logger } from '../../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('setwelcome')
  .setDescription('Configure welcome messages for new members')
  .addChannelOption(option =>
    option
      .setName('channel')
      .setDescription('The channel to send welcome messages')
      .setRequired(true)
      .addChannelTypes(ChannelType.GuildText)
  )
  .addStringOption(option =>
    option
      .setName('message')
      .setDescription('Welcome message (use {user}, {username}, {server}, {membercount})')
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
        welcomeChannelId: channel.id,
        welcomeMessage: message,
      },
      create: {
        guildId: interaction.guildId!,
        welcomeChannelId: channel.id,
        welcomeMessage: message,
      },
    });

    // Show preview
    const previewMessage = message
      .replace(/{user}/g, `<@${interaction.user.id}>`)
      .replace(/{username}/g, interaction.user.username)
      .replace(/{server}/g, interaction.guild!.name)
      .replace(/{membercount}/g, interaction.guild!.memberCount.toString());

    const previewEmbed = new EmbedBuilder()
      .setTitle('👋 Welcome Message Preview')
      .setDescription(previewMessage)
      .setColor(0x57f287)
      .setFooter({ text: `Will be sent in #${channel.name}` })
      .setTimestamp();

    const confirmEmbed = new EmbedBuilder()
      .setTitle('✅ Welcome Message Configured')
      .setColor(0x57f287)
      .addFields(
        { name: 'Channel', value: `<#${channel.id}>`, inline: true },
        { name: 'Set By', value: interaction.user.tag, inline: true }
      )
      .setDescription('**Available Placeholders:**\n`{user}` - Mentions the user\n`{username}` - User\'s name\n`{server}` - Server name\n`{membercount}` - Total members')
      .setTimestamp();

    await interaction.editReply({ embeds: [confirmEmbed, previewEmbed] });

    logger.info(`[SetWelcome] ${interaction.user.tag} configured welcome message in ${interaction.guild!.name}`);

  } catch (error) {
    logger.error('[SetWelcome] Error executing setwelcome command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while configuring the welcome message.',
    });
  }
}
