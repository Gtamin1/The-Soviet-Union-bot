/**
 * API endpoints for verification checks
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
 * GET /api/verify/:robloxId
 * Check if a user is verified
 * Returns Discord info if verified
 */
router.get('/:robloxId', async (req, res) => {
  const { robloxId } = req.params;

  try {
    const user = await prisma.user.findUnique({
      where: { robloxId: robloxId },
    });

    if (!user) {
      return res.json({
        success: true,
        verified: false,
        robloxId: robloxId,
      });
    }

    // Fetch Discord username from Discord ID
    let discordUsername = null;
    try {
      // We don't have access to the Discord client here,
      // so we'll return just the Discord ID
      // The Roblox game can display the ID
      discordUsername = user.discordId;
    } catch {
      discordUsername = user.discordId;
    }

    return res.json({
      success: true,
      verified: true,
      discordId: user.discordId,
      discordUsername: discordUsername,
      robloxUsername: user.robloxUsername,
      robloxId: user.robloxId,
      points: user.points,
    });
  } catch (error) {
    logger.error('Error in /api/verify/:robloxId:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
