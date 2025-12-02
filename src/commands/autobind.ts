/**
 * /autobind command - Automatically create and bind Discord roles for all ranks in the primary group
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import prisma from '../db/client.js';
import { isAdmin } from '../lib/permissions.js';
import { getGroupRoles } from '../lib/roblox.js';
import { logger } from '../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('autobind')
  .setDescription('Automatically create and bind Discord roles for all ranks in the primary group')
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

  try {
    // Get guild config
    const config = await prisma.guildConfig.findUnique({
      where: { guildId: interaction.guild.id },
    });

    if (!config?.primaryGroupId) {
      return interaction.editReply({
        content: '❌ No primary group set. Use `/setprimarygroup` first.',
      });
    }

    // Get all roles in the group
    const groupRoles = await getGroupRoles(config.primaryGroupId);

    if (groupRoles.length === 0) {
      return interaction.editReply({
        content: '❌ Failed to fetch group roles. Please try again.',
      });
    }

    let created = 0;
    let bound = 0;
    const errors: string[] = [];

    for (const role of groupRoles) {
      // Skip "Guest" rank (rank 0)
      if (role.rank === 0) continue;

      try {
        // Check if role already exists
        let discordRole = interaction.guild.roles.cache.find(r => r.name === role.name);

        // Create role if it doesn't exist
        if (!discordRole) {
          discordRole = await interaction.guild.roles.create({
            name: role.name,
            reason: `Auto-bind for Roblox group rank ${role.rank}`,
          });
          created++;
        }

        // Check if binding already exists
        const existingBinding = await prisma.roleBinding.findFirst({
          where: {
            guildId: interaction.guild.id,
            groupId: config.primaryGroupId,
            exactRank: role.rank,
          },
        });

        if (!existingBinding) {
          // Create binding
          await prisma.roleBinding.create({
            data: {
              guildId: interaction.guild.id,
              discordRoleId: discordRole.id,
              groupId: config.primaryGroupId,
              exactRank: role.rank,
              rankName: role.name,
            },
          });
          bound++;
        }
      } catch (error: any) {
        errors.push(`Failed to process ${role.name}: ${error.message}`);
      }
    }

    let message = `✅ Auto-bind complete!\n\n`;
    message += `📝 **Created:** ${created} new Discord roles\n`;
    message += `🔗 **Bound:** ${bound} rank bindings\n`;

    if (errors.length > 0) {
      message += `\n⚠️ **Errors:**\n${errors.join('\n')}`;
    }

    await interaction.editReply({ content: message });

    logger.info(`${interaction.user.tag} ran autobind in ${interaction.guild.name}`);
  } catch (error) {
    logger.error('Error in /autobind command:', error);
    await interaction.editReply({
      content: '❌ An error occurred during auto-bind.',
    });
  }
}
