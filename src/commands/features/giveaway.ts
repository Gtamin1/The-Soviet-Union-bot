/**
 * /giveaway command - Start a giveaway
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } from 'discord.js';
import prisma from '../../db/client.js';
import { checkPermission } from '../../lib/permissions.js';
import { logger } from '../../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('giveaway')
  .setDescription('Start a giveaway')
  .addStringOption(option =>
    option
      .setName('duration')
      .setDescription('Duration (e.g., 1h, 12h, 1d, 7d)')
      .setRequired(true)
      .addChoices(
        { name: '1 hour', value: '1h' },
        { name: '12 hours', value: '12h' },
        { name: '1 day', value: '1d' },
        { name: '3 days', value: '3d' },
        { name: '7 days', value: '7d' }
      )
  )
  .addStringOption(option =>
    option
      .setName('prize')
      .setDescription('What are you giving away?')
      .setRequired(true)
      .setMaxLength(256)
  )
  .addIntegerOption(option =>
    option
      .setName('winners')
      .setDescription('Number of winners (default: 1)')
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(20)
  )
  .addChannelOption(option =>
    option
      .setName('channel')
      .setDescription('Channel to post giveaway (default: current)')
      .setRequired(false)
      .addChannelTypes(ChannelType.GuildText)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!await checkPermission(interaction, 'moderator')) {
    return;
  }

  const durationStr = interaction.options.getString('duration', true);
  const prize = interaction.options.getString('prize', true);
  const winners = interaction.options.getInteger('winners') || 1;
  const targetChannel = interaction.options.getChannel('channel') || interaction.channel!;

  await interaction.deferReply({ ephemeral: true });

  try {
    // Parse duration
    const durationSeconds = parseDuration(durationStr);
    if (!durationSeconds) {
      return interaction.editReply({ content: '❌ Invalid duration format.' });
    }

    const endsAt = new Date(Date.now() + durationSeconds * 1000);

    // Create embed
    const embed = new EmbedBuilder()
      .setTitle('🎉 GIVEAWAY')
      .setDescription(`**Prize:** ${prize}\n\n**Winners:** ${winners}\n**Ends:** <t:${Math.floor(endsAt.getTime() / 1000)}:R>\n\nClick the button below to enter!`)
      .setColor(0xf1c40f)
      .setFooter({ text: `Hosted by ${interaction.user.tag}` })
      .setTimestamp();

    const button = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('giveaway_enter')
          .setLabel('🎉 Enter Giveaway')
          .setStyle(ButtonStyle.Success)
      );

    // Send message
    const channel = await interaction.guild!.channels.fetch(targetChannel.id);
    if (!channel || !channel.isTextBased()) {
      return interaction.editReply({ content: '❌ Invalid channel.' });
    }

    const message = await channel.send({
      embeds: [embed],
      components: [button],
    });

    // Save to database
    await prisma.giveaway.create({
      data: {
        guildId: interaction.guildId!,
        channelId: channel.id,
        messageId: message.id,
        prize: prize,
        winnersCount: winners,
        hostDiscordId: interaction.user.id,
        endsAt: endsAt,
        ended: false,
        winners: [],
      },
    });

    await interaction.editReply({
      content: `✅ Giveaway started! [View it here](${message.url})`,
    });

    logger.info(`[Giveaway] ${interaction.user.tag} started a giveaway in ${interaction.guild!.name}`);

  } catch (error) {
    logger.error('[Giveaway] Error executing giveaway command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while starting the giveaway.',
    });
  }
}

function parseDuration(str: string): number | null {
  const match = str.match(/^(\d+)(h|d)$/);
  if (!match) return null;

  const value = parseInt(match[1]);
  const unit = match[2];

  if (unit === 'h') return value * 3600;
  if (unit === 'd') return value * 86400;

  return null;
}
