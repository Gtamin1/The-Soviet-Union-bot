/**
 * /verify-check command - Check if the verification code is in the user's bio
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import prisma from '../db/client.js';
import { checkBioForCode, getRobloxUserByUsername, getUserGroups } from '../lib/roblox.js';
import { logger } from '../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('verify-check')
  .setDescription('Check your verification code')
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
    // Get the verification code
    const verificationCode = await prisma.verificationCode.findUnique({
      where: { discordId: interaction.user.id },
    });

    if (!verificationCode) {
      return interaction.editReply({
        content: '❌ No verification code found. Please run `/verify` first.',
      });
    }

    // Check if code is expired
    if (verificationCode.expiresAt < new Date()) {
      await prisma.verificationCode.delete({
        where: { discordId: interaction.user.id },
      });
      return interaction.editReply({
        content: '❌ Your verification code has expired. Please run `/verify` again.',
      });
    }

    // Fetch Roblox user
    const robloxUser = await getRobloxUserByUsername(username);

    if (!robloxUser) {
      return interaction.editReply({
        content: `❌ Roblox user **${username}** not found.`,
      });
    }

    // Check if code is in bio
    const codeInBio = await checkBioForCode(robloxUser.id, verificationCode.code);

    if (!codeInBio) {
      return interaction.editReply({
        content: `❌ Verification code not found in your bio. Make sure you added \`${verificationCode.code}\` to your Roblox profile's "About" section.`,
      });
    }

    // Create or update user record
    const user = await prisma.user.upsert({
      where: { discordId: interaction.user.id },
      update: {
        robloxId: robloxUser.id.toString(),
        robloxUsername: robloxUser.name,
      },
      create: {
        discordId: interaction.user.id,
        robloxId: robloxUser.id.toString(),
        robloxUsername: robloxUser.name,
      },
    });

    // Delete verification code
    await prisma.verificationCode.delete({
      where: { discordId: interaction.user.id },
    });

    // Update roles
    await updateUserRoles(interaction);

    const embed = new EmbedBuilder()
      .setTitle('✅ Verification Successful!')
      .setDescription(`Your Discord account has been linked to **${robloxUser.name}**`)
      .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${robloxUser.id}&width=150&height=150&format=png`)
      .setColor(0x00ff00)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // Log to log channel if configured
    const config = await prisma.guildConfig.findUnique({
      where: { guildId: interaction.guildId! },
    });

    if (config?.logChannelId) {
      const logChannel = await interaction.guild?.channels.fetch(config.logChannelId);
      if (logChannel?.isTextBased()) {
        const logEmbed = new EmbedBuilder()
          .setTitle('✅ New Verification')
          .addFields(
            { name: 'Discord User', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
            { name: 'Roblox User', value: `${robloxUser.name} (${robloxUser.id})`, inline: true }
          )
          .setColor(0x00ff00)
          .setTimestamp();

        await logChannel.send({ embeds: [logEmbed] });
      }
    }

    logger.info(`${interaction.user.tag} verified as ${robloxUser.name}`);
  } catch (error) {
    logger.error('Error in /verify-check command:', error);
    await interaction.editReply({
      content: '❌ An error occurred during verification. Please try again.',
    });
  }
}

async function updateUserRoles(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild || !interaction.member) return;

  try {
    const config = await prisma.guildConfig.findUnique({
      where: { guildId: interaction.guildId! },
    });

    if (!config) return;

    const member = await interaction.guild.members.fetch(interaction.user.id);

    // Add verified role
    if (config.verifiedRoleId) {
      const verifiedRole = interaction.guild.roles.cache.get(config.verifiedRoleId);
      if (verifiedRole) {
        await member.roles.add(verifiedRole);
      }
    }

    // Remove unverified role
    if (config.unverifiedRoleId) {
      const unverifiedRole = interaction.guild.roles.cache.get(config.unverifiedRoleId);
      if (unverifiedRole) {
        await member.roles.remove(unverifiedRole);
      }
    }

    // Update group roles
    if (config.primaryGroupId) {
      const user = await prisma.user.findUnique({
        where: { discordId: interaction.user.id },
      });

      if (!user) return;

      const groups = await getUserGroups(user.robloxId);
      const roleBindings = await prisma.roleBinding.findMany({
        where: { guildId: interaction.guildId! },
      });

      for (const binding of roleBindings) {
        const group = groups.find(g => g.group.id.toString() === binding.groupId);

        if (!group) continue;

        const discordRole = interaction.guild.roles.cache.get(binding.discordRoleId);
        if (!discordRole) continue;

        let shouldHaveRole = false;

        if (binding.exactRank !== null) {
          shouldHaveRole = group.role.rank === binding.exactRank;
        } else if (binding.minRank !== null && binding.maxRank !== null) {
          shouldHaveRole = group.role.rank >= binding.minRank && group.role.rank <= binding.maxRank;
        }

        if (shouldHaveRole && !member.roles.cache.has(discordRole.id)) {
          await member.roles.add(discordRole);
        } else if (!shouldHaveRole && member.roles.cache.has(discordRole.id)) {
          await member.roles.remove(discordRole);
        }
      }
    }
  } catch (error) {
    logger.error('Error updating user roles:', error);
  }
}
