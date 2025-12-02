/**
 * Middleware for API authentication
 */

import { Request, Response, NextFunction } from 'express';
import prisma from '../db/client.js';
import { logger } from '../lib/logger.js';

export async function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.body.apiKey || req.query.apiKey;

  if (!apiKey) {
    return res.status(401).json({ error: 'API key is required' });
  }

  try {
    // Find guild with this API key
    const config = await prisma.guildConfig.findFirst({
      where: { apiKey: apiKey as string },
    });

    if (!config) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    // Attach guild config to request
    (req as any).guildConfig = config;

    next();
  } catch (error) {
    logger.error('Error in API key middleware:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
