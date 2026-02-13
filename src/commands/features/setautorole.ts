/**
 * /setautorole command - Configure auto-role on join
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import prisma from '../../db/client.js';
import { checkPermission } from '../../lib/permissions.js';
import { logger } from '../../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('setautorole')
  .setDescription('Set a role to be automatically given to new members')
  .addRoleOption(option =>
    option
      .setName('role')
      .setDescription('The role to give to new members')
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!await checkPermission(interaction, 'admin')) {
    return;
  }

  const role = interaction.options.getRole('role', true);

  await interaction.deferReply();

  try {
    // Update config
    await prisma.guildConfig.upsert({
      where: { guildId: interaction.guildId! },
      update: { autoRoleId: role.id },
      create: {
        guildId: interaction.guildId!,
        autoRoleId: role.id,
      },
    });

    const embed = new EmbedBuilder()
      .setTitle('✅ Auto-Role Configured')
      .setColor(0x57f287)
      .addFields(
        { name: 'Role', value: `<@&${role.id}>`, inline: true },
        { name: 'Set By', value: interaction.user.tag, inline: true }
      )
      .setDescription('This role will be automatically given to all new members who join the server.')
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    logger.info(`[SetAutoRole] ${interaction.user.tag} set auto-role to ${role.name} in ${interaction.guild!.name}`);

  } catch (error) {
    logger.error('[SetAutoRole] Error executing setautorole command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while setting the auto-role.',
    });
  }
}
