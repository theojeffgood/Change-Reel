/**
 * @jest-environment node
 */

import { OAuthTokenStorage } from '@/lib/oauth/tokenStorage';
import { mockSessions, mockOAuthTokens, mockTokenStorageData } from '@/__tests__/fixtures/oauthFixtures';

// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn(),
};

// Mock encryption service
const mockEncryptionService = {
  encrypt: jest.fn(),
  decrypt: jest.fn(),
};

// Mock the modules
jest.mock('@/lib/supabase/client', () => ({
  createClientComponentClient: () => mockSupabaseClient,
}));

jest.mock('@/lib/oauth/tokenEncryption', () => ({
  TokenEncryptionService: jest.fn().mockImplementation(() => mockEncryptionService),
}));

describe('OAuthTokenStorage', () => {
  let tokenStorage: OAuthTokenStorage;
  let mockTable: any;

  beforeEach(() => {
    mockTable = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };

    mockSupabaseClient.from.mockReturnValue(mockTable);
    tokenStorage = new OAuthTokenStorage();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with encryption service', () => {
      expect(tokenStorage).toBeDefined();
    });
  });

  describe('storeToken', () => {
    const userId = 'github_user_123';
    const tokenData = mockOAuthTokens.valid;

    beforeEach(() => {
      mockEncryptionService.encrypt.mockResolvedValue(mockTokenStorageData.encrypted);
      mockTable.single.mockResolvedValue({
        data: { id: 'token-id-123' },
        error: null,
      });
    });

    it('should store token successfully', async () => {
      const result = await tokenStorage.storeToken(userId, tokenData);

      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith(tokenData);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('oauth_tokens');
      expect(mockTable.insert).toHaveBeenCalledWith({
        user_id: userId,
        encrypted_token: mockTokenStorageData.encrypted.encrypted_token,
        iv: mockTokenStorageData.encrypted.iv,
        auth_tag: mockTokenStorageData.encrypted.auth_tag,
        provider: 'github',
        scopes: tokenData.scope.split(','),
        token_version: 1,
        expires_at: expect.any(String),
      });
      expect(result).toBe('token-id-123');
    });

    it('should handle token with no expiration', async () => {
      const tokenWithoutExpiry = { ...tokenData };
      delete (tokenWithoutExpiry as any).expires_at;

      await tokenStorage.storeToken(userId, tokenWithoutExpiry);

      expect(mockTable.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          expires_at: null,
        })
      );
    });

    it('should handle token with custom provider', async () => {
      await tokenStorage.storeToken(userId, tokenData, 'gitlab');

      expect(mockTable.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'gitlab',
        })
      );
    });

    it('should handle encryption failure', async () => {
      mockEncryptionService.encrypt.mockRejectedValue(new Error('Encryption failed'));

      await expect(tokenStorage.storeToken(userId, tokenData)).rejects.toThrow(
        'Failed to store OAuth token: Encryption failed'
      );
    });

    it('should handle database insert failure', async () => {
      mockTable.single.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      await expect(tokenStorage.storeToken(userId, tokenData)).rejects.toThrow(
        'Failed to store OAuth token: Database error'
      );
    });

    it('should validate user ID', async () => {
      await expect(tokenStorage.storeToken('', tokenData)).rejects.toThrow(
        'User ID is required'
      );

      await expect(tokenStorage.storeToken(null as any, tokenData)).rejects.toThrow(
        'User ID is required'
      );
    });

    it('should validate token data', async () => {
      await expect(tokenStorage.storeToken(userId, null as any)).rejects.toThrow(
        'Token data is required'
      );

      await expect(tokenStorage.storeToken(userId, {} as any)).rejects.toThrow(
        'Invalid token data: missing access_token'
      );
    });
  });

  describe('getToken', () => {
    const userId = 'github_user_123';

    beforeEach(() => {
      mockEncryptionService.decrypt.mockResolvedValue(mockTokenStorageData.decrypted);
    });

    it('should retrieve and decrypt token successfully', async () => {
      mockTable.single.mockResolvedValue({
        data: {
          id: 'token-id-123',
          encrypted_token: mockTokenStorageData.encrypted.encrypted_token,
          iv: mockTokenStorageData.encrypted.iv,
          auth_tag: mockTokenStorageData.encrypted.auth_tag,
          provider: 'github',
          scopes: ['repo', 'write:repo_hook'],
          token_version: 1,
        },
        error: null,
      });

      const result = await tokenStorage.getToken(userId);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('oauth_tokens');
      expect(mockTable.select).toHaveBeenCalledWith('*');
      expect(mockTable.eq).toHaveBeenCalledWith('user_id', userId);
      expect(mockEncryptionService.decrypt).toHaveBeenCalledWith({
        encrypted_token: mockTokenStorageData.encrypted.encrypted_token,
        iv: mockTokenStorageData.encrypted.iv,
        auth_tag: mockTokenStorageData.encrypted.auth_tag,
      });
      expect(result).toEqual(mockTokenStorageData.decrypted);
    });

    it('should return null when no token found', async () => {
      mockTable.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }, // No rows returned
      });

      const result = await tokenStorage.getToken(userId);

      expect(result).toBeNull();
    });

    it('should handle decryption failure', async () => {
      mockTable.single.mockResolvedValue({
        data: {
          encrypted_token: 'corrupted-data',
          iv: 'test-iv',
          auth_tag: 'test-tag',
        },
        error: null,
      });

      mockEncryptionService.decrypt.mockRejectedValue(new Error('Decryption failed'));

      await expect(tokenStorage.getToken(userId)).rejects.toThrow(
        'Failed to retrieve OAuth token: Decryption failed'
      );
    });

    it('should handle database query failure', async () => {
      mockTable.single.mockResolvedValue({
        data: null,
        error: { message: 'Database connection error' },
      });

      await expect(tokenStorage.getToken(userId)).rejects.toThrow(
        'Failed to retrieve OAuth token: Database connection error'
      );
    });

    it('should filter by provider when specified', async () => {
      await tokenStorage.getToken(userId, 'gitlab');

      expect(mockTable.eq).toHaveBeenCalledWith('user_id', userId);
      expect(mockTable.eq).toHaveBeenCalledWith('provider', 'gitlab');
    });
  });

  describe('updateToken', () => {
    const userId = 'github_user_123';
    const newTokenData = mockOAuthTokens.valid;

    beforeEach(() => {
      mockEncryptionService.encrypt.mockResolvedValue(mockTokenStorageData.encrypted);
      mockTable.single.mockResolvedValue({
        data: { id: 'token-id-123' },
        error: null,
      });
    });

    it('should update token successfully', async () => {
      await tokenStorage.updateToken(userId, newTokenData);

      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith(newTokenData);
      expect(mockTable.update).toHaveBeenCalledWith({
        encrypted_token: mockTokenStorageData.encrypted.encrypted_token,
        iv: mockTokenStorageData.encrypted.iv,
        auth_tag: mockTokenStorageData.encrypted.auth_tag,
        scopes: newTokenData.scope.split(','),
        token_version: expect.any(Number),
        expires_at: expect.any(String),
        updated_at: expect.any(String),
      });
      expect(mockTable.eq).toHaveBeenCalledWith('user_id', userId);
    });

    it('should increment token version', async () => {
      await tokenStorage.updateToken(userId, newTokenData);

      const updateCall = mockTable.update.mock.calls[0][0];
      expect(updateCall.token_version).toBeGreaterThan(0);
    });

    it('should handle update failure when token not found', async () => {
      mockTable.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      await expect(tokenStorage.updateToken(userId, newTokenData)).rejects.toThrow(
        'OAuth token not found for user'
      );
    });
  });

  describe('deleteToken', () => {
    const userId = 'github_user_123';

    it('should delete token successfully', async () => {
      mockTable.single.mockResolvedValue({
        data: { id: 'deleted-token-id' },
        error: null,
      });

      const result = await tokenStorage.deleteToken(userId);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('oauth_tokens');
      expect(mockTable.delete).toHaveBeenCalled();
      expect(mockTable.eq).toHaveBeenCalledWith('user_id', userId);
      expect(result).toBe(true);
    });

    it('should return false when no token to delete', async () => {
      mockTable.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      const result = await tokenStorage.deleteToken(userId);

      expect(result).toBe(false);
    });

    it('should filter by provider when specified', async () => {
      await tokenStorage.deleteToken(userId, 'gitlab');

      expect(mockTable.eq).toHaveBeenCalledWith('user_id', userId);
      expect(mockTable.eq).toHaveBeenCalledWith('provider', 'gitlab');
    });

    it('should handle delete failure', async () => {
      mockTable.single.mockResolvedValue({
        data: null,
        error: { message: 'Foreign key constraint violation' },
      });

      await expect(tokenStorage.deleteToken(userId)).rejects.toThrow(
        'Failed to delete OAuth token: Foreign key constraint violation'
      );
    });
  });

  describe('isTokenValid', () => {
    it('should return true for valid token', async () => {
      const validToken = {
        ...mockTokenStorageData.decrypted,
        expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      };

      const result = await tokenStorage.isTokenValid(validToken);

      expect(result).toBe(true);
    });

    it('should return false for expired token', async () => {
      const expiredToken = {
        ...mockTokenStorageData.decrypted,
        expires_at: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      };

      const result = await tokenStorage.isTokenValid(expiredToken);

      expect(result).toBe(false);
    });

    it('should return true for token without expiration', async () => {
      const tokenWithoutExpiry = {
        ...mockTokenStorageData.decrypted,
      };
      delete (tokenWithoutExpiry as any).expires_at;

      const result = await tokenStorage.isTokenValid(tokenWithoutExpiry);

      expect(result).toBe(true);
    });

    it('should return false for token without access_token', async () => {
      const invalidToken = {
        scope: 'repo',
      };

      const result = await tokenStorage.isTokenValid(invalidToken as any);

      expect(result).toBe(false);
    });
  });

  describe('getAllTokensForUser', () => {
    const userId = 'github_user_123';

    it('should retrieve all tokens for user', async () => {
      const mockTokens = [
        {
          id: 'token-1',
          provider: 'github',
          encrypted_token: 'encrypted-1',
          iv: 'iv-1',
          auth_tag: 'tag-1',
          created_at: new Date().toISOString(),
        },
        {
          id: 'token-2',
          provider: 'gitlab',
          encrypted_token: 'encrypted-2',
          iv: 'iv-2',
          auth_tag: 'tag-2',
          created_at: new Date().toISOString(),
        },
      ];

      mockTable.select.mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: mockTokens,
          error: null,
        }),
      });

      const result = await tokenStorage.getAllTokensForUser(userId);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('provider', 'github');
      expect(result[1]).toHaveProperty('provider', 'gitlab');
    });

    it('should return empty array when no tokens found', async () => {
      mockTable.select.mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      });

      const result = await tokenStorage.getAllTokensForUser(userId);

      expect(result).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('should handle network timeouts gracefully', async () => {
      mockTable.single.mockRejectedValue(new Error('Network timeout'));

      await expect(tokenStorage.getToken('user-123')).rejects.toThrow(
        'Failed to retrieve OAuth token: Network timeout'
      );
    });

    it('should handle concurrent access properly', async () => {
      const userId = 'concurrent-user';
      const tokenData = mockOAuthTokens.valid;

      // Simulate concurrent store operations
      const promise1 = tokenStorage.storeToken(userId, tokenData);
      const promise2 = tokenStorage.storeToken(userId, tokenData);

      await expect(Promise.all([promise1, promise2])).resolves.toBeDefined();
    });
  });
}); 