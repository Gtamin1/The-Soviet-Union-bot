/**
 * Audit logging system
 * Logs all important actions for security and tracking
 */

import prisma from '../db/client.js';
import { logger } from './logger.js';

/**
 * Log an action to the audit log
 * @param guildId - The guild/server ID
 * @param action - Type of action (e.g., "points_given", "promoted", "rank_set")
 * @param executorId - Discord ID of who performed the action (or "SYSTEM")
 * @param targetId - Discord ID or Roblox ID of the target
 * @param details - Additional details about the action (will be JSON stringified)
 */
export async function logAudit(
  guildId: string,
  action: string,
  executorId: string,
  targetId: string | null,
  details: Record<string, any>
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        guildId,
        action,
        executorId,
        targetId,
        details: JSON.stringify(details),
      },
    });
  } catch (error) {
    logger.error('Error logging audit:', error);
  }
}

/**
 * Get audit logs for a specific user
 * @param guildId - The guild ID
 * @param targetId - Discord ID or Roblox ID to filter by
 * @param limit - Max number of logs to return
 */
export async function getAuditLogsForUser(
  guildId: string,
  targetId: string,
  limit: number = 50
) {
  try {
    const logs = await prisma.auditLog.findMany({
      where: {
        guildId,
        targetId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    return logs.map(log => ({
      ...log,
      details: JSON.parse(log.details),
    }));
  } catch (error) {
    logger.error('Error getting audit logs:', error);
    return [];
  }
}

/**
 * Get recent audit logs for a guild
 * @param guildId - The guild ID
 * @param action - Optional action type to filter by
 * @param limit - Max number of logs to return
 */
export async function getRecentAuditLogs(
  guildId: string,
  action?: string,
  limit: number = 100
) {
  try {
    const logs = await prisma.auditLog.findMany({
      where: {
        guildId,
        ...(action && { action }),
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    return logs.map(log => ({
      ...log,
      details: JSON.parse(log.details),
    }));
  } catch (error) {
    logger.error('Error getting recent audit logs:', error);
    return [];
  }
}
