/**
 * Giveaway Manager
 * Automatically ends giveaways and picks winners
 * Runs every 30 seconds
 */

import { Client, EmbedBuilder } from 'discord.js';
import prisma from '../db/client.js';
import { logger } from './logger.js';

let intervalId: NodeJS.Timeout | null = null;

/**
 * Start the giveaway checker
 * Should be called from the bot's ready event
 */
export function startGiveawayChecker(client: Client): void {
  if (intervalId) {
    logger.warn('[GiveawayManager] Giveaway checker is already running');
    return;
  }

  logger.info('[GiveawayManager] Starting giveaway checker (runs every 30 seconds)');

  // Run immediately on start
  checkGiveaways(client);

  // Then run every 30 seconds
  intervalId = setInterval(() => {
    checkGiveaways(client);
  }, 30_000);
}

/**
 * Stop the giveaway checker
 */
export function stopGiveawayChecker(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('[GiveawayManager] Stopped giveaway checker');
  }
}

/**
 * Check for ended giveaways and pick winners
 */
async function checkGiveaways(client: Client): Promise<void> {
  try {
    // Find giveaways that have ended but not processed
    const endedGiveaways = await prisma.giveaway.findMany({
      where: {
        ended: false,
        endsAt: {
          lte: new Date(),
        },
      },
    });

    if (endedGiveaways.length === 0) {
      return;
    }

    logger.info(`[GiveawayManager] Found ${endedGiveaways.length} ended giveaway(s) to process`);

    for (const giveaway of endedGiveaways) {
      try {
        await endGiveaway(client, giveaway);
      } catch (error) {
        logger.error(`[GiveawayManager] Error ending giveaway #${giveaway.id}:`, error);
      }
    }

  } catch (error) {
    logger.error('[GiveawayManager] Error checking giveaways:', error);
  }
}

/**
 * End a giveaway and pick winners
 */
async function endGiveaway(client: Client, giveaway: any): Promise<void> {
  try {
    // Get the channel and message
    const guild = client.guilds.cache.get(giveaway.guildId);
    if (!guild) {
      logger.warn(`[GiveawayManager] Guild ${giveaway.guildId} not found`);
      return;
    }

    const channel = await guild.channels.fetch(giveaway.channelId);
    if (!channel || !channel.isTextBased()) {
      logger.warn(`[GiveawayManager] Channel ${giveaway.channelId} not found or not text-based`);
      return;
    }

    const message = await channel.messages.fetch(giveaway.messageId);
    if (!message) {
      logger.warn(`[GiveawayManager] Message ${giveaway.messageId} not found`);
      return;
    }

    // Note: In a full implementation, you'd track button clicks in a database table
    // For this simplified version, we'll use the 🎉 reaction as a fallback
    let participants: string[] = [];

    // Try to get reaction users
    try {
      const reaction = message.reactions.cache.get('🎉');
      if (reaction) {
        const users = await reaction.users.fetch();
        participants = users.filter(u => !u.bot).map(u => u.id);
      }
    } catch {}

    if (participants.length === 0) {
      // No participants
      const noWinnerEmbed = EmbedBuilder.from(message.embeds[0])
        .setTitle('🎉 GIVEAWAY ENDED')
        .setDescription(`**Prize:** ${giveaway.prize}\n\n❌ No valid participants!\nGiveaway ended with no winners.`)
        .setColor(0xed4245);

      await message.edit({ embeds: [noWinnerEmbed], components: [] });

      await prisma.giveaway.update({
        where: { id: giveaway.id },
        data: {
          ended: true,
          winners: [],
        },
      });

      logger.info(`[GiveawayManager] Ended giveaway #${giveaway.id} with no participants`);
      return;
    }

    // Pick random winners
    const winnerCount = Math.min(giveaway.winnersCount, participants.length);
    const winners: string[] = [];

    for (let i = 0; i < winnerCount; i++) {
      const randomIndex = Math.floor(Math.random() * participants.length);
      winners.push(participants[randomIndex]);
      participants.splice(randomIndex, 1);
    }

    // Update embed
    const winnerMentions = winners.map(id => `<@${id}>`).join(', ');

    const winnerEmbed = EmbedBuilder.from(message.embeds[0])
      .setTitle('🎉 GIVEAWAY ENDED')
      .setDescription(`**Prize:** ${giveaway.prize}\n\n🎊 **Winner${winners.length > 1 ? 's' : ''}:** ${winnerMentions}`)
      .setColor(0x57f287);

    await message.edit({ embeds: [winnerEmbed], components: [] });

    // Announce winners
    await channel.send(`🎉 Congratulations ${winnerMentions}! You won **${giveaway.prize}**!`);

    // Update database
    await prisma.giveaway.update({
      where: { id: giveaway.id },
      data: {
        ended: true,
        winners: winners,
      },
    });

    logger.info(`[GiveawayManager] Ended giveaway #${giveaway.id} with ${winners.length} winner(s)`);

  } catch (error) {
    logger.error(`[GiveawayManager] Error ending giveaway #${giveaway.id}:`, error);
  }
}
