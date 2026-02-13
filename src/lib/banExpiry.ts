/**
 * Ban Expiry Checker
 * Automatically unbans users when their temporary bans expire
 * Runs every 60 seconds
 */

import { Client } from 'discord.js';
import prisma from '../db/client.js';
import { logBanExpiry } from './modLogger.js';
import { logger } from './logger.js';

let intervalId: NodeJS.Timeout | null = null;

/**
 * Start the ban expiry checker
 * Should be called from the bot's ready event
 */
export function startBanExpiryChecker(client: Client): void {
  if (intervalId) {
    logger.warn('[BanExpiry] Ban expiry checker is already running');
    return;
  }

  logger.info('[BanExpiry] Starting ban expiry checker (runs every 60 seconds)');

  // Run immediately on start
  checkExpiredBans(client);

  // Then run every 60 seconds
  intervalId = setInterval(() => {
    checkExpiredBans(client);
  }, 60_000);
}

/**
 * Stop the ban expiry checker
 */
export function stopBanExpiryChecker(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('[BanExpiry] Stopped ban expiry checker');
  }
}

/**
 * Check for expired bans and unban users
 */
async function checkExpiredBans(client: Client): Promise<void> {
  try {
    // Find all bans that are active and have expired
    const expiredBans = await prisma.ban.findMany({
      where: {
        active: true,
        expiresAt: {
          not: null,
          lte: new Date(),
        },
      },
    });

    if (expiredBans.length === 0) {
      return; // No expired bans
    }

    logger.info(`[BanExpiry] Found ${expiredBans.length} expired ban(s) to process`);

    for (const ban of expiredBans) {
      try {
        // Mark ban as inactive
        await prisma.ban.update({
          where: { id: ban.id },
          data: {
            active: false,
            unbannedAt: new Date(),
            unbannedBy: 'Auto-Expiry',
            unbanReason: 'Ban duration expired',
          },
        });

        // Try to unban from Discord
        let unbannedFromDiscord = false;
        if (ban.discordId) {
          try {
            const guild = client.guilds.cache.get(ban.guildId);
            if (guild) {
              await guild.bans.remove(ban.discordId, 'Ban duration expired');
              unbannedFromDiscord = true;
              logger.info(`[BanExpiry] Unbanned ${ban.discordUsername || ban.discordId} from Discord (Ban #${ban.id})`);
            }
          } catch (error: any) {
            if (error.code === 10026) {
              // Unknown Ban - user was already unbanned manually
              logger.info(`[BanExpiry] User ${ban.discordId} was already unbanned manually (Ban #${ban.id})`);
            } else {
              logger.error(`[BanExpiry] Failed to unban ${ban.discordId} from Discord:`, error);
            }
          }
        }

        // Log the ban expiry
        await logBanExpiry(client, ban.guildId, {
          banId: ban.id,
          targetUsername: ban.discordUsername || ban.robloxUsername || 'Unknown',
          targetDiscordId: ban.discordId || undefined,
          targetRobloxId: ban.robloxId || undefined,
          originalReason: ban.reason,
          unbannedFromDiscord: unbannedFromDiscord,
        });

        logger.info(`[BanExpiry] Processed expired ban #${ban.id} for ${ban.discordUsername || ban.robloxUsername}`);

      } catch (error) {
        logger.error(`[BanExpiry] Error processing expired ban #${ban.id}:`, error);
      }
    }

  } catch (error) {
    logger.error('[BanExpiry] Error checking for expired bans:', error);
  }
}
