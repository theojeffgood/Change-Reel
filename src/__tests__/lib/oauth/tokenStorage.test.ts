/**
 * OAuth Token Storage Service Tests
 */

import { TokenStorageService, OAuthToken, StoredOAuthToken } from '../../../lib/oauth/tokenStorage';
import { TokenEncryptionService, EncryptedToken } from '../../../lib/oauth/tokenEncryption';

// Mock the encryption service
jest.mock('../../../lib/oauth/tokenEncryption');

// Mock Supabase
const mockTable = {
  insert: jest.fn(),
  select: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  eq: jest.fn(),
  single: jest.fn(),
};

const mockSupabaseClient = {
  from: jest.fn().mockReturnValue(mockTable),
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

describe('TokenStorageService', () => {
  let tokenStorage: TokenStorageService;
  let mockEncryptionService: jest.Mocked<TokenEncryptionService>;

  const testToken: OAuthToken = {
    user_id: 'github_user_123',
    provider: 'github',
    access_token: 'ghp_test_token_1234567890abcdef',
    refresh_token: 'ghr_test_refresh_token_abcdef123456',
    expires_at: new Date('2025-06-25T22:57:24.000Z'),
    token_type: 'Bearer',
    scope: 'repo,write:repo_hook,user:email',
    token_version: 1
  };

  const mockEncryptedToken: EncryptedToken = {
    encryptedData: 'encrypted-data',
    iv: 'test-iv',
    tag: 'test-tag'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup encryption service mock
    mockEncryptionService = new TokenEncryptionService('test-key-32-characters-long-min') as jest.Mocked<TokenEncryptionService>;
    mockEncryptionService.encrypt.mockReturnValue(mockEncryptedToken);
    mockEncryptionService.decrypt.mockReturnValue('decrypted-token');
    
    (TokenEncryptionService as jest.MockedClass<typeof TokenEncryptionService>).mockImplementation(() => mockEncryptionService);
    
    // Reset table chain
    mockTable.insert.mockReturnThis();
    mockTable.select.mockReturnThis();
    mockTable.update.mockReturnThis();
    mockTable.delete.mockReturnThis();
    mockTable.eq.mockReturnThis();
    mockTable.single.mockReturnThis();
    
    tokenStorage = new TokenStorageService('test-url', 'test-key', 'test-encryption-key-32-chars-min');
  });

  describe('constructor', () => {
    it('should initialize with required parameters', () => {
      expect(() => new TokenStorageService('url', 'key', 'encryption-key-32-characters-long')).not.toThrow();
    });

    it('should throw error without required parameters', () => {
      expect(() => new TokenStorageService('', 'key', 'encryption-key')).toThrow('Supabase URL and key are required');
      expect(() => new TokenStorageService('url', '', 'encryption-key')).toThrow('Supabase URL and key are required');
    });
  });

  describe('storeToken', () => {
    it('should store token successfully', async () => {
      const mockStoredToken: StoredOAuthToken = {
        id: 'stored-token-id',
        user_id: testToken.user_id,
        provider: testToken.provider,
        encrypted_access_token: JSON.stringify(mockEncryptedToken),
        encrypted_refresh_token: JSON.stringify(mockEncryptedToken),
        expires_at: testToken.expires_at?.toISOString(),
        token_type: 'bearer',
        scope: testToken.scope,
        created_at: '2025-06-25T21:57:24.228Z',
        updated_at: '2025-06-25T21:57:24.228Z',
        token_version: 1
      };

      mockTable.single.mockResolvedValue({ data: mockStoredToken, error: null });

      const result = await tokenStorage.storeToken(testToken);

      expect(result.data).toEqual(mockStoredToken);
      expect(result.error).toBeNull();
      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith(testToken.access_token);
      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith(testToken.refresh_token);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('oauth_tokens');
      expect(mockTable.insert).toHaveBeenCalledWith(expect.objectContaining({
        user_id: testToken.user_id,
        provider: testToken.provider,
        encrypted_access_token: JSON.stringify(mockEncryptedToken),
        encrypted_refresh_token: JSON.stringify(mockEncryptedToken),
        token_type: 'Bearer',
        token_version: 1
      }));
    });

    it('should handle token with no refresh token', async () => {
      const tokenWithoutRefresh = { ...testToken };
      delete tokenWithoutRefresh.refresh_token;

             const mockStoredToken: StoredOAuthToken = {
         id: 'stored-token-id',
         user_id: testToken.user_id,
         provider: testToken.provider,
         encrypted_access_token: JSON.stringify(mockEncryptedToken),
         expires_at: testToken.expires_at?.toISOString(),
         token_type: 'bearer',
         scope: testToken.scope,
         created_at: '2025-06-25T21:57:24.228Z',
         updated_at: '2025-06-25T21:57:24.228Z',
         token_version: 1
       };

      mockTable.single.mockResolvedValue({ data: mockStoredToken, error: null });

      const result = await tokenStorage.storeToken(tokenWithoutRefresh);

      expect(result.data).toEqual(mockStoredToken);
      expect(result.error).toBeNull();
      expect(mockEncryptionService.encrypt).toHaveBeenCalledTimes(1);
      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith(testToken.access_token);
    });

    it('should handle encryption failure', async () => {
      mockEncryptionService.encrypt.mockImplementation(() => {
        throw new Error('Encryption failed');
      });

      const result = await tokenStorage.storeToken(testToken);

      expect(result.data).toBeNull();
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe('Encryption failed');
    });

    it('should handle database insert failure', async () => {
      mockTable.single.mockResolvedValue({ data: null, error: { message: 'Database error' } });

      const result = await tokenStorage.storeToken(testToken);

      expect(result.data).toBeNull();
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe('Failed to store token: Database error');
    });

    it('should validate user ID', async () => {
      const invalidToken = { ...testToken, user_id: '' };

      const result = await tokenStorage.storeToken(invalidToken);

      expect(result.data).toBeNull();
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe('Token must have user_id, provider, and access_token');
    });

    it('should validate token data', async () => {
      const invalidToken = { ...testToken, access_token: '' };

      const result = await tokenStorage.storeToken(invalidToken);

      expect(result.data).toBeNull();
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe('Token must have user_id, provider, and access_token');
    });
  });

  describe('getToken', () => {
    const userId = 'github_user_123';
    const provider = 'github';

    it('should retrieve and decrypt token successfully', async () => {
      const mockStoredToken: StoredOAuthToken = {
        id: 'stored-token-id',
        user_id: userId,
        provider: provider,
        encrypted_access_token: JSON.stringify(mockEncryptedToken),
        encrypted_refresh_token: JSON.stringify(mockEncryptedToken),
        expires_at: '2025-06-25T22:57:24.000Z',
        token_type: 'bearer',
        scope: 'repo,write:repo_hook,user:email',
        created_at: '2025-06-25T21:57:24.228Z',
        updated_at: '2025-06-25T21:57:24.228Z',
        token_version: 1
      };

      mockTable.single.mockResolvedValue({ data: mockStoredToken, error: null });
      mockEncryptionService.decrypt.mockReturnValue('decrypted-access-token');

      const result = await tokenStorage.getToken(userId, provider);

      expect(result.data).toEqual(expect.objectContaining({
        user_id: userId,
        provider: provider,
        access_token: 'decrypted-access-token',
        token_version: 1
      }));
      expect(result.error).toBeNull();
      expect(mockTable.eq).toHaveBeenCalledWith('user_id', userId);
      expect(mockTable.eq).toHaveBeenCalledWith('provider', provider);
      expect(mockEncryptionService.decrypt).toHaveBeenCalled();
    });

    it('should return null when no token found', async () => {
      mockTable.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });

      const result = await tokenStorage.getToken(userId, provider);

      expect(result.data).toBeNull();
      expect(result.error).toBeNull();
    });

    it('should handle decryption failure', async () => {
      const mockStoredToken: StoredOAuthToken = {
        id: 'stored-token-id',
        user_id: userId,
        provider: provider,
        encrypted_access_token: JSON.stringify(mockEncryptedToken),
        expires_at: '2025-06-25T22:57:24.000Z',
        token_type: 'bearer',
        scope: 'repo,write:repo_hook,user:email',
        created_at: '2025-06-25T21:57:24.228Z',
        updated_at: '2025-06-25T21:57:24.228Z',
        token_version: 1
      };

      mockTable.single.mockResolvedValue({ data: mockStoredToken, error: null });
      mockEncryptionService.decrypt.mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      const result = await tokenStorage.getToken(userId, provider);

      expect(result.data).toBeNull();
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe('Decryption failed');
    });

    it('should handle database query failure', async () => {
      mockTable.single.mockResolvedValue({ data: null, error: { message: 'Database connection error' } });

      const result = await tokenStorage.getToken(userId, provider);

      expect(result.data).toBeNull();
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe('Failed to retrieve token: Database connection error');
    });

    it('should filter by provider when specified', async () => {
      mockTable.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });

      await tokenStorage.getToken(userId, 'gitlab');

      expect(mockTable.eq).toHaveBeenCalledWith('user_id', userId);
      expect(mockTable.eq).toHaveBeenCalledWith('provider', 'gitlab');
    });
  });

  describe('updateToken', () => {
    const userId = 'github_user_123';
    const provider = 'github';
    const updates: Partial<OAuthToken> = {
      access_token: 'new-access-token',
      expires_at: new Date('2025-07-25T22:57:24.000Z')
    };

    it('should update token successfully', async () => {
      const mockUpdatedToken: StoredOAuthToken = {
        id: 'stored-token-id',
        user_id: userId,
        provider: provider,
        encrypted_access_token: JSON.stringify(mockEncryptedToken),
        expires_at: updates.expires_at?.toISOString(),
        token_type: 'bearer',
        scope: 'repo,write:repo_hook,user:email',
        created_at: '2025-06-25T21:57:24.228Z',
        updated_at: new Date().toISOString(),
        token_version: 1
      };

      mockTable.single.mockResolvedValue({ data: mockUpdatedToken, error: null });

      const result = await tokenStorage.updateToken(userId, provider, updates);

      expect(result.data).toEqual(mockUpdatedToken);
      expect(result.error).toBeNull();
      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith(updates.access_token);
      expect(mockTable.update).toHaveBeenCalledWith(expect.objectContaining({
        encrypted_access_token: JSON.stringify(mockEncryptedToken),
        expires_at: updates.expires_at?.toISOString(),
        updated_at: expect.any(String)
      }));
    });

    it('should handle update failure', async () => {
      mockTable.single.mockResolvedValue({ data: null, error: { message: 'Token not found' } });

      const result = await tokenStorage.updateToken(userId, provider, updates);

      expect(result.data).toBeNull();
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe('Failed to update token: Token not found');
    });
  });

    describe('deleteToken', () => {
    const userId = 'github_user_123';
    const provider = 'github';

    beforeEach(() => {
      // Reset all mocks first
      jest.clearAllMocks();
      
      // Create a proper chain for delete operations that supports two .eq() calls
      const deleteChain = {
        eq: jest.fn().mockImplementation(() => ({
          eq: jest.fn().mockResolvedValue({ error: null })
        }))
      };
      
      mockTable.delete.mockReturnValue(deleteChain);
    });

    it('should delete token successfully', async () => {
      const result = await tokenStorage.deleteToken(userId, provider);

      expect(result.error).toBeNull();
      expect(mockTable.delete).toHaveBeenCalled();
    });

         it('should handle delete failure', async () => {
       // Reset the mock for this specific test
       const deleteChain = {
         eq: jest.fn().mockImplementation(() => ({
           eq: jest.fn().mockResolvedValue({ error: { message: 'Foreign key constraint violation' } })
         }))
       };
       mockTable.delete.mockReturnValue(deleteChain);

       const result = await tokenStorage.deleteToken(userId, provider);

       expect(result.error).toBeInstanceOf(Error);
       expect(result.error?.message).toBe('Failed to delete token: Foreign key constraint violation');
     });

    it('should filter by provider when specified', async () => {
      const result = await tokenStorage.deleteToken(userId, 'gitlab');

      expect(result.error).toBeNull();
      expect(mockTable.delete).toHaveBeenCalled();
    });
   });

  describe('listTokens', () => {
    const userId = 'github_user_123';

    it('should retrieve all tokens for user', async () => {
      const mockStoredTokens: StoredOAuthToken[] = [
        {
          id: 'token-1',
          user_id: userId,
          provider: 'github',
          encrypted_access_token: JSON.stringify(mockEncryptedToken),
          expires_at: '2025-06-25T22:57:24.000Z',
          token_type: 'bearer',
          scope: 'repo',
          created_at: '2025-06-25T21:57:24.228Z',
          updated_at: '2025-06-25T21:57:24.228Z',
          token_version: 1
        },
        {
          id: 'token-2',
          user_id: userId,
          provider: 'gitlab',
          encrypted_access_token: JSON.stringify(mockEncryptedToken),
          expires_at: '2025-06-25T22:57:24.000Z',
          token_type: 'bearer',
          scope: 'api',
          created_at: '2025-06-25T21:57:24.228Z',
          updated_at: '2025-06-25T21:57:24.228Z',
          token_version: 1
        }
      ];

      mockTable.eq.mockResolvedValue({ data: mockStoredTokens, error: null });
      mockEncryptionService.decrypt.mockReturnValue('decrypted-token');

      const result = await tokenStorage.listTokens(userId);

      expect(result.data).toHaveLength(2);
      expect(result.data?.[0]).toHaveProperty('provider', 'github');
      expect(result.data?.[1]).toHaveProperty('provider', 'gitlab');
      expect(result.error).toBeNull();
      expect(mockTable.eq).toHaveBeenCalledWith('user_id', userId);
    });

    it('should return empty array when no tokens found', async () => {
      mockTable.eq.mockResolvedValue({ data: [], error: null });

      const result = await tokenStorage.listTokens(userId);

      expect(result.data).toEqual([]);
      expect(result.error).toBeNull();
    });
  });

  describe('tokenExists', () => {
    const userId = 'github_user_123';
    const provider = 'github';

    it('should return true when token exists', async () => {
      mockTable.single.mockResolvedValue({ data: { id: 'token-1' }, error: null });

      const result = await tokenStorage.tokenExists(userId, provider);

      expect(result.exists).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should return false when token does not exist', async () => {
      mockTable.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });

      const result = await tokenStorage.tokenExists(userId, provider);

      expect(result.exists).toBe(false);
      expect(result.error).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should handle network timeouts gracefully', async () => {
      mockTable.single.mockRejectedValue(new Error('Network timeout'));

      const result = await tokenStorage.getToken('user-123', 'github');

      expect(result.data).toBeNull();
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe('Network timeout');
    });

    it('should handle concurrent access properly', async () => {
      const mockStoredToken: StoredOAuthToken = {
        id: 'stored-token-id',
        user_id: 'user-123',
        provider: 'github',
        encrypted_access_token: JSON.stringify(mockEncryptedToken),
        expires_at: '2025-06-25T22:57:24.000Z',
        token_type: 'bearer',
        scope: 'repo',
        created_at: '2025-06-25T21:57:24.228Z',
        updated_at: '2025-06-25T21:57:24.228Z',
        token_version: 1
      };

      mockTable.single.mockResolvedValue({ data: mockStoredToken, error: null });

      const promises = [
        tokenStorage.getToken('user-123', 'github'),
        tokenStorage.getToken('user-123', 'github'),
        tokenStorage.getToken('user-123', 'github')
      ];

      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result.data).toBeDefined();
        expect(result.error).toBeNull();
      });
    });
  });
}); 