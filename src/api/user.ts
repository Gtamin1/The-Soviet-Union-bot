/**
 * API endpoints for user information
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
 * GET /api/user/:robloxId
 * Get user information
 */
router.get('/:robloxId', async (req, res) => {
  const { robloxId } = req.params;

  try {
    const user = await prisma.user.findUnique({
      where: { robloxId: robloxId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found or not verified' });
    }

    // Get recent transactions
    const recentTransactions = await prisma.pointTransaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Calculate weekly and monthly points
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const weeklyTransactions = await prisma.pointTransaction.findMany({
      where: {
        userId: user.id,
        createdAt: { gte: weekAgo },
      },
    });

    const monthlyTransactions = await prisma.pointTransaction.findMany({
      where: {
        userId: user.id,
        createdAt: { gte: monthAgo },
      },
    });

    const weeklyPoints = weeklyTransactions.reduce((sum, t) => {
      return sum + (t.type === 'add' ? t.amount : -t.amount);
    }, 0);

    const monthlyPoints = monthlyTransactions.reduce((sum, t) => {
      return sum + (t.type === 'add' ? t.amount : -t.amount);
    }, 0);

    return res.json({
      success: true,
      user: {
        robloxId: user.robloxId,
        robloxUsername: user.robloxUsername,
        discordId: user.discordId,
        points: user.points,
        pointsThisWeek: weeklyPoints,
        pointsThisMonth: monthlyPoints,
        verifiedAt: user.verifiedAt,
        recentTransactions: recentTransactions.map(t => ({
          amount: t.amount,
          type: t.type,
          reason: t.reason,
          source: t.source,
          createdAt: t.createdAt,
        })),
      },
    });
  } catch (error) {
    logger.error('Error in /api/user/:robloxId:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
