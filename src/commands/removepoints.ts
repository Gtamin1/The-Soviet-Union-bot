/**
 * /removepoints command - Remove points from a user
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import prisma from '../db/client.js';
import { isOfficer } from '../lib/permissions.js';
import { logger } from '../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('removepoints')
  .setDescription('Remove points from a user')
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('User to remove points from')
      .setRequired(true)
  )
  .addIntegerOption(option =>
    option
      .setName('amount')
      .setDescription('Amount of points to remove')
      .setRequired(true)
      .setMinValue(1)
  )
  .addStringOption(option =>
    option
      .setName('reason')
      .setDescription('Reason for removing points')
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild || !interaction.member) {
    return interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
  }

  // Check permissions
  if (!(await isOfficer(interaction.member as any))) {
    return interaction.reply({ content: '❌ You do not have permission to remove points.', ephemeral: true });
  }

  await interaction.deferReply();

  const targetUser = interaction.options.getUser('user', true);
  const amount = interaction.options.getInteger('amount', true);
  const reason = interaction.options.getString('reason', true);

  try {
    const user = await prisma.user.findUnique({
      where: { discordId: targetUser.id },
    });

    if (!user) {
      return interaction.editReply({
        content: `❌ ${targetUser.tag} is not verified.`,
      });
    }

    // Update user points (don't go below 0)
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { points: { decrement: amount } },
    });

    // If points went below 0, set to 0
    if (updatedUser.points < 0) {
      await prisma.user.update({
        where: { id: user.id },
        data: { points: 0 },
      });
      updatedUser.points = 0;
    }

    // Create transaction record
    await prisma.pointTransaction.create({
      data: {
        userId: user.id,
        amount: amount,
        reason: reason,
        givenByDiscordId: interaction.user.id,
        givenByUsername: interaction.user.tag,
        type: 'remove',
        source: 'discord',
      },
    });

    const embed = new EmbedBuilder()
      .setTitle('✅ Points Removed')
      .addFields(
        { name: 'User', value: `${targetUser.tag}`, inline: true },
        { name: 'Amount', value: `-${amount}`, inline: true },
        { name: 'New Total', value: updatedUser.points.toString(), inline: true },
        { name: 'Reason', value: reason, inline: false },
        { name: 'Removed By', value: interaction.user.tag, inline: false }
      )
      .setColor(0xff0000)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // Log to log channel
    const config = await prisma.guildConfig.findUnique({
      where: { guildId: interaction.guildId! },
    });

    if (config?.logChannelId) {
      const logChannel = await interaction.guild?.channels.fetch(config.logChannelId);
      if (logChannel?.isTextBased()) {
        await logChannel.send({ embeds: [embed] });
      }
    }

    logger.info(`${interaction.user.tag} removed ${amount} points from ${targetUser.tag}`);
  } catch (error) {
    logger.error('Error in /removepoints command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while removing points.',
    });
  }
}
