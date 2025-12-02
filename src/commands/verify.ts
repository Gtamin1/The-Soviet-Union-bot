/**
 * /verify command - Start the Roblox verification process
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import prisma from '../db/client.js';
import { generateVerificationCode } from '../lib/utils.js';
import { logger } from '../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('verify')
  .setDescription('Link your Roblox account to Discord')
  .addStringOption(option =>
    option
      .setName('username')
      .setDescription('Your Roblox username')
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const username = interaction.options.getString('username', true);

  try {
    // Check if user is already verified
    const existingUser = await prisma.user.findUnique({
      where: { discordId: interaction.user.id },
    });

    if (existingUser) {
      return interaction.editReply({
        content: `❌ You are already verified as **${existingUser.robloxUsername}**. Use \`/reverify\` to link a different account.`,
      });
    }

    // Fetch Roblox user
    const robloxResponse = await fetch('https://users.roblox.com/v1/usernames/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
    });

    if (!robloxResponse.ok) {
      return interaction.editReply({
        content: '❌ Failed to fetch Roblox user. Please try again later.',
      });
    }

    const robloxData = await robloxResponse.json();

    if (!robloxData.data || robloxData.data.length === 0) {
      return interaction.editReply({
        content: `❌ Roblox user **${username}** not found. Please check the spelling and try again.`,
      });
    }

    const robloxUser = robloxData.data[0];

    // Check if Roblox account is already linked
    const existingRobloxLink = await prisma.user.findUnique({
      where: { robloxId: robloxUser.id.toString() },
    });

    if (existingRobloxLink) {
      return interaction.editReply({
        content: `❌ This Roblox account is already linked to another Discord user.`,
      });
    }

    // Generate verification code
    const code = generateVerificationCode();

    // Store or update verification code
    await prisma.verificationCode.upsert({
      where: { discordId: interaction.user.id },
      update: {
        code,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      },
      create: {
        discordId: interaction.user.id,
        code,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    const embed = new EmbedBuilder()
      .setTitle('🔐 Roblox Verification')
      .setDescription(`To verify your Roblox account, follow these steps:`)
      .addFields(
        {
          name: '1️⃣ Copy your code',
          value: `\`\`\`${code}\`\`\``,
          inline: false,
        },
        {
          name: '2️⃣ Add it to your Roblox profile',
          value: `Go to [Roblox Profile Settings](https://www.roblox.com/my/account#!/info) and add the code **anywhere** in your "About" section.`,
          inline: false,
        },
        {
          name: '3️⃣ Run this command',
          value: `\`/verify-check ${username}\``,
          inline: false,
        }
      )
      .setColor(0x00ff00)
      .setFooter({ text: 'Code expires in 10 minutes' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    logger.info(`${interaction.user.tag} initiated verification for Roblox user: ${username}`);
  } catch (error) {
    logger.error('Error in /verify command:', error);
    await interaction.editReply({
      content: '❌ An error occurred during verification. Please try again.',
    });
  }
}
