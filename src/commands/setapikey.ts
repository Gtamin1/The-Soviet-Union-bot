/**
 * /setapikey command - Set the API key for Roblox game integration
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import prisma from '../db/client.js';
import { isAdmin } from '../lib/permissions.js';
import { logger } from '../lib/logger.js';
import crypto from 'crypto';

export const data = new SlashCommandBuilder()
  .setName('setapikey')
  .setDescription('Set or generate the API key for Roblox game integration')
  .addStringOption(option =>
    option
      .setName('key')
      .setDescription('API key (leave empty to auto-generate)')
      .setRequired(false)
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

  await interaction.deferReply({ ephemeral: true });

  let apiKey = interaction.options.getString('key');

  // Generate a random API key if none provided
  if (!apiKey) {
    apiKey = crypto.randomBytes(32).toString('hex');
  }

  try {
    await prisma.guildConfig.upsert({
      where: { guildId: interaction.guild.id },
      update: { apiKey: apiKey },
      create: {
        guildId: interaction.guild.id,
        apiKey: apiKey,
      },
    });

    await interaction.editReply({
      content: `✅ API key set successfully!\n\n` +
               `🔑 **Your API Key:**\n\`\`\`${apiKey}\`\`\`\n\n` +
               `⚠️ **Keep this key secret!** Use it in your Roblox game scripts to authenticate API requests.\n\n` +
               `This message is only visible to you.`,
    });

    logger.info(`${interaction.user.tag} set API key in ${interaction.guild.name}`);
  } catch (error) {
    logger.error('Error in /setapikey command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while setting the API key.',
    });
  }
}
