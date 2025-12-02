/**
 * Roblox Ranking API utilities
 * Handles promoting/demoting users in Roblox groups
 *
 * SECURITY NOTE: This uses the .ROBLOSECURITY cookie which gives full account access.
 * The cookie is encrypted in the database and should NEVER be logged or exposed.
 */

import { decrypt } from './encryption.js';
import { logger } from './logger.js';

interface RankChangeResult {
  success: boolean;
  newRank?: number;
  newRankName?: string;
  error?: string;
}

/**
 * Get X-CSRF-TOKEN needed for Roblox API requests
 * This is required for all POST/PATCH/DELETE requests
 */
async function getCsrfToken(cookie: string): Promise<string | null> {
  try {
    const response = await fetch('https://auth.roblox.com/v1/authentication-ticket', {
      method: 'POST',
      headers: {
        'Cookie': `.ROBLOSECURITY=${cookie}`,
      },
    });

    const csrfToken = response.headers.get('x-csrf-token');
    return csrfToken;
  } catch (error) {
    logger.error('Error getting CSRF token:', error);
    return null;
  }
}

/**
 * Set a user's rank in a Roblox group
 * @param groupId - The Roblox group ID
 * @param userId - The Roblox user ID
 * @param rankId - The rank number to set (1-255)
 * @param encryptedCookie - The encrypted .ROBLOSECURITY cookie
 */
export async function setUserRank(
  groupId: string | number,
  userId: string | number,
  rankId: number,
  encryptedCookie: string
): Promise<RankChangeResult> {
  try {
    // Decrypt the cookie
    const cookie = decrypt(encryptedCookie);

    // Get CSRF token
    const csrfToken = await getCsrfToken(cookie);
    if (!csrfToken) {
      return {
        success: false,
        error: 'Failed to get CSRF token. Cookie may be expired or invalid.',
      };
    }

    // Make the ranking request
    const response = await fetch(
      `https://groups.roblox.com/v1/groups/${groupId}/users/${userId}`,
      {
        method: 'PATCH',
        headers: {
          'Cookie': `.ROBLOSECURITY=${cookie}`,
          'X-CSRF-TOKEN': csrfToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roleId: rankId,
        }),
      }
    );

    if (response.status === 403) {
      // Try one more time - sometimes CSRF token needs refresh
      const newCsrfToken = response.headers.get('x-csrf-token');
      if (newCsrfToken) {
        const retryResponse = await fetch(
          `https://groups.roblox.com/v1/groups/${groupId}/users/${userId}`,
          {
            method: 'PATCH',
            headers: {
              'Cookie': `.ROBLOSECURITY=${cookie}`,
              'X-CSRF-TOKEN': newCsrfToken,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              roleId: rankId,
            }),
          }
        );

        if (!retryResponse.ok) {
          const errorData = await retryResponse.json().catch(() => ({}));
          return {
            success: false,
            error: errorData.errors?.[0]?.message || 'Failed to set rank after retry',
          };
        }

        return { success: true };
      }

      return {
        success: false,
        error: 'Permission denied. The bot account may not have permission to rank this user.',
      };
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.errors?.[0]?.message || `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    return { success: true };
  } catch (error: any) {
    logger.error('Error setting user rank:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred',
    };
  }
}

/**
 * Promote a user to the next rank
 * @param groupId - The Roblox group ID
 * @param userId - The Roblox user ID
 * @param currentRank - User's current rank number
 * @param encryptedCookie - The encrypted .ROBLOSECURITY cookie
 */
export async function promoteUser(
  groupId: string | number,
  userId: string | number,
  currentRank: number,
  encryptedCookie: string
): Promise<RankChangeResult> {
  try {
    // Get all roles in the group
    const rolesResponse = await fetch(
      `https://groups.roblox.com/v1/groups/${groupId}/roles`
    );

    if (!rolesResponse.ok) {
      return {
        success: false,
        error: 'Failed to fetch group roles',
      };
    }

    const rolesData = await rolesResponse.json();
    const roles = rolesData.roles || [];

    // Sort by rank
    roles.sort((a: any, b: any) => a.rank - b.rank);

    // Find next rank
    const currentRoleIndex = roles.findIndex((r: any) => r.rank === currentRank);
    if (currentRoleIndex === -1) {
      return {
        success: false,
        error: 'Current rank not found in group',
      };
    }

    if (currentRoleIndex === roles.length - 1) {
      return {
        success: false,
        error: 'User is already at the highest rank',
      };
    }

    const nextRole = roles[currentRoleIndex + 1];

    // Set the new rank
    const result = await setUserRank(groupId, userId, nextRole.id, encryptedCookie);

    if (result.success) {
      return {
        success: true,
        newRank: nextRole.rank,
        newRankName: nextRole.name,
      };
    }

    return result;
  } catch (error: any) {
    logger.error('Error promoting user:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred',
    };
  }
}

/**
 * Demote a user to the previous rank
 * @param groupId - The Roblox group ID
 * @param userId - The Roblox user ID
 * @param currentRank - User's current rank number
 * @param encryptedCookie - The encrypted .ROBLOSECURITY cookie
 */
export async function demoteUser(
  groupId: string | number,
  userId: string | number,
  currentRank: number,
  encryptedCookie: string
): Promise<RankChangeResult> {
  try {
    // Get all roles in the group
    const rolesResponse = await fetch(
      `https://groups.roblox.com/v1/groups/${groupId}/roles`
    );

    if (!rolesResponse.ok) {
      return {
        success: false,
        error: 'Failed to fetch group roles',
      };
    }

    const rolesData = await rolesResponse.json();
    const roles = rolesData.roles || [];

    // Sort by rank
    roles.sort((a: any, b: any) => a.rank - b.rank);

    // Find previous rank
    const currentRoleIndex = roles.findIndex((r: any) => r.rank === currentRank);
    if (currentRoleIndex === -1) {
      return {
        success: false,
        error: 'Current rank not found in group',
      };
    }

    if (currentRoleIndex === 0) {
      return {
        success: false,
        error: 'User is already at the lowest rank',
      };
    }

    const previousRole = roles[currentRoleIndex - 1];

    // Set the new rank
    const result = await setUserRank(groupId, userId, previousRole.id, encryptedCookie);

    if (result.success) {
      return {
        success: true,
        newRank: previousRole.rank,
        newRankName: previousRole.name,
      };
    }

    return result;
  } catch (error: any) {
    logger.error('Error demoting user:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred',
    };
  }
}

/**
 * Get a specific role by rank number
 * @param groupId - The Roblox group ID
 * @param rankNumber - The rank number (1-255)
 */
export async function getRoleByRank(
  groupId: string | number,
  rankNumber: number
): Promise<{ id: number; name: string; rank: number } | null> {
  try {
    const response = await fetch(`https://groups.roblox.com/v1/groups/${groupId}/roles`);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const roles = data.roles || [];

    return roles.find((r: any) => r.rank === rankNumber) || null;
  } catch (error) {
    logger.error('Error getting role by rank:', error);
    return null;
  }
}

/**
 * Test if a cookie is valid
 * @param encryptedCookie - The encrypted .ROBLOSECURITY cookie
 */
export async function testCookie(encryptedCookie: string): Promise<boolean> {
  try {
    const cookie = decrypt(encryptedCookie);

    const response = await fetch('https://users.roblox.com/v1/users/authenticated', {
      method: 'GET',
      headers: {
        'Cookie': `.ROBLOSECURITY=${cookie}`,
      },
    });

    return response.ok;
  } catch (error) {
    logger.error('Error testing cookie:', error);
    return false;
  }
}
