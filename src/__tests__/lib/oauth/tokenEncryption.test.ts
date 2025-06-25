/**
 * @jest-environment node
 */

import { TokenEncryptionService } from '@/lib/oauth/tokenEncryption';
import { mockTokenStorageData } from '@/__tests__/fixtures/oauthFixtures';

// Mock crypto for consistent testing
const mockRandomBytes = jest.fn();
const mockCreateCipheriv = jest.fn();
const mockCreateDecipheriv = jest.fn();

jest.mock('crypto', () => ({
  randomBytes: mockRandomBytes,
  createCipheriv: mockCreateCipheriv,
  createDecipheriv: mockCreateDecipheriv,
}));

describe('TokenEncryptionService', () => {
  let encryptionService: TokenEncryptionService;
  const testKey = 'test-encryption-key-32-characters!';

  beforeEach(() => {
    encryptionService = new TokenEncryptionService(testKey);
    jest.clearAllMocks();
    
    // Setup default mocks
    mockRandomBytes.mockReturnValue(Buffer.from('test-random-bytes-16'));
    
    const mockCipher = {
      update: jest.fn().mockReturnValue(Buffer.from('encrypted-data')),
      final: jest.fn().mockReturnValue(Buffer.from('final-encrypted')),
      getAuthTag: jest.fn().mockReturnValue(Buffer.from('auth-tag-16-bytes')),
    };
    
    const mockDecipher = {
      setAuthTag: jest.fn(),
      update: jest.fn().mockReturnValue(Buffer.from('decrypted-data')),
      final: jest.fn().mockReturnValue(Buffer.from('final-decrypted')),
    };
    
    mockCreateCipheriv.mockReturnValue(mockCipher);
    mockCreateDecipheriv.mockReturnValue(mockDecipher);
  });

  describe('constructor', () => {
    it('should create instance with valid key', () => {
      expect(() => new TokenEncryptionService(testKey)).not.toThrow();
    });

    it('should throw error with invalid key length', () => {
      expect(() => new TokenEncryptionService('short-key')).toThrow('Encryption key must be 32 characters long');
    });

    it('should throw error with empty key', () => {
      expect(() => new TokenEncryptionService('')).toThrow('Encryption key must be 32 characters long');
    });
  });

  describe('encrypt', () => {
    const testToken = {
      access_token: 'ghp_test_token_1234567890abcdef',
      token_type: 'bearer',
      scope: 'repo,write:repo_hook,user:email',
    };

    it('should encrypt token successfully', async () => {
      const result = await encryptionService.encrypt(testToken);

      expect(result).toHaveProperty('encrypted_token');
      expect(result).toHaveProperty('iv');
      expect(result).toHaveProperty('auth_tag');
      expect(typeof result.encrypted_token).toBe('string');
      expect(typeof result.iv).toBe('string');
      expect(typeof result.auth_tag).toBe('string');
    });

    it('should generate unique IV for each encryption', async () => {
      mockRandomBytes
        .mockReturnValueOnce(Buffer.from('first-random-iv-16'))
        .mockReturnValueOnce(Buffer.from('second-random-iv16'));

      const result1 = await encryptionService.encrypt(testToken);
      const result2 = await encryptionService.encrypt(testToken);

      expect(result1.iv).not.toBe(result2.iv);
    });

    it('should use AES-256-GCM algorithm', async () => {
      await encryptionService.encrypt(testToken);

      expect(mockCreateCipheriv).toHaveBeenCalledWith(
        'aes-256-gcm',
        expect.any(Buffer),
        expect.any(Buffer)
      );
    });

    it('should handle token serialization', async () => {
      const tokenWithComplexData = {
        ...testToken,
        expires_at: 1640995200,
        scopes: ['repo', 'write:repo_hook'],
      };

      await encryptionService.encrypt(tokenWithComplexData);

      const cipher = mockCreateCipheriv.mock.results[0].value;
      expect(cipher.update).toHaveBeenCalledWith(
        JSON.stringify(tokenWithComplexData),
        'utf8'
      );
    });

    it('should throw error for invalid token data', async () => {
      await expect(
        encryptionService.encrypt(null as any)
      ).rejects.toThrow('Token data is required');

      await expect(
        encryptionService.encrypt(undefined as any)
      ).rejects.toThrow('Token data is required');
    });
  });

  describe('decrypt', () => {
    const encryptedData = {
      encrypted_token: 'encrypted-token-data',
      iv: 'initialization-vector',
      auth_tag: 'authentication-tag',
    };

    beforeEach(() => {
      const mockDecipher = {
        setAuthTag: jest.fn(),
        update: jest.fn().mockReturnValue(Buffer.from('{"access_token":"ghp_test"}')),
        final: jest.fn().mockReturnValue(Buffer.from('')),
      };
      mockCreateDecipheriv.mockReturnValue(mockDecipher);
    });

    it('should decrypt token successfully', async () => {
      const result = await encryptionService.decrypt(encryptedData);

      expect(result).toHaveProperty('access_token');
      expect(result.access_token).toBe('ghp_test');
    });

    it('should use correct decryption parameters', async () => {
      await encryptionService.decrypt(encryptedData);

      expect(mockCreateDecipheriv).toHaveBeenCalledWith(
        'aes-256-gcm',
        expect.any(Buffer),
        Buffer.from(encryptedData.iv, 'base64')
      );

      const decipher = mockCreateDecipheriv.mock.results[0].value;
      expect(decipher.setAuthTag).toHaveBeenCalledWith(
        Buffer.from(encryptedData.auth_tag, 'base64')
      );
    });

    it('should handle JSON parsing of decrypted data', async () => {
      const tokenData = { access_token: 'test_token', scope: 'repo' };
      const mockDecipher = {
        setAuthTag: jest.fn(),
        update: jest.fn().mockReturnValue(Buffer.from(JSON.stringify(tokenData))),
        final: jest.fn().mockReturnValue(Buffer.from('')),
      };
      mockCreateDecipheriv.mockReturnValue(mockDecipher);

      const result = await encryptionService.decrypt(encryptedData);

      expect(result).toEqual(tokenData);
    });

    it('should throw error for missing encrypted data', async () => {
      await expect(
        encryptionService.decrypt(null as any)
      ).rejects.toThrow('Encrypted data is required');

      await expect(
        encryptionService.decrypt({} as any)
      ).rejects.toThrow('Invalid encrypted data format');
    });

    it('should throw error for invalid encrypted data format', async () => {
      const invalidData = {
        encrypted_token: 'test',
        // missing iv and auth_tag
      };

      await expect(
        encryptionService.decrypt(invalidData as any)
      ).rejects.toThrow('Invalid encrypted data format');
    });

    it('should throw error for corrupted auth tag', async () => {
      const mockDecipher = {
        setAuthTag: jest.fn().mockImplementation(() => {
          throw new Error('Invalid authentication tag');
        }),
        update: jest.fn(),
        final: jest.fn(),
      };
      mockCreateDecipheriv.mockReturnValue(mockDecipher);

      await expect(
        encryptionService.decrypt(encryptedData)
      ).rejects.toThrow('Token decryption failed');
    });

    it('should throw error for invalid JSON in decrypted data', async () => {
      const mockDecipher = {
        setAuthTag: jest.fn(),
        update: jest.fn().mockReturnValue(Buffer.from('invalid-json')),
        final: jest.fn().mockReturnValue(Buffer.from('')),
      };
      mockCreateDecipheriv.mockReturnValue(mockDecipher);

      await expect(
        encryptionService.decrypt(encryptedData)
      ).rejects.toThrow('Failed to parse decrypted token data');
    });
  });

  describe('encrypt-decrypt round trip', () => {
    it('should maintain data integrity through encrypt-decrypt cycle', async () => {
      // Use real crypto for this integration test
      jest.unmock('crypto');
      const realCrypto = require('crypto');
      
      const realService = new TokenEncryptionService(testKey);
      const originalToken = {
        access_token: 'ghp_test_token_1234567890abcdef',
        token_type: 'bearer',
        scope: 'repo,write:repo_hook,user:email',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      };

      const encrypted = await realService.encrypt(originalToken);
      const decrypted = await realService.decrypt(encrypted);

      expect(decrypted).toEqual(originalToken);
    });
  });

  describe('error handling', () => {
    it('should handle crypto errors gracefully', async () => {
      mockCreateCipheriv.mockImplementation(() => {
        throw new Error('Crypto operation failed');
      });

      await expect(
        encryptionService.encrypt({ access_token: 'test' })
      ).rejects.toThrow('Token encryption failed');
    });

    it('should handle network-related errors', async () => {
      const cipher = {
        update: jest.fn().mockImplementation(() => {
          throw new Error('Network timeout');
        }),
        final: jest.fn(),
        getAuthTag: jest.fn(),
      };
      mockCreateCipheriv.mockReturnValue(cipher);

      await expect(
        encryptionService.encrypt({ access_token: 'test' })
      ).rejects.toThrow('Token encryption failed');
    });
  });

  describe('performance', () => {
    it('should encrypt tokens within reasonable time', async () => {
      const token = mockTokenStorageData.decrypted;
      const startTime = Date.now();
      
      await encryptionService.encrypt(token);
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
    });

    it('should handle large token data', async () => {
      const largeToken = {
        access_token: 'ghp_' + 'x'.repeat(1000),
        metadata: 'y'.repeat(5000),
      };

      await expect(
        encryptionService.encrypt(largeToken)
      ).resolves.toBeDefined();
    });
  });
}); 