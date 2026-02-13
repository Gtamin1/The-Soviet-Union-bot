/**
 * /setuptickets command - Set up ticket system with button
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } from 'discord.js';
import prisma from '../../db/client.js';
import { checkPermission } from '../../lib/permissions.js';
import { logger } from '../../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('setuptickets')
  .setDescription('Set up the ticket system')
  .addChannelOption(option =>
    option
      .setName('channel')
      .setDescription('Channel to send the ticket button')
      .setRequired(true)
      .addChannelTypes(ChannelType.GuildText)
  )
  .addRoleOption(option =>
    option
      .setName('ping-role')
      .setDescription('Role to ping when tickets are created (optional)')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!await checkPermission(interaction, 'admin')) {
    return;
  }

  const channel = interaction.options.getChannel('channel', true);
  const pingRole = interaction.options.getRole('ping-role');

  await interaction.deferReply();

  try {
    const guild = interaction.guild!;

    // Create tickets category if it doesn't exist
    const category = await guild.channels.create({
      name: '🎫 TICKETS',
      type: ChannelType.GuildCategory,
    });

    // Create ticket log channel
    const logChannel = await guild.channels.create({
      name: 'ticket-logs',
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
      ],
    });

    // Save config
    await prisma.guildConfig.upsert({
      where: { guildId: guild.id },
      update: {
        ticketCategoryId: category.id,
        ticketLogChannelId: logChannel.id,
        ticketPingRoleId: pingRole?.id || null,
      },
      create: {
        guildId: guild.id,
        ticketCategoryId: category.id,
        ticketLogChannelId: logChannel.id,
        ticketPingRoleId: pingRole?.id || null,
      },
    });

    // Create embed with button
    const ticketEmbed = new EmbedBuilder()
      .setTitle('🎫 Support Tickets')
      .setDescription('Need help? Click the button below to open a support ticket.\n\nOur team will assist you as soon as possible!')
      .setColor(0x5865f2)
      .addFields(
        { name: '📝 How it works', value: 'Click the button → Private ticket channel is created → Discuss your issue with staff', inline: false },
        { name: '⚠️ Important', value: 'Only create tickets for legitimate issues. Abuse will result in moderation action.', inline: false }
      )
      .setTimestamp();

    const button = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_open')
          .setLabel('🎫 Open Ticket')
          .setStyle(ButtonStyle.Primary)
      );

    // Send to channel
    const targetChannel = await guild.channels.fetch(channel.id);
    if (targetChannel && targetChannel.isTextBased()) {
      await targetChannel.send({
        embeds: [ticketEmbed],
        components: [button],
      });
    }

    const confirmEmbed = new EmbedBuilder()
      .setTitle('✅ Ticket System Configured')
      .setColor(0x57f287)
      .addFields(
        { name: 'Button Sent To', value: `<#${channel.id}>`, inline: true },
        { name: 'Category', value: category.name, inline: true },
        { name: 'Log Channel', value: `<#${logChannel.id}>`, inline: true }
      );

    if (pingRole) {
      confirmEmbed.addFields({ name: 'Ping Role', value: `<@&${pingRole.id}>`, inline: true });
    }

    await interaction.editReply({ embeds: [confirmEmbed] });

    logger.info(`[SetupTickets] ${interaction.user.tag} set up ticket system in ${guild.name}`);

  } catch (error) {
    logger.error('[SetupTickets] Error executing setuptickets command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while setting up the ticket system. Make sure the bot has the "Manage Channels" permission.',
    });
  }
}
