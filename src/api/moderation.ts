/**
 * API endpoints for moderation system
 * Used by Roblox game to check bans and process kicks
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
  max: 300,
  message: { error: 'Too many requests, please try again later' },
});

router.use(limiter);
router.use(requireApiKey);

/**
 * GET /api/moderation/check/:robloxId
 * Check if a user is banned
 * Returns ban status and details
 */
router.get('/check/:robloxId', async (req, res) => {
  const { robloxId } = req.params;

  if (!robloxId) {
    return res.status(400).json({ error: 'Missing robloxId parameter' });
  }

  try {
    // Find active ban for this Roblox user
    const ban = await prisma.ban.findFirst({
      where: {
        robloxId: robloxId.toString(),
        active: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!ban) {
      return res.json({
        banned: false,
        banReason: null,
        banExpires: null,
        permanent: false,
      });
    }

    // Check if ban has expired
    if (ban.expiresAt && ban.expiresAt <= new Date()) {
      // Ban expired, mark as inactive
      await prisma.ban.update({
        where: { id: ban.id },
        data: {
          active: false,
          unbannedAt: new Date(),
        },
      });

      return res.json({
        banned: false,
        banReason: null,
        banExpires: null,
        permanent: false,
      });
    }

    return res.json({
      banned: true,
      banReason: ban.reason,
      banExpires: ban.expiresAt ? ban.expiresAt.toISOString() : null,
      permanent: ban.expiresAt === null,
      banId: ban.id,
    });

  } catch (error) {
    logger.error('[API] Error in /api/moderation/check/:robloxId:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/moderation/kick
 * Queue a kick for a Roblox user
 * Body: { robloxId: string, reason: string }
 */
router.post('/kick', async (req, res) => {
  const { robloxId, reason } = req.body;

  if (!robloxId || !reason) {
    return res.status(400).json({ error: 'Missing required fields: robloxId, reason' });
  }

  try {
    await prisma.pendingKick.create({
      data: {
        robloxId: robloxId.toString(),
        reason: reason,
      },
    });

    logger.info(`[API] Queued kick for Roblox user ${robloxId}`);

    return res.json({
      success: true,
      message: 'Kick queued successfully',
    });

  } catch (error) {
    logger.error('[API] Error in /api/moderation/kick:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/moderation/pending-kicks
 * Get all pending kicks that haven't been delivered yet
 * Returns array of kicks and marks them as delivered
 */
router.get('/pending-kicks', async (req, res) => {
  try {
    // Get undelivered kicks
    const kicks = await prisma.pendingKick.findMany({
      where: { delivered: false },
      orderBy: { createdAt: 'asc' },
    });

    if (kicks.length === 0) {
      return res.json({ kicks: [] });
    }

    // Mark as delivered
    const kickIds = kicks.map(k => k.id);
    await prisma.pendingKick.updateMany({
      where: { id: { in: kickIds } },
      data: { delivered: true },
    });

    logger.info(`[API] Delivered ${kicks.length} pending kicks to game`);

    return res.json({
      kicks: kicks.map(k => ({
        id: k.id,
        robloxId: k.robloxId,
        reason: k.reason,
      })),
    });

  } catch (error) {
    logger.error('[API] Error in /api/moderation/pending-kicks:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/moderation/kick-confirm
 * Confirm that a kick was executed successfully in-game
 * Body: { robloxId: string }
 * Deletes the PendingKick record
 */
router.post('/kick-confirm', async (req, res) => {
  const { robloxId } = req.body;

  if (!robloxId) {
    return res.status(400).json({ error: 'Missing required field: robloxId' });
  }

  try {
    // Find and delete the pending kick
    const deleted = await prisma.pendingKick.deleteMany({
      where: {
        robloxId: robloxId.toString(),
        delivered: true,
      },
    });

    if (deleted.count === 0) {
      return res.status(404).json({ error: 'No pending kick found for this user' });
    }

    logger.info(`[API] Confirmed kick execution for Roblox user ${robloxId}`);

    return res.json({
      success: true,
      message: 'Kick confirmed',
    });

  } catch (error) {
    logger.error('[API] Error in /api/moderation/kick-confirm:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/moderation/bans
 * Get all active bans (for game reference)
 * Optional query params: page, limit
 */
router.get('/bans', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const skip = (page - 1) * limit;

    const [bans, total] = await Promise.all([
      prisma.ban.findMany({
        where: { active: true },
        select: {
          id: true,
          robloxId: true,
          robloxUsername: true,
          reason: true,
          expiresAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: skip,
        take: limit,
      }),
      prisma.ban.count({ where: { active: true } }),
    ]);

    return res.json({
      bans: bans,
      page: page,
      limit: limit,
      total: total,
      totalPages: Math.ceil(total / limit),
    });

  } catch (error) {
    logger.error('[API] Error in /api/moderation/bans:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
