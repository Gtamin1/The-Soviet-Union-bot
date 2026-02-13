/**
 * /suggest command - Submit a suggestion
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import prisma from '../../db/client.js';
import { logger } from '../../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('suggest')
  .setDescription('Submit a suggestion')
  .addStringOption(option =>
    option
      .setName('content')
      .setDescription('Your suggestion')
      .setRequired(true)
      .setMinLength(10)
      .setMaxLength(1000)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const content = interaction.options.getString('content', true);

  await interaction.deferReply({ ephemeral: true });

  try {
    // Get config
    const config = await prisma.guildConfig.findUnique({
      where: { guildId: interaction.guildId! },
    });

    if (!config?.suggestionsChannelId) {
      return interaction.editReply({
        content: '❌ Suggestions are not configured. Ask an admin to set up suggestions with `/setsuggestions`.',
      });
    }

    // Get suggestions channel
    const channel = await interaction.guild!.channels.fetch(config.suggestionsChannelId);
    if (!channel || !channel.isTextBased()) {
      return interaction.editReply({
        content: '❌ Suggestions channel not found or is not a text channel.',
      });
    }

    // Create embed
    const embed = new EmbedBuilder()
      .setTitle('💡 New Suggestion')
      .setDescription(content)
      .setColor(0xffff00)
      .setAuthor({
        name: interaction.user.tag,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setFooter({ text: `Suggestion from ${interaction.user.id}` })
      .setTimestamp();

    // Send to suggestions channel
    const message = await channel.send({ embeds: [embed] });

    // Add reactions
    await message.react('✅');
    await message.react('❌');

    // Create thread
    const thread = await message.startThread({
      name: `Suggestion by ${interaction.user.username}`,
      autoArchiveDuration: 10080, // 7 days
    });

    await thread.send('💬 Discuss this suggestion here!');

    // Save to database
    const suggestion = await prisma.suggestion.create({
      data: {
        guildId: interaction.guildId!,
        authorDiscordId: interaction.user.id,
        authorUsername: interaction.user.tag,
        content: content,
        status: 'pending',
        messageId: message.id,
        threadId: thread.id,
      },
    });

    await interaction.editReply({
      content: `✅ Your suggestion has been submitted! [View it here](${message.url})\n\n**Suggestion ID:** ${suggestion.id}`,
    });

    logger.info(`[Suggest] ${interaction.user.tag} submitted suggestion #${suggestion.id} in ${interaction.guild!.name}`);

  } catch (error) {
    logger.error('[Suggest] Error executing suggest command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while submitting your suggestion.',
    });
  }
}
