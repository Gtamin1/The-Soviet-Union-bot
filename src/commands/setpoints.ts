/**
 * /setpoints command - Set exact point value for a user (admin only)
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import prisma from '../db/client.js';
import { isAdmin } from '../lib/permissions.js';
import { logger } from '../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('setpoints')
  .setDescription('Set exact point value for a user (admin only)')
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('User to set points for')
      .setRequired(true)
  )
  .addIntegerOption(option =>
    option
      .setName('amount')
      .setDescription('New point value')
      .setRequired(true)
      .setMinValue(0)
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

  await interaction.deferReply();

  const targetUser = interaction.options.getUser('user', true);
  const amount = interaction.options.getInteger('amount', true);

  try {
    const user = await prisma.user.findUnique({
      where: { discordId: targetUser.id },
    });

    if (!user) {
      return interaction.editReply({
        content: `❌ ${targetUser.tag} is not verified.`,
      });
    }

    const oldPoints = user.points;

    // Update user points
    await prisma.user.update({
      where: { id: user.id },
      data: { points: amount },
    });

    // Create transaction record
    const difference = amount - oldPoints;
    await prisma.pointTransaction.create({
      data: {
        userId: user.id,
        amount: Math.abs(difference),
        reason: `Points set by admin from ${oldPoints} to ${amount}`,
        givenByDiscordId: interaction.user.id,
        givenByUsername: interaction.user.tag,
        type: difference >= 0 ? 'add' : 'remove',
        source: 'discord',
      },
    });

    const embed = new EmbedBuilder()
      .setTitle('✅ Points Set')
      .addFields(
        { name: 'User', value: `${targetUser.tag}`, inline: true },
        { name: 'Old Points', value: oldPoints.toString(), inline: true },
        { name: 'New Points', value: amount.toString(), inline: true },
        { name: 'Set By', value: interaction.user.tag, inline: false }
      )
      .setColor(0x0099ff)
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

    logger.info(`${interaction.user.tag} set ${targetUser.tag}'s points to ${amount}`);
  } catch (error) {
    logger.error('Error in /setpoints command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while setting points.',
    });
  }
}
