/**
 * /denysuggest command - Deny a suggestion
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import prisma from '../../db/client.js';
import { checkPermission } from '../../lib/permissions.js';
import { logger } from '../../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('denysuggest')
  .setDescription('Deny a suggestion')
  .addIntegerOption(option =>
    option
      .setName('id')
      .setDescription('The suggestion ID')
      .setRequired(true)
      .setMinValue(1)
  )
  .addStringOption(option =>
    option
      .setName('reason')
      .setDescription('Reason for denial')
      .setRequired(true)
      .setMinLength(3)
      .setMaxLength(500)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!await checkPermission(interaction, 'moderator')) {
    return;
  }

  const id = interaction.options.getInteger('id', true);
  const reason = interaction.options.getString('reason', true);

  await interaction.deferReply();

  try {
    // Find suggestion
    const suggestion = await prisma.suggestion.findFirst({
      where: {
        id: id,
        guildId: interaction.guildId!,
      },
    });

    if (!suggestion) {
      return interaction.editReply({
        content: `❌ Suggestion #${id} not found in this server.`,
      });
    }

    if (suggestion.status !== 'pending') {
      return interaction.editReply({
        content: `❌ Suggestion #${id} has already been ${suggestion.status}.`,
      });
    }

    // Get config
    const config = await prisma.guildConfig.findUnique({
      where: { guildId: interaction.guildId! },
    });

    if (!config?.suggestionsChannelId) {
      return interaction.editReply({
        content: '❌ Suggestions channel not configured.',
      });
    }

    // Get the original message
    const channel = await interaction.guild!.channels.fetch(config.suggestionsChannelId);
    if (!channel || !channel.isTextBased()) {
      return interaction.editReply({
        content: '❌ Suggestions channel not found.',
      });
    }

    if (!suggestion.messageId) {
      return interaction.editReply({
        content: '❌ Original suggestion message not found.',
      });
    }

    const message = await channel.messages.fetch(suggestion.messageId);

    // Update embed to red (denied)
    const deniedEmbed = EmbedBuilder.from(message.embeds[0])
      .setColor(0xed4245)
      .setTitle('❌ Suggestion Denied')
      .addFields({
        name: 'Status',
        value: `Denied by ${interaction.user.tag}\n**Reason:** ${reason}`,
        inline: false,
      });

    await message.edit({ embeds: [deniedEmbed] });

    // Update database
    await prisma.suggestion.update({
      where: { id: id },
      data: {
        status: 'denied',
        statusBy: interaction.user.tag,
        statusReason: reason,
      },
    });

    // Post in thread
    if (suggestion.threadId) {
      try {
        const thread = await channel.threads.fetch(suggestion.threadId);
        if (thread) {
          await thread.send(`❌ **This suggestion has been denied by ${interaction.user.tag}.**\n**Reason:** ${reason}`);
          await thread.setArchived(true);
        }
      } catch {}
    }

    await interaction.editReply({
      content: `✅ Suggestion #${id} has been denied.`,
    });

    logger.info(`[DenySuggest] ${interaction.user.tag} denied suggestion #${id} in ${interaction.guild!.name}`);

  } catch (error) {
    logger.error('[DenySuggest] Error executing denysuggest command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while denying the suggestion.',
    });
  }
}
