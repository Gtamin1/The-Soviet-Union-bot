/**
 * /setnickname command - Set the nickname format for verified users
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import prisma from '../db/client.js';
import { isAdmin } from '../lib/permissions.js';
import { logger } from '../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('setnickname')
  .setDescription('Set the nickname format for verified users')
  .addStringOption(option =>
    option
      .setName('format')
      .setDescription('Nickname format (use {username}, {rank}, {robloxId})')
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

  const format = interaction.options.getString('format', true);

  try {
    await prisma.guildConfig.upsert({
      where: { guildId: interaction.guild.id },
      update: { nicknameFormat: format },
      create: {
        guildId: interaction.guild.id,
        nicknameFormat: format,
      },
    });

    const example = format
      .replace('{username}', 'JohnDoe')
      .replace('{rank}', 'Corporal')
      .replace('{robloxId}', '123456789');

    await interaction.editReply({
      content: `✅ Nickname format set to: \`${format}\`\n\n**Example:** ${example}`,
    });

    logger.info(`${interaction.user.tag} set nickname format to "${format}" in ${interaction.guild.name}`);
  } catch (error) {
    logger.error('Error in /setnickname command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while setting the nickname format.',
    });
  }
}
