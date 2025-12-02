/**
 * /setadminrole command - Set the Discord role that can configure the bot
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import prisma from '../db/client.js';
import { isAdmin } from '../lib/permissions.js';
import { logger } from '../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('setadminrole')
  .setDescription('Set the Discord role that can configure the bot')
  .addRoleOption(option =>
    option
      .setName('role')
      .setDescription('The admin role')
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
      update: { adminRoleId: role.id },
      create: {
        guildId: interaction.guild.id,
        adminRoleId: role.id,
      },
    });

    await interaction.editReply({
      content: `✅ Admin role set to ${role}`,
    });

    logger.info(`${interaction.user.tag} set admin role to ${role.name} in ${interaction.guild.name}`);
  } catch (error) {
    logger.error('Error in /setadminrole command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while setting the admin role.',
    });
  }
}
