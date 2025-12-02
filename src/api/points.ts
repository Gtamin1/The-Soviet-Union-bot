/**
 * API endpoints for points management
 */

import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import prisma from '../db/client.js';
import { requireApiKey } from './middleware.js';
import { logger } from '../lib/logger.js';

const router = Router();

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: { error: 'Too many requests, please try again later' },
});

router.use(limiter);
router.use(requireApiKey);

/**
 * POST /api/points/give
 * Give points to a user from a Roblox game
 */
router.post('/give', async (req, res) => {
  const { robloxId, amount, reason, givenBy } = req.body;

  if (!robloxId || !amount || !reason) {
    return res.status(400).json({ error: 'Missing required fields: robloxId, amount, reason' });
  }

  if (amount <= 0) {
    return res.status(400).json({ error: 'Amount must be positive' });
  }

  try {
    // Find user
    const user = await prisma.user.findUnique({
      where: { robloxId: robloxId.toString() },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found or not verified' });
    }

    // Update points
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { points: { increment: amount } },
    });

    // Create transaction record
    await prisma.pointTransaction.create({
      data: {
        userId: user.id,
        amount: amount,
        reason: reason,
        givenByRobloxId: givenBy ? givenBy.toString() : null,
        type: 'add',
        source: 'api',
      },
    });

    logger.info(`API: Gave ${amount} points to ${user.robloxUsername} (${robloxId})`);

    return res.json({
      success: true,
      user: {
        robloxId: user.robloxId,
        robloxUsername: user.robloxUsername,
        points: updatedUser.points,
      },
    });
  } catch (error) {
    logger.error('Error in /api/points/give:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/points/remove
 * Remove points from a user from a Roblox game
 */
router.post('/remove', async (req, res) => {
  const { robloxId, amount, reason, removedBy } = req.body;

  if (!robloxId || !amount || !reason) {
    return res.status(400).json({ error: 'Missing required fields: robloxId, amount, reason' });
  }

  if (amount <= 0) {
    return res.status(400).json({ error: 'Amount must be positive' });
  }

  try {
    // Find user
    const user = await prisma.user.findUnique({
      where: { robloxId: robloxId.toString() },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found or not verified' });
    }

    // Update points (don't go below 0)
    let newPoints = Math.max(0, user.points - amount);

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { points: newPoints },
    });

    // Create transaction record
    await prisma.pointTransaction.create({
      data: {
        userId: user.id,
        amount: amount,
        reason: reason,
        givenByRobloxId: removedBy ? removedBy.toString() : null,
        type: 'remove',
        source: 'api',
      },
    });

    logger.info(`API: Removed ${amount} points from ${user.robloxUsername} (${robloxId})`);

    return res.json({
      success: true,
      user: {
        robloxId: user.robloxId,
        robloxUsername: user.robloxUsername,
        points: updatedUser.points,
      },
    });
  } catch (error) {
    logger.error('Error in /api/points/remove:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/points/:robloxId
 * Get a user's points
 * Returns 0 points if user not verified (for Roblox game compatibility)
 */
router.get('/:robloxId', async (req, res) => {
  const { robloxId } = req.params;

  try {
    const user = await prisma.user.findUnique({
      where: { robloxId: robloxId },
    });

    if (!user) {
      // Return 0 points for unverified users (game expects this)
      return res.json({
        success: true,
        points: 0,
        verified: false,
      });
    }

    return res.json({
      success: true,
      points: user.points,
      verified: true,
      robloxUsername: user.robloxUsername,
      discordId: user.discordId,
    });
  } catch (error) {
    logger.error('Error in /api/points/:robloxId:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
