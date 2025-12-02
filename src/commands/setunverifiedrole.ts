/**
 * /setunverifiedrole command - Set the unverified role
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import prisma from '../db/client.js';
import { isAdmin } from '../lib/permissions.js';
import { logger } from '../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('setunverifiedrole')
  .setDescription('Set the role given to unverified users')
  .addRoleOption(option =>
    option
      .setName('role')
      .setDescription('The unverified role')
      .setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild || !interaction.member) {
    return interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
  }

  // Check permissions
  if (!(await isAdmin(interaction.member as any))) {
    return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
  }

  await interaction.deferReply();

  const role = interaction.options.getRole('role', true);

  try {
    await prisma.guildConfig.upsert({
      where: { guildId: interaction.guild.id },
      update: { unverifiedRoleId: role.id },
      create: {
        guildId: interaction.guild.id,
        unverifiedRoleId: role.id,
      },
    });

    await interaction.editReply({
      content: `✅ Unverified role set to ${role}`,
    });

    logger.info(`${interaction.user.tag} set unverified role to ${role.name} in ${interaction.guild.name}`);
  } catch (error) {
    logger.error('Error in /setunverifiedrole command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while setting the unverified role.',
    });
  }
}
