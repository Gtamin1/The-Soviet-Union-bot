/**
 * Event handler for when the bot is ready
 */

import { Client, Events } from 'discord.js';
import { logger } from '../lib/logger.js';

export const name = Events.ClientReady;
export const once = true;

export async function execute(client: Client) {
  logger.info(`Bot is ready! Logged in as ${client.user?.tag}`);
  logger.info(`Bot is in ${client.guilds.cache.size} servers`);

  // Set bot activity
  client.user?.setActivity('Roblox Verification', { type: 3 }); // 3 = Watching
}
