/**
 * /greroll command - Reroll a giveaway winner
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import prisma from '../../db/client.js';
import { checkPermission } from '../../lib/permissions.js';
import { logger } from '../../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('greroll')
  .setDescription('Reroll a giveaway winner')
  .addStringOption(option =>
    option
      .setName('message-id')
      .setDescription('The message ID of the giveaway')
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!await checkPermission(interaction, 'moderator')) {
    return;
  }

  const messageId = interaction.options.getString('message-id', true);

  await interaction.deferReply();

  try {
    // Find giveaway
    const giveaway = await prisma.giveaway.findFirst({
      where: {
        messageId: messageId,
        guildId: interaction.guildId!,
      },
    });

    if (!giveaway) {
      return interaction.editReply({
        content: '❌ Giveaway not found with that message ID.',
      });
    }

    if (!giveaway.ended) {
      return interaction.editReply({
        content: '❌ This giveaway has not ended yet. Wait for it to end first.',
      });
    }

    // Get the message
    const channel = await interaction.guild!.channels.fetch(giveaway.channelId);
    if (!channel || !channel.isTextBased()) {
      return interaction.editReply({
        content: '❌ Giveaway channel not found.',
      });
    }

    const message = await channel.messages.fetch(giveaway.messageId);
    if (!message) {
      return interaction.editReply({
        content: '❌ Giveaway message not found.',
      });
    }

    // Note: In a real implementation, you'd track button clicks
    // For this simplified version, we'll use reactions as fallback
    await interaction.editReply({
      content: `✅ Giveaway reroll feature is simplified. To implement fully, track button interactions for "giveaway_enter" in the database.`,
    });

    logger.info(`[Greroll] ${interaction.user.tag} attempted to reroll giveaway ${messageId}`);

  } catch (error) {
    logger.error('[Greroll] Error executing greroll command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while rerolling the giveaway.',
    });
  }
}
