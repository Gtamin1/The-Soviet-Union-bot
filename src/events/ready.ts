/**
 * Event handler for when the bot is ready
 * Starts interval systems for ban expiry, stats updates, and giveaways
 */

import { Client, Events } from 'discord.js';
import { logger } from '../lib/logger.js';
import { startBanExpiryChecker } from '../lib/banExpiry.js';
import { startStatsUpdater } from '../lib/statsChannels.js';
import { startGiveawayChecker } from '../lib/giveawayManager.js';

export const name = Events.ClientReady;
export const once = true;

export async function execute(client: Client) {
  logger.info(`Bot is ready! Logged in as ${client.user?.tag}`);
  logger.info(`Bot is in ${client.guilds.cache.size} servers`);

  // Set bot activity
  client.user?.setActivity('Roblox Verification', { type: 3 }); // 3 = Watching

  // Start interval systems
  try {
    startBanExpiryChecker(client);
    logger.info('✅ Started ban expiry checker');
  } catch (error) {
    logger.error('Failed to start ban expiry checker:', error);
  }

  try {
    startStatsUpdater(client);
    logger.info('✅ Started stats channel updater');
  } catch (error) {
    logger.error('Failed to start stats updater:', error);
  }

  try {
    startGiveawayChecker(client);
    logger.info('✅ Started giveaway checker');
  } catch (error) {
    logger.error('Failed to start giveaway checker:', error);
  }

  logger.info('🚀 All systems operational!');
}
