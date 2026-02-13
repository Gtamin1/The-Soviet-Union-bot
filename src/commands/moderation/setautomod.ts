/**
 * /setautomod command - Configure auto-moderation thresholds
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import prisma from '../../db/client.js';
import { checkPermission } from '../../lib/permissions.js';
import { logger } from '../../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('setautomod')
  .setDescription('Configure auto-moderation thresholds for warnings')
  .addIntegerOption(option =>
    option
      .setName('auto-kick-warnings')
      .setDescription('Auto-kick after X warnings (0 = disabled)')
      .setRequired(false)
      .setMinValue(0)
      .setMaxValue(50)
  )
  .addIntegerOption(option =>
    option
      .setName('auto-ban-warnings')
      .setDescription('Auto-ban after X warnings (0 = disabled)')
      .setRequired(false)
      .setMinValue(0)
      .setMaxValue(50)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!await checkPermission(interaction, 'admin')) {
    return;
  }

  const autoKick = interaction.options.getInteger('auto-kick-warnings');
  const autoBan = interaction.options.getInteger('auto-ban-warnings');

  if (autoKick === null && autoBan === null) {
    return interaction.reply({
      content: '❌ You must provide at least one option (auto-kick-warnings or auto-ban-warnings).',
      ephemeral: true,
    });
  }

  // Validation: auto-ban must be > auto-kick if both set
  if (autoKick !== null && autoBan !== null && autoKick !== 0 && autoBan !== 0 && autoBan <= autoKick) {
    return interaction.reply({
      content: '❌ Auto-ban warnings must be greater than auto-kick warnings.',
      ephemeral: true,
    });
  }

  await interaction.deferReply();

  try {
    // Get current config or create new
    const currentConfig = await prisma.moderationConfig.findUnique({
      where: { id: interaction.guildId! },
    });

    const updateData: any = {};

    if (autoKick !== null) {
      updateData.autoKickWarnings = autoKick === 0 ? null : autoKick;
    }

    if (autoBan !== null) {
      updateData.autoBanWarnings = autoBan === 0 ? null : autoBan;
    }

    // Upsert ModerationConfig
    const config = await prisma.moderationConfig.upsert({
      where: { id: interaction.guildId! },
      update: updateData,
      create: {
        id: interaction.guildId!,
        ...updateData,
      },
    });

    const embed = new EmbedBuilder()
      .setTitle('✅ Auto-Moderation Settings Updated')
      .setColor(0x57f287)
      .addFields(
        {
          name: 'Auto-Kick Threshold',
          value: config.autoKickWarnings ? `${config.autoKickWarnings} warnings` : '❌ Disabled',
          inline: true,
        },
        {
          name: 'Auto-Ban Threshold',
          value: config.autoBanWarnings ? `${config.autoBanWarnings} warnings` : '❌ Disabled',
          inline: true,
        },
        { name: 'Set By', value: interaction.user.tag, inline: true }
      )
      .setDescription('Users will be automatically kicked/banned when they reach these warning thresholds.')
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    logger.info(`[SetAutoMod] ${interaction.user.tag} updated auto-moderation settings in ${interaction.guild!.name}`);

  } catch (error) {
    logger.error('[SetAutoMod] Error executing setautomod command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while updating auto-moderation settings.',
    });
  }
}
