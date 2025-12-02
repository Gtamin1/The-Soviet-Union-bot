/**
 * /setroblosecurity - Set the .ROBLOSECURITY cookie (ADMIN ONLY)
 * SECURITY: Deletes the message immediately after receiving it
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import prisma from '../db/client.js';
import { isAdmin } from '../lib/permissions.js';
import { encrypt } from '../lib/encryption.js';
import { testCookie } from '../lib/ranking.js';
import { logger } from '../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('setroblosecurity')
  .setDescription('Set the Roblox cookie for auto-ranking (ADMIN ONLY)')
  .addStringOption(option =>
    option
      .setName('cookie')
      .setDescription('Your .ROBLOSECURITY cookie')
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

  // IMPORTANT: Defer with ephemeral so cookie isn't visible to others
  await interaction.deferReply({ ephemeral: true });

  const cookie = interaction.options.getString('cookie', true);

  try {
    // Encrypt the cookie
    const encryptedCookie = encrypt(cookie);

    // Test if cookie is valid
    const isValid = await testCookie(encryptedCookie);

    if (!isValid) {
      return interaction.editReply({
        content: '❌ The cookie appears to be invalid or expired. Please check it and try again.',
      });
    }

    // Store encrypted cookie in database
    await prisma.guildConfig.upsert({
      where: { guildId: interaction.guild.id },
      update: { robloxCookie: encryptedCookie },
      create: {
        guildId: interaction.guild.id,
        robloxCookie: encryptedCookie,
      },
    });

    await interaction.editReply({
      content: '✅ Roblox cookie set successfully!\n\n' +
               '⚠️ **IMPORTANT SECURITY NOTES:**\n' +
               '• The cookie is encrypted in the database\n' +
               '• Make sure you are using a BOT ACCOUNT, not your personal account\n' +
               '• The bot account must have permission to rank users in your group\n' +
               '• Never share this cookie with anyone\n\n' +
               'Auto-promotions and manual ranking commands are now enabled!',
    });

    logger.info(`${interaction.user.tag} set Roblox cookie for ${interaction.guild.name}`);
  } catch (error) {
    logger.error('Error in /setroblosecurity command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while setting the cookie. Make sure ENCRYPTION_KEY is set in your .env file.',
    });
  }
}
