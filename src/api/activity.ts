/**
 * API endpoints for activity tracking
 */

import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import prisma from '../db/client.js';
import { requireApiKey } from './middleware.js';
import { logger } from '../lib/logger.js';

const router = Router();

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: 'Too many requests, please try again later' },
});

router.use(limiter);
router.use(requireApiKey);

/**
 * POST /api/activity/log
 * Log activity from a Roblox game
 */
router.post('/log', async (req, res) => {
  const { robloxId, activityType, value, metadata } = req.body;

  if (!robloxId || !activityType || value === undefined) {
    return res.status(400).json({ error: 'Missing required fields: robloxId, activityType, value' });
  }

  try {
    // Find user
    const user = await prisma.user.findUnique({
      where: { robloxId: robloxId.toString() },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found or not verified' });
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        activityType: activityType,
        value: parseFloat(value),
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });

    // Check if there's an activity config for automatic points
    const guildConfig = (req as any).guildConfig;
    const activityConfig = await prisma.activityConfig.findUnique({
      where: {
        guildId_activityType: {
          guildId: guildConfig.guildId,
          activityType: activityType,
        },
      },
    });

    if (activityConfig) {
      // Calculate points to award
      const pointsToAward = Math.floor(parseFloat(value) * activityConfig.pointsPerUnit);

      if (pointsToAward > 0) {
        // Update user points
        await prisma.user.update({
          where: { id: user.id },
          data: { points: { increment: pointsToAward } },
        });

        // Create transaction record
        await prisma.pointTransaction.create({
          data: {
            userId: user.id,
            amount: pointsToAward,
            reason: `Automatic points for ${activityType} activity`,
            type: 'add',
            source: 'activity',
          },
        });

        logger.info(`API: Awarded ${pointsToAward} points to ${user.robloxUsername} for ${activityType} activity`);

        return res.json({
          success: true,
          activityLogged: true,
          pointsAwarded: pointsToAward,
        });
      }
    }

    logger.info(`API: Logged ${activityType} activity for ${user.robloxUsername}`);

    return res.json({
      success: true,
      activityLogged: true,
      pointsAwarded: 0,
    });
  } catch (error) {
    logger.error('Error in /api/activity/log:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Command to set activity points configuration
 * This would be called via Discord command, not API
 */

export default router;
