/**
 * /whois command - Look up a Discord user's Roblox account or vice versa
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import prisma from '../db/client.js';
import { getRobloxUserByUsername } from '../lib/roblox.js';
import { logger } from '../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('whois')
  .setDescription('Look up a verified user')
  .addUserOption(option =>
    option
      .setName('discord-user')
      .setDescription('Discord user to look up')
      .setRequired(false)
  )
  .addStringOption(option =>
    option
      .setName('roblox-username')
      .setDescription('Roblox username to look up')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const discordUser = interaction.options.getUser('discord-user');
  const robloxUsername = interaction.options.getString('roblox-username');

  if (!discordUser && !robloxUsername) {
    return interaction.editReply({
      content: '❌ Please provide either a Discord user or a Roblox username.',
    });
  }

  try {
    if (discordUser) {
      // Look up by Discord user
      const user = await prisma.user.findUnique({
        where: { discordId: discordUser.id },
      });

      if (!user) {
        return interaction.editReply({
          content: `❌ ${discordUser.tag} is not verified.`,
        });
      }

      const embed = new EmbedBuilder()
        .setTitle('🔍 User Lookup')
        .addFields(
          { name: 'Discord User', value: `${discordUser.tag}\n\`${discordUser.id}\``, inline: true },
          { name: 'Roblox User', value: `${user.robloxUsername}\n\`${user.robloxId}\``, inline: true },
          { name: 'Points', value: user.points.toString(), inline: true },
          { name: 'Verified At', value: `<t:${Math.floor(user.verifiedAt.getTime() / 1000)}:R>`, inline: false }
        )
        .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${user.robloxId}&width=150&height=150&format=png`)
        .setColor(0x0099ff)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } else if (robloxUsername) {
      // Look up by Roblox username
      const robloxUser = await getRobloxUserByUsername(robloxUsername);

      if (!robloxUser) {
        return interaction.editReply({
          content: `❌ Roblox user **${robloxUsername}** not found.`,
        });
      }

      const user = await prisma.user.findUnique({
        where: { robloxId: robloxUser.id.toString() },
      });

      if (!user) {
        return interaction.editReply({
          content: `❌ Roblox user **${robloxUsername}** is not linked to any Discord account.`,
        });
      }

      // Fetch Discord user
      let discordUserTag = 'Unknown User';
      try {
        const fetchedUser = await interaction.client.users.fetch(user.discordId);
        discordUserTag = fetchedUser.tag;
      } catch {
        discordUserTag = `Unknown User (${user.discordId})`;
      }

      const embed = new EmbedBuilder()
        .setTitle('🔍 User Lookup')
        .addFields(
          { name: 'Roblox User', value: `${user.robloxUsername}\n\`${user.robloxId}\``, inline: true },
          { name: 'Discord User', value: `${discordUserTag}\n\`${user.discordId}\``, inline: true },
          { name: 'Points', value: user.points.toString(), inline: true },
          { name: 'Verified At', value: `<t:${Math.floor(user.verifiedAt.getTime() / 1000)}:R>`, inline: false }
        )
        .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${user.robloxId}&width=150&height=150&format=png`)
        .setColor(0x0099ff)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  } catch (error) {
    logger.error('Error in /whois command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while looking up the user. Please try again.',
    });
  }
}
