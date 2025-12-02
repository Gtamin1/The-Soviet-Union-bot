/**
 * /batch command - Give points to multiple users at once
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import prisma from '../db/client.js';
import { isOfficer } from '../lib/permissions.js';
import { logger } from '../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('batch')
  .setDescription('Give points to multiple users at once')
  .addIntegerOption(option =>
    option
      .setName('amount')
      .setDescription('Amount of points to give each user')
      .setRequired(true)
      .setMinValue(1)
  )
  .addStringOption(option =>
    option
      .setName('reason')
      .setDescription('Reason for giving points')
      .setRequired(true)
  )
  .addUserOption(option =>
    option.setName('user1').setDescription('User 1').setRequired(true)
  )
  .addUserOption(option =>
    option.setName('user2').setDescription('User 2').setRequired(false)
  )
  .addUserOption(option =>
    option.setName('user3').setDescription('User 3').setRequired(false)
  )
  .addUserOption(option =>
    option.setName('user4').setDescription('User 4').setRequired(false)
  )
  .addUserOption(option =>
    option.setName('user5').setDescription('User 5').setRequired(false)
  )
  .addUserOption(option =>
    option.setName('user6').setDescription('User 6').setRequired(false)
  )
  .addUserOption(option =>
    option.setName('user7').setDescription('User 7').setRequired(false)
  )
  .addUserOption(option =>
    option.setName('user8').setDescription('User 8').setRequired(false)
  )
  .addUserOption(option =>
    option.setName('user9').setDescription('User 9').setRequired(false)
  )
  .addUserOption(option =>
    option.setName('user10').setDescription('User 10').setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild || !interaction.member) {
    return interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
  }

  // Check permissions
  if (!(await isOfficer(interaction.member as any))) {
    return interaction.reply({ content: '❌ You do not have permission to give points.', ephemeral: true });
  }

  await interaction.deferReply();

  const amount = interaction.options.getInteger('amount', true);
  const reason = interaction.options.getString('reason', true);

  // Collect all users
  const users = [];
  for (let i = 1; i <= 10; i++) {
    const user = interaction.options.getUser(`user${i}`);
    if (user) users.push(user);
  }

  try {
    let successful = 0;
    let failed = 0;
    const results: string[] = [];

    for (const targetUser of users) {
      try {
        const user = await prisma.user.findUnique({
          where: { discordId: targetUser.id },
        });

        if (!user) {
          results.push(`❌ ${targetUser.tag} - Not verified`);
          failed++;
          continue;
        }

        // Update user points
        await prisma.user.update({
          where: { id: user.id },
          data: { points: { increment: amount } },
        });

        // Create transaction record
        await prisma.pointTransaction.create({
          data: {
            userId: user.id,
            amount: amount,
            reason: reason,
            givenByDiscordId: interaction.user.id,
            givenByUsername: interaction.user.tag,
            type: 'add',
            source: 'discord',
          },
        });

        results.push(`✅ ${targetUser.tag} - +${amount} points`);
        successful++;
      } catch (error) {
        results.push(`❌ ${targetUser.tag} - Error occurred`);
        failed++;
      }
    }

    const embed = new EmbedBuilder()
      .setTitle('📦 Batch Points Given')
      .setDescription(results.join('\n'))
      .addFields(
        { name: 'Amount Per User', value: amount.toString(), inline: true },
        { name: 'Successful', value: successful.toString(), inline: true },
        { name: 'Failed', value: failed.toString(), inline: true },
        { name: 'Reason', value: reason, inline: false },
        { name: 'Given By', value: interaction.user.tag, inline: false }
      )
      .setColor(0x00ff00)
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

    logger.info(`${interaction.user.tag} gave ${amount} points to ${successful} users via batch`);
  } catch (error) {
    logger.error('Error in /batch command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while giving batch points.',
    });
  }
}
