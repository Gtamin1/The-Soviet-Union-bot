/**
 * /reverify command - Re-link your Discord account to a different Roblox account
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import prisma from '../db/client.js';
import { generateVerificationCode } from '../lib/utils.js';
import { logger } from '../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('reverify')
  .setDescription('Link your Discord account to a different Roblox account')
  .addStringOption(option =>
    option
      .setName('username')
      .setDescription('Your new Roblox username')
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const username = interaction.options.getString('username', true);

  try {
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

    // Check if this Roblox account is already linked to another Discord user
    const existingRobloxLink = await prisma.user.findUnique({
      where: { robloxId: robloxUser.id.toString() },
    });

    if (existingRobloxLink && existingRobloxLink.discordId !== interaction.user.id) {
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
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
      create: {
        discordId: interaction.user.id,
        code,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    const embed = new EmbedBuilder()
      .setTitle('🔐 Roblox Re-verification')
      .setDescription(`To re-verify your Roblox account, follow these steps:`)
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
      .setColor(0xffaa00)
      .setFooter({ text: 'Code expires in 10 minutes' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    logger.info(`${interaction.user.tag} initiated re-verification for Roblox user: ${username}`);
  } catch (error) {
    logger.error('Error in /reverify command:', error);
    await interaction.editReply({
      content: '❌ An error occurred during re-verification. Please try again.',
    });
  }
}
