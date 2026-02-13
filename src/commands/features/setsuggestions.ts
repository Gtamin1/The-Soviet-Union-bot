/**
 * /setsuggestions command - Configure suggestions channel
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ChannelType } from 'discord.js';
import prisma from '../../db/client.js';
import { checkPermission } from '../../lib/permissions.js';
import { logger } from '../../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('setsuggestions')
  .setDescription('Set the suggestions channel')
  .addChannelOption(option =>
    option
      .setName('channel')
      .setDescription('The channel for suggestions')
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
    // Update config
    await prisma.guildConfig.upsert({
      where: { guildId: interaction.guildId! },
      update: { suggestionsChannelId: channel.id },
      create: {
        guildId: interaction.guildId!,
        suggestionsChannelId: channel.id,
      },
    });

    const embed = new EmbedBuilder()
      .setTitle('✅ Suggestions Channel Configured')
      .setColor(0x57f287)
      .addFields(
        { name: 'Channel', value: `<#${channel.id}>`, inline: true },
        { name: 'Set By', value: interaction.user.tag, inline: true }
      )
      .setDescription('Users can now submit suggestions with `/suggest`.')
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    logger.info(`[SetSuggestions] ${interaction.user.tag} set suggestions channel to #${channel.id} in ${interaction.guild!.name}`);

  } catch (error) {
    logger.error('[SetSuggestions] Error executing setsuggestions command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while setting the suggestions channel.',
    });
  }
}
