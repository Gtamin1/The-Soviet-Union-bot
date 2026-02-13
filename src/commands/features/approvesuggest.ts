/**
 * /approvesuggest command - Approve a suggestion
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import prisma from '../../db/client.js';
import { checkPermission } from '../../lib/permissions.js';
import { logger } from '../../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('approvesuggest')
  .setDescription('Approve a suggestion')
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
      .setDescription('Optional approval reason/comment')
      .setRequired(false)
      .setMaxLength(500)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!await checkPermission(interaction, 'moderator')) {
    return;
  }

  const id = interaction.options.getInteger('id', true);
  const reason = interaction.options.getString('reason');

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

    // Update embed to green (approved)
    const approvedEmbed = EmbedBuilder.from(message.embeds[0])
      .setColor(0x57f287)
      .setTitle('✅ Suggestion Approved')
      .addFields({
        name: 'Status',
        value: `Approved by ${interaction.user.tag}${reason ? `\n**Reason:** ${reason}` : ''}`,
        inline: false,
      });

    await message.edit({ embeds: [approvedEmbed] });

    // Update database
    await prisma.suggestion.update({
      where: { id: id },
      data: {
        status: 'approved',
        statusBy: interaction.user.tag,
        statusReason: reason,
      },
    });

    // Post in thread
    if (suggestion.threadId) {
      try {
        const thread = await channel.threads.fetch(suggestion.threadId);
        if (thread) {
          await thread.send(`✅ **This suggestion has been approved by ${interaction.user.tag}!**${reason ? `\n**Reason:** ${reason}` : ''}`);
        }
      } catch {}
    }

    await interaction.editReply({
      content: `✅ Suggestion #${id} has been approved!`,
    });

    logger.info(`[ApproveSuggest] ${interaction.user.tag} approved suggestion #${id} in ${interaction.guild!.name}`);

  } catch (error) {
    logger.error('[ApproveSuggest] Error executing approvesuggest command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while approving the suggestion.',
    });
  }
}
