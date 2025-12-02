/**
 * Encryption utilities for sensitive data (like Roblox cookies)
 * Uses AES-256-GCM for secure encryption
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 64;

/**
 * Get encryption key from environment variable
 * Must be 32 characters (256 bits) for AES-256
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    throw new Error('ENCRYPTION_KEY not set in environment variables');
  }

  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be exactly 32 characters');
  }

  return Buffer.from(key, 'utf8');
}

/**
 * Encrypt a string (like a Roblox cookie)
 * Returns: base64-encoded string containing: salt + iv + authTag + encrypted data
 */
export function encrypt(text: string): string {
  try {
    const key = getEncryptionKey();

    // Generate random IV (initialization vector)
    const iv = crypto.randomBytes(IV_LENGTH);

    // Generate random salt
    const salt = crypto.randomBytes(SALT_LENGTH);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt the text
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    // Combine: salt + iv + authTag + encrypted data
    const combined = Buffer.concat([
      salt,
      iv,
      authTag,
      Buffer.from(encrypted, 'hex')
    ]);

    // Return as base64
    return combined.toString('base64');
  } catch (error) {
    throw new Error(`Encryption failed: ${error}`);
  }
}

/**
 * Decrypt an encrypted string
 * Input: base64-encoded string from encrypt()
 * Returns: original plain text
 */
export function decrypt(encryptedData: string): string {
  try {
    const key = getEncryptionKey();

    // Decode from base64
    const combined = Buffer.from(encryptedData, 'base64');

    // Extract components
    const salt = combined.slice(0, SALT_LENGTH);
    const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = combined.slice(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = combined.slice(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt
    let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error}`);
  }
}

/**
 * Test if encryption key is properly configured
 */
export function testEncryption(): boolean {
  try {
    const testString = 'test_encryption_works';
    const encrypted = encrypt(testString);
    const decrypted = decrypt(encrypted);
    return decrypted === testString;
  } catch {
    return false;
  }
}

/**
 * Generate a random 32-character encryption key
 * Use this to create a new ENCRYPTION_KEY for .env
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('base64').slice(0, 32);
}
