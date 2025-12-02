/**
 * Roblox API wrapper
 * Handles all interactions with Roblox APIs
 */

interface RobloxUser {
  id: number;
  name: string;
  displayName: string;
  description: string;
  created: string;
}

interface RobloxGroupRole {
  group: {
    id: number;
    name: string;
  };
  role: {
    id: number;
    name: string;
    rank: number;
  };
}

/**
 * Get a Roblox user by their username
 */
export async function getRobloxUserByUsername(username: string): Promise<RobloxUser | null> {
  try {
    const response = await fetch('https://users.roblox.com/v1/usernames/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        usernames: [username],
        excludeBannedUsers: false,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (!data.data || data.data.length === 0) {
      return null;
    }

    const userId = data.data[0].id;
    return await getRobloxUserById(userId);
  } catch (error) {
    console.error('Error fetching Roblox user by username:', error);
    return null;
  }
}

/**
 * Get a Roblox user by their user ID
 */
export async function getRobloxUserById(userId: number | string): Promise<RobloxUser | null> {
  try {
    const response = await fetch(`https://users.roblox.com/v1/users/${userId}`);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching Roblox user by ID:', error);
    return null;
  }
}

/**
 * Check if a Roblox user's bio contains a specific code
 */
export async function checkBioForCode(userId: number | string, code: string): Promise<boolean> {
  const user = await getRobloxUserById(userId);
  if (!user) return false;

  return user.description.includes(code);
}

/**
 * Get all groups a Roblox user is in and their ranks
 */
export async function getUserGroups(userId: number | string): Promise<RobloxGroupRole[]> {
  try {
    const response = await fetch(`https://groups.roblox.com/v2/users/${userId}/groups/roles`);

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching user groups:', error);
    return [];
  }
}

/**
 * Get a user's rank in a specific group
 */
export async function getUserRankInGroup(userId: number | string, groupId: number | string): Promise<{ rank: number; roleName: string } | null> {
  const groups = await getUserGroups(userId);
  const group = groups.find(g => g.group.id.toString() === groupId.toString());

  if (!group) return null;

  return {
    rank: group.role.rank,
    roleName: group.role.name,
  };
}

/**
 * Check if a user is in a specific group
 */
export async function isUserInGroup(userId: number | string, groupId: number | string): Promise<boolean> {
  const groups = await getUserGroups(userId);
  return groups.some(g => g.group.id.toString() === groupId.toString());
}

/**
 * Get all roles in a group
 */
export async function getGroupRoles(groupId: number | string): Promise<Array<{ id: number; name: string; rank: number }>> {
  try {
    const response = await fetch(`https://groups.roblox.com/v1/groups/${groupId}/roles`);

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.roles || [];
  } catch (error) {
    console.error('Error fetching group roles:', error);
    return [];
  }
}
