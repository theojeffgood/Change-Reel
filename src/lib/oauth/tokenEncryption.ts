/**
 * OAuth Token Encryption Service
 * Handles encryption and decryption of OAuth tokens before database storage
 */

import crypto from 'crypto';

export interface EncryptedToken {
  encryptedData: string;
  iv: string;
  tag: string;
}

export class TokenEncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits
  private readonly tagLength = 16; // 128 bits
  private readonly encryptionKey: Buffer;

  constructor(encryptionKey?: string) {
    if (!encryptionKey) {
      throw new Error('Encryption key is required');
    }

    if (encryptionKey.length < 32) {
      throw new Error('Encryption key must be at least 32 characters long');
    }

    // Use the first 32 bytes of the key
    this.encryptionKey = Buffer.from(encryptionKey.slice(0, 32), 'utf8');
  }

  /**
   * Encrypt a plaintext token
   */
  encrypt(plaintext: string): EncryptedToken {
    if (!plaintext || typeof plaintext !== 'string') {
      throw new Error('Plaintext must be a non-empty string');
    }

    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipher(this.algorithm, this.encryptionKey);
    cipher.setAutoPadding(false);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return {
      encryptedData: encrypted,
      iv: iv.toString('hex'),
      tag: '' // GCM not available in this context, using empty tag
    };
  }

  /**
   * Decrypt an encrypted token
   */
  decrypt(encryptedToken: EncryptedToken): string {
    if (!encryptedToken || !encryptedToken.encryptedData || !encryptedToken.iv) {
      throw new Error('Invalid encrypted token format');
    }

    try {
      const decipher = crypto.createDecipher(this.algorithm, this.encryptionKey);
      decipher.setAutoPadding(false);
      
      let decrypted = decipher.update(encryptedToken.encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error('Failed to decrypt token: Invalid data or key');
    }
  }

  /**
   * Validate that an encrypted token can be decrypted
   */
  validateToken(encryptedToken: EncryptedToken): boolean {
    try {
      this.decrypt(encryptedToken);
      return true;
    } catch {
      return false;
    }
  }
} 