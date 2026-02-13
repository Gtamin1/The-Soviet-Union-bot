/**
 * /setmodrole command - Configure the moderator role
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import prisma from '../../db/client.js';
import { checkPermission } from '../../lib/permissions.js';
import { logger } from '../../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('setmodrole')
  .setDescription('Set the moderator role')
  .addRoleOption(option =>
    option
      .setName('role')
      .setDescription('The role that can use moderation commands')
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!await checkPermission(interaction, 'admin')) {
    return;
  }

  const role = interaction.options.getRole('role', true);

  await interaction.deferReply();

  try {
    // Upsert ModerationConfig
    await prisma.moderationConfig.upsert({
      where: { id: interaction.guildId! },
      update: { moderatorRoleId: role.id },
      create: {
        id: interaction.guildId!,
        moderatorRoleId: role.id,
      },
    });

    const embed = new EmbedBuilder()
      .setTitle('✅ Moderator Role Set')
      .setColor(0x57f287)
      .addFields(
        { name: 'Role', value: `<@&${role.id}>`, inline: true },
        { name: 'Set By', value: interaction.user.tag, inline: true }
      )
      .setDescription('Users with this role (plus those with Ban/Kick permissions) can use moderation commands.')
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    logger.info(`[SetModRole] ${interaction.user.tag} set moderator role to ${role.name} in ${interaction.guild!.name}`);

  } catch (error) {
    logger.error('[SetModRole] Error executing setmodrole command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while setting the moderator role.',
    });
  }
}
