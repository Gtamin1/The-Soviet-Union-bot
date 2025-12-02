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

    return res.json({
      success: true,
      verified: true,
      user: {
        robloxId: user.robloxId,
        robloxUsername: user.robloxUsername,
        discordId: user.discordId,
        verifiedAt: user.verifiedAt,
      },
    });
  } catch (error) {
    logger.error('Error in /api/verify/:robloxId:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
