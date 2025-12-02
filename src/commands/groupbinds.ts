/**
 * /groupbinds command - List all group bindings
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import prisma from '../db/client.js';
import { logger } from '../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('groupbinds')
  .setDescription('List all group bindings');

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    return interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
  }

  await interaction.deferReply();

  try {
    const groupBindings = await prisma.groupBinding.findMany({
      where: { guildId: interaction.guild.id },
    });

    if (groupBindings.length === 0) {
      return interaction.editReply({
        content: '❌ No group bindings configured. Use `/groupbind` to create bindings.',
      });
    }

    const embed = new EmbedBuilder()
      .setTitle('🔗 Group Bindings')
      .setDescription('Discord roles bound to Roblox group memberships')
      .setColor(0x0099ff)
      .setTimestamp();

    for (const binding of groupBindings) {
      embed.addFields({
        name: `<@&${binding.discordRoleId}>`,
        value: `Group ID: \`${binding.groupId}\``,
        inline: true,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Error in /groupbinds command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while fetching group bindings.',
    });
  }
}
