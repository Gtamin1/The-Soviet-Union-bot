/**
 * /embed command - Create custom embeds via modal
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } from 'discord.js';
import { checkPermission } from '../../lib/permissions.js';
import { logger } from '../../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('embed')
  .setDescription('Create a custom embed message');

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!await checkPermission(interaction, 'moderator')) {
    return;
  }

  // Create modal
  const modal = new ModalBuilder()
    .setCustomId(`embed_modal_${interaction.user.id}`)
    .setTitle('Create Custom Embed');

  const titleInput = new TextInputBuilder()
    .setCustomId('embed_title')
    .setLabel('Title')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(256);

  const descriptionInput = new TextInputBuilder()
    .setCustomId('embed_description')
    .setLabel('Description')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(4000);

  const colorInput = new TextInputBuilder()
    .setCustomId('embed_color')
    .setLabel('Color (hex code, e.g., #5865f2)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(7);

  const imageInput = new TextInputBuilder()
    .setCustomId('embed_image')
    .setLabel('Image URL (optional)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false);

  const footerInput = new TextInputBuilder()
    .setCustomId('embed_footer')
    .setLabel('Footer Text (optional)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(2048);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(colorInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(imageInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(footerInput)
  );

  await interaction.showModal(modal);

  // Wait for modal submission
  try {
    const submitted = await interaction.awaitModalSubmit({
      filter: (i) => i.customId === `embed_modal_${interaction.user.id}`,
      time: 300_000, // 5 minutes
    });

    const title = submitted.fields.getTextInputValue('embed_title') || null;
    const description = submitted.fields.getTextInputValue('embed_description');
    const colorStr = submitted.fields.getTextInputValue('embed_color') || '#5865f2';
    const imageUrl = submitted.fields.getTextInputValue('embed_image') || null;
    const footer = submitted.fields.getTextInputValue('embed_footer') || null;

    // Parse color
    let color = 0x5865f2;
    if (colorStr) {
      const hexMatch = colorStr.match(/^#?([0-9A-Fa-f]{6})$/);
      if (hexMatch) {
        color = parseInt(hexMatch[1], 16);
      }
    }

    // Build embed
    const embed = new EmbedBuilder()
      .setDescription(description)
      .setColor(color)
      .setTimestamp();

    if (title) embed.setTitle(title);
    if (imageUrl) embed.setImage(imageUrl);
    if (footer) embed.setFooter({ text: footer });

    // Send embed to channel
    await interaction.channel!.send({ embeds: [embed] });

    await submitted.reply({
      content: '✅ Embed sent successfully!',
      ephemeral: true,
    });

    logger.info(`[Embed] ${interaction.user.tag} created a custom embed in ${interaction.guild!.name}`);

  } catch (error: any) {
    if (error.code === 'InteractionCollectorError') {
      // Modal timed out - do nothing
      logger.info(`[Embed] Modal timed out for ${interaction.user.tag}`);
    } else {
      logger.error('[Embed] Error in embed command:', error);
    }
  }
}
