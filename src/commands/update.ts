/**
 * /update command - Update a user's Discord roles based on their Roblox rank
 */

import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import prisma from '../db/client.js';
import { getUserGroups } from '../lib/roblox.js';
import { logger } from '../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('update')
  .setDescription('Update Discord roles based on Roblox rank')
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('User to update (leave empty to update yourself)')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    return interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
  }

  await interaction.deferReply();

  const targetUser = interaction.options.getUser('user') || interaction.user;

  try {
    // Check if user is verified
    const user = await prisma.user.findUnique({
      where: { discordId: targetUser.id },
    });

    if (!user) {
      return interaction.editReply({
        content: `❌ ${targetUser.tag} is not verified.`,
      });
    }

    // Get guild config
    const config = await prisma.guildConfig.findUnique({
      where: { guildId: interaction.guild.id },
      include: {
        roleBindings: true,
        groupBindings: true,
      },
    });

    if (!config?.primaryGroupId) {
      return interaction.editReply({
        content: '❌ No primary group set. Use `/setprimarygroup` first.',
      });
    }

    // Get user's groups
    const groups = await getUserGroups(user.robloxId);

    if (groups.length === 0) {
      return interaction.editReply({
        content: `❌ Failed to fetch groups for ${user.robloxUsername}.`,
      });
    }

    const member = await interaction.guild.members.fetch(targetUser.id);

    let rolesAdded = 0;
    let rolesRemoved = 0;

    // Process role bindings (primary group)
    for (const binding of config.roleBindings) {
      const group = groups.find(g => g.group.id.toString() === binding.groupId);
      const discordRole = interaction.guild.roles.cache.get(binding.discordRoleId);

      if (!discordRole) continue;

      let shouldHaveRole = false;

      if (group) {
        if (binding.exactRank !== null) {
          shouldHaveRole = group.role.rank === binding.exactRank;
        } else if (binding.minRank !== null && binding.maxRank !== null) {
          shouldHaveRole = group.role.rank >= binding.minRank && group.role.rank <= binding.maxRank;
        }
      }

      if (shouldHaveRole && !member.roles.cache.has(discordRole.id)) {
        await member.roles.add(discordRole);
        rolesAdded++;
      } else if (!shouldHaveRole && member.roles.cache.has(discordRole.id)) {
        await member.roles.remove(discordRole);
        rolesRemoved++;
      }
    }

    // Process group bindings (divisions)
    for (const binding of config.groupBindings) {
      const inGroup = groups.some(g => g.group.id.toString() === binding.groupId);
      const discordRole = interaction.guild.roles.cache.get(binding.discordRoleId);

      if (!discordRole) continue;

      if (inGroup && !member.roles.cache.has(discordRole.id)) {
        await member.roles.add(discordRole);
        rolesAdded++;
      } else if (!inGroup && member.roles.cache.has(discordRole.id)) {
        await member.roles.remove(discordRole);
        rolesRemoved++;
      }
    }

    // Update nickname if configured
    if (config.nicknameFormat) {
      const primaryGroup = groups.find(g => g.group.id.toString() === config.primaryGroupId);
      if (primaryGroup) {
        const nickname = config.nicknameFormat
          .replace('{username}', user.robloxUsername)
          .replace('{rank}', primaryGroup.role.name)
          .replace('{robloxId}', user.robloxId);

        try {
          await member.setNickname(nickname);
        } catch (error) {
          logger.warn(`Failed to update nickname for ${targetUser.tag}:`, error);
        }
      }
    }

    await interaction.editReply({
      content: `✅ Updated roles for ${targetUser.tag}\n\n` +
        `📝 **Added:** ${rolesAdded} roles\n` +
        `📝 **Removed:** ${rolesRemoved} roles`,
    });

    logger.info(`${interaction.user.tag} updated roles for ${targetUser.tag} in ${interaction.guild.name}`);
  } catch (error) {
    logger.error('Error in /update command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while updating roles.',
    });
  }
}
