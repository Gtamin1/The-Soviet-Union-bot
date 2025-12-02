/**
 * Anti-abuse and cooldown system
 * Prevents officers from abusing the points system
 */

import prisma from '../db/client.js';
import { logger } from './logger.js';

interface CooldownCheckResult {
  allowed: boolean;
  reason?: string;
  timeRemaining?: number;
}

/**
 * Check if an officer can give points to a specific user
 * Checks cooldown, daily limits, and max points per give
 */
export async function checkPointsAllowed(
  guildId: string,
  officerId: string,
  targetId: string,
  amount: number
): Promise<CooldownCheckResult> {
  try {
    // Get guild config
    const config = await prisma.guildConfig.findUnique({
      where: { guildId },
    });

    if (!config) {
      return { allowed: true };
    }

    // Check max points per give
    if (config.maxPointsPerGive && amount > config.maxPointsPerGive) {
      return {
        allowed: false,
        reason: `You can only give a maximum of ${config.maxPointsPerGive} points at once.`,
      };
    }

    // Check cooldown
    if (config.pointsCooldown && config.pointsCooldown > 0) {
      const cooldown = await prisma.pointCooldown.findUnique({
        where: {
          guildId_officerId_targetId: {
            guildId,
            officerId,
            targetId,
          },
        },
      });

      if (cooldown) {
        const now = new Date();
        const cooldownEnd = new Date(cooldown.lastGiven.getTime() + config.pointsCooldown * 1000);

        if (now < cooldownEnd) {
          const secondsRemaining = Math.ceil((cooldownEnd.getTime() - now.getTime()) / 1000);
          return {
            allowed: false,
            reason: `You must wait ${secondsRemaining} seconds before giving points to this user again.`,
            timeRemaining: secondsRemaining,
          };
        }
      }
    }

    // Check daily limit
    if (config.dailyPointsLimit && config.dailyPointsLimit > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const dailyRecord = await prisma.dailyPointsGiven.findUnique({
        where: {
          guildId_officerId_date: {
            guildId,
            officerId,
            date: today,
          },
        },
      });

      const totalGivenToday = dailyRecord?.totalGiven || 0;

      if (totalGivenToday + amount > config.dailyPointsLimit) {
        const remaining = config.dailyPointsLimit - totalGivenToday;
        return {
          allowed: false,
          reason: `You've reached your daily points limit. You have ${remaining} points remaining today.`,
        };
      }
    }

    return { allowed: true };
  } catch (error) {
    logger.error('Error checking points allowed:', error);
    // In case of error, allow the operation but log it
    return { allowed: true };
  }
}

/**
 * Record that points were given (for cooldown and daily limit tracking)
 */
export async function recordPointsGiven(
  guildId: string,
  officerId: string,
  targetId: string,
  amount: number
): Promise<void> {
  try {
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Update or create cooldown record
    await prisma.pointCooldown.upsert({
      where: {
        guildId_officerId_targetId: {
          guildId,
          officerId,
          targetId,
        },
      },
      update: {
        lastGiven: now,
      },
      create: {
        guildId,
        officerId,
        targetId,
        lastGiven: now,
      },
    });

    // Update or create daily points record
    await prisma.dailyPointsGiven.upsert({
      where: {
        guildId_officerId_date: {
          guildId,
          officerId,
          date: today,
        },
      },
      update: {
        totalGiven: {
          increment: amount,
        },
      },
      create: {
        guildId,
        officerId,
        date: today,
        totalGiven: amount,
      },
    });
  } catch (error) {
    logger.error('Error recording points given:', error);
  }
}

/**
 * Get how many points an officer has given today
 */
export async function getPointsGivenToday(
  guildId: string,
  officerId: string
): Promise<number> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const record = await prisma.dailyPointsGiven.findUnique({
      where: {
        guildId_officerId_date: {
          guildId,
          officerId,
          date: today,
        },
      },
    });

    return record?.totalGiven || 0;
  } catch (error) {
    logger.error('Error getting points given today:', error);
    return 0;
  }
}

/**
 * Get top officers by points given in a time period
 */
export async function getTopOfficers(
  guildId: string,
  days: number = 7,
  limit: number = 10
) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const records = await prisma.dailyPointsGiven.findMany({
      where: {
        guildId,
        date: {
          gte: startDate,
        },
      },
    });

    // Group by officer and sum points
    const officerTotals: Record<string, number> = {};
    for (const record of records) {
      officerTotals[record.officerId] = (officerTotals[record.officerId] || 0) + record.totalGiven;
    }

    // Convert to array and sort
    const sorted = Object.entries(officerTotals)
      .map(([officerId, total]) => ({ officerId, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, limit);

    return sorted;
  } catch (error) {
    logger.error('Error getting top officers:', error);
    return [];
  }
}
