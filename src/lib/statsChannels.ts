/**
 * Stats Channel Updater
 * Auto-updates server stats voice channels every 5 minutes
 */

import { Client } from 'discord.js';
import prisma from '../db/client.js';
import { logger } from './logger.js';

let intervalId: NodeJS.Timeout | null = null;

/**
 * Start the stats updater
 * Should be called from the bot's ready event
 */
export function startStatsUpdater(client: Client): void {
  if (intervalId) {
    logger.warn('[StatsUpdater] Stats updater is already running');
    return;
  }

  logger.info('[StatsUpdater] Starting stats updater (runs every 5 minutes)');

  // Run immediately on start
  updateAllStats(client);

  // Then run every 5 minutes
  intervalId = setInterval(() => {
    updateAllStats(client);
  }, 300_000); // 5 minutes
}

/**
 * Stop the stats updater
 */
export function stopStatsUpdater(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('[StatsUpdater] Stopped stats updater');
  }
}

/**
 * Update stats for all guilds that have stats enabled
 */
async function updateAllStats(client: Client): Promise<void> {
  try {
    // Get all guilds with stats enabled
    const configs = await prisma.guildConfig.findMany({
      where: { statsEnabled: true },
    });

    if (configs.length === 0) {
      return;
    }

    logger.info(`[StatsUpdater] Updating stats for ${configs.length} guild(s)`);

    for (const config of configs) {
      try {
        await updateGuildStats(client, config);
      } catch (error) {
        logger.error(`[StatsUpdater] Error updating stats for guild ${config.guildId}:`, error);
      }
    }

  } catch (error) {
    logger.error('[StatsUpdater] Error in updateAllStats:', error);
  }
}

/**
 * Update stats for a single guild
 */
async function updateGuildStats(client: Client, config: any): Promise<void> {
  const guild = client.guilds.cache.get(config.guildId);
  if (!guild) {
    logger.warn(`[StatsUpdater] Guild ${config.guildId} not found in cache`);
    return;
  }

  // Get stats data
  const [verifiedCount, totalPoints, activeBans] = await Promise.all([
    prisma.user.count(),
    prisma.user.aggregate({ _sum: { points: true } }),
    prisma.ban.count({
      where: {
        guildId: guild.id,
        active: true,
      },
    }),
  ]);

  // Update Members channel
  if (config.statsMembersChannel) {
    try {
      const channel = await guild.channels.fetch(config.statsMembersChannel);
      if (channel && channel.isVoiceBased()) {
        const newName = `👥 Members: ${guild.memberCount}`;
        if (channel.name !== newName) {
          await channel.setName(newName);
        }
      }
    } catch (error: any) {
      if (error.code !== 10003) { // Ignore "Unknown Channel" errors
        logger.error(`[StatsUpdater] Error updating members channel:`, error);
      }
    }
  }

  // Update Verified channel
  if (config.statsVerifiedChannel) {
    try {
      const channel = await guild.channels.fetch(config.statsVerifiedChannel);
      if (channel && channel.isVoiceBased()) {
        const newName = `✅ Verified: ${verifiedCount}`;
        if (channel.name !== newName) {
          await channel.setName(newName);
        }
      }
    } catch (error: any) {
      if (error.code !== 10003) {
        logger.error(`[StatsUpdater] Error updating verified channel:`, error);
      }
    }
  }

  // Update In-Game channel (set to 0 for now, would need game API)
  if (config.statsInGameChannel) {
    try {
      const channel = await guild.channels.fetch(config.statsInGameChannel);
      if (channel && channel.isVoiceBased()) {
        const newName = `🎮 In-Game: 0`;
        if (channel.name !== newName) {
          await channel.setName(newName);
        }
      }
    } catch (error: any) {
      if (error.code !== 10003) {
        logger.error(`[StatsUpdater] Error updating in-game channel:`, error);
      }
    }
  }

  // Update Points channel
  if (config.statsPointsChannel) {
    try {
      const channel = await guild.channels.fetch(config.statsPointsChannel);
      if (channel && channel.isVoiceBased()) {
        const points = totalPoints._sum.points || 0;
        const newName = `⭐ Total Points: ${points}`;
        if (channel.name !== newName) {
          await channel.setName(newName);
        }
      }
    } catch (error: any) {
      if (error.code !== 10003) {
        logger.error(`[StatsUpdater] Error updating points channel:`, error);
      }
    }
  }

  // Update Bans channel
  if (config.statsBansChannel) {
    try {
      const channel = await guild.channels.fetch(config.statsBansChannel);
      if (channel && channel.isVoiceBased()) {
        const newName = `🔨 Active Bans: ${activeBans}`;
        if (channel.name !== newName) {
          await channel.setName(newName);
        }
      }
    } catch (error: any) {
      if (error.code !== 10003) {
        logger.error(`[StatsUpdater] Error updating bans channel:`, error);
      }
    }
  }

  logger.info(`[StatsUpdater] Updated stats for ${guild.name}`);
}
