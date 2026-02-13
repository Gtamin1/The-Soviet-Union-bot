/**
 * Event handler for interactions (slash commands, buttons, etc.)
 */

import { Events, Interaction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } from 'discord.js';
import prisma from '../db/client.js';
import { logger } from '../lib/logger.js';

interface ExtendedClient {
  commands: Map<string, any>;
}

export const name = Events.InteractionCreate;

export async function execute(interaction: Interaction) {
  // Handle slash commands
  if (interaction.isChatInputCommand()) {
    const client = interaction.client as unknown as ExtendedClient;
    const command = client.commands.get(interaction.commandName);

    if (!command) {
      logger.warn(`No command matching ${interaction.commandName} was found.`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      logger.error(`Error executing ${interaction.commandName}:`, error);

      const errorMessage = {
        content: 'There was an error while executing this command!',
        ephemeral: true,
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
    return;
  }

  // Handle button interactions
  if (interaction.isButton()) {
    try {
      const customId = interaction.customId;

      // Ticket system buttons
      if (customId === 'ticket_open') {
        await handleTicketOpen(interaction);
      } else if (customId.startsWith('ticket_close_')) {
        await handleTicketClose(interaction);
      } else if (customId.startsWith('ticket_claim_')) {
        await handleTicketClaim(interaction);
      }
      // Pagination buttons
      else if (customId.startsWith('banlist_')) {
        await handleBanlistPagination(interaction);
      } else if (customId.startsWith('modlogs_')) {
        await handleModlogsPagination(interaction);
      } else if (customId.startsWith('warnings_')) {
        await handleWarningsPagination(interaction);
      }
    } catch (error) {
      logger.error('Error handling button interaction:', error);

      const errorMessage = {
        content: '❌ An error occurred while processing this button.',
        ephemeral: true,
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  }
}

/**
 * Handle ticket open button
 */
async function handleTicketOpen(interaction: any) {
  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild!;
  const user = interaction.user;

  // Check if user already has an open ticket
  const existingTicket = await prisma.ticket.findFirst({
    where: {
      guildId: guild.id,
      authorDiscordId: user.id,
      status: { in: ['open', 'claimed'] },
    },
  });

  if (existingTicket) {
    return interaction.editReply({
      content: `❌ You already have an open ticket: <#${existingTicket.channelId}>`,
    });
  }

  // Get config
  const config = await prisma.guildConfig.findUnique({
    where: { guildId: guild.id },
  });

  if (!config?.ticketCategoryId) {
    return interaction.editReply({
      content: '❌ Ticket system is not configured.',
    });
  }

  // Create ticket channel
  const ticketChannel = await guild.channels.create({
    name: `ticket-${user.username}-${Date.now()}`,
    type: ChannelType.GuildText,
    parent: config.ticketCategoryId,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: user.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
      },
      {
        id: guild.members.me!.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels],
      },
    ],
  });

  // Create ticket in database
  const ticket = await prisma.ticket.create({
    data: {
      guildId: guild.id,
      channelId: ticketChannel.id,
      authorDiscordId: user.id,
      authorUsername: user.tag,
      status: 'open',
    },
  });

  // Send intro message
  const introEmbed = new EmbedBuilder()
    .setTitle('🎫 Support Ticket')
    .setDescription(`Hello ${user}!\n\nThank you for creating a ticket. Please describe your issue and our team will assist you shortly.`)
    .setColor(0x5865f2)
    .setTimestamp();

  const buttons = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket_claim_${ticket.id}`)
        .setLabel('🙋 Claim Ticket')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`ticket_close_${ticket.id}`)
        .setLabel('🔒 Close Ticket')
        .setStyle(ButtonStyle.Danger)
    );

  let pingMessage = '';
  if (config.ticketPingRoleId) {
    pingMessage = `<@&${config.ticketPingRoleId}>`;
  }

  await ticketChannel.send({
    content: pingMessage,
    embeds: [introEmbed],
    components: [buttons],
  });

  await interaction.editReply({
    content: `✅ Ticket created: ${ticketChannel}`,
  });

  logger.info(`[Ticket] ${user.tag} opened ticket #${ticket.id} in ${guild.name}`);
}

/**
 * Handle ticket close button
 */
async function handleTicketClose(interaction: any) {
  await interaction.deferReply();

  const ticketId = parseInt(interaction.customId.split('_')[2]);

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
  });

  if (!ticket) {
    return interaction.editReply({ content: '❌ Ticket not found.' });
  }

  if (ticket.status === 'closed') {
    return interaction.editReply({ content: '❌ This ticket is already closed.' });
  }

  // Update ticket
  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      status: 'closed',
      closedBy: interaction.user.tag,
      closedAt: new Date(),
    },
  });

  const embed = new EmbedBuilder()
    .setTitle('🔒 Ticket Closed')
    .setDescription(`This ticket has been closed by ${interaction.user}.`)
    .setColor(0xed4245)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });

  // Delete channel after 5 seconds
  setTimeout(async () => {
    try {
      const channel = await interaction.guild!.channels.fetch(ticket.channelId);
      if (channel) {
        await channel.delete();
      }
    } catch (error) {
      logger.error('Error deleting ticket channel:', error);
    }
  }, 5000);

  logger.info(`[Ticket] ${interaction.user.tag} closed ticket #${ticketId}`);
}

/**
 * Handle ticket claim button
 */
async function handleTicketClaim(interaction: any) {
  await interaction.deferReply();

  const ticketId = parseInt(interaction.customId.split('_')[2]);

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
  });

  if (!ticket) {
    return interaction.editReply({ content: '❌ Ticket not found.' });
  }

  if (ticket.claimedBy) {
    return interaction.editReply({ content: `❌ This ticket has already been claimed by ${ticket.claimedBy}.` });
  }

  // Update ticket
  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      status: 'claimed',
      claimedBy: interaction.user.tag,
    },
  });

  const embed = new EmbedBuilder()
    .setTitle('🙋 Ticket Claimed')
    .setDescription(`This ticket has been claimed by ${interaction.user}.`)
    .setColor(0x57f287)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });

  logger.info(`[Ticket] ${interaction.user.tag} claimed ticket #${ticketId}`);
}

/**
 * Handle pagination buttons (banlist, modlogs, warnings)
 */
async function handleBanlistPagination(interaction: any) {
  await interaction.deferUpdate();
  // Pagination logic would go here - simplified for now
  await interaction.editReply({ content: '⚠️ Pagination not yet implemented for banlist.' });
}

async function handleModlogsPagination(interaction: any) {
  await interaction.deferUpdate();
  await interaction.editReply({ content: '⚠️ Pagination not yet implemented for modlogs.' });
}

async function handleWarningsPagination(interaction: any) {
  await interaction.deferUpdate();
  await interaction.editReply({ content: '⚠️ Pagination not yet implemented for warnings.' });
}
