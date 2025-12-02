/**
 * Utility functions
 */

/**
 * Generate a random 6-character code for verification
 */
export function generateVerificationCode(): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return code;
}

/**
 * Format a nickname based on a template
 * Supports: {username}, {rank}, {robloxId}
 */
export function formatNickname(
  format: string,
  data: { username: string; rank?: string; robloxId: string }
): string {
  return format
    .replace('{username}', data.username)
    .replace('{rank}', data.rank || 'Member')
    .replace('{robloxId}', data.robloxId);
}

/**
 * Create a simple embed structure
 */
export function createEmbed(options: {
  title?: string;
  description?: string;
  color?: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: string;
}) {
  return {
    title: options.title,
    description: options.description,
    color: options.color || 0x0099ff,
    fields: options.fields,
    footer: options.footer ? { text: options.footer } : undefined,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Chunk an array into smaller arrays
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Sleep for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
