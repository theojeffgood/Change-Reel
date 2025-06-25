/**
 * @jest-environment node
 */

// Mock the crypto module BEFORE importing anything else
const mockRandomBytes = jest.fn();
const mockCreateCipher = jest.fn();
const mockCreateDecipher = jest.fn();

jest.mock('crypto', () => ({
  randomBytes: mockRandomBytes,
  createCipher: mockCreateCipher,
  createDecipher: mockCreateDecipher,
}));

import { TokenEncryptionService, EncryptedToken } from '../../../lib/oauth/tokenEncryption';

describe('TokenEncryptionService', () => {
  let encryptionService: TokenEncryptionService;
  const testEncryptionKey = 'test-encryption-key-32-characters-long-minimum';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mocks
    mockRandomBytes.mockReturnValue(Buffer.from('test-iv-16-bytes-', 'utf8'));
    
    const mockCipher = {
      setAutoPadding: jest.fn(),
      update: jest.fn().mockReturnValue('encrypted-data'),
      final: jest.fn().mockReturnValue('')
    };
    
    const mockDecipher = {
      setAutoPadding: jest.fn(),
      update: jest.fn().mockReturnValue('decrypted-data'),
      final: jest.fn().mockReturnValue('')
    };
    
    mockCreateCipher.mockReturnValue(mockCipher);
    mockCreateDecipher.mockReturnValue(mockDecipher);
    
    encryptionService = new TokenEncryptionService(testEncryptionKey);
  });

  describe('constructor', () => {
    it('should initialize with valid encryption key', () => {
      expect(() => new TokenEncryptionService(testEncryptionKey)).not.toThrow();
    });

    it('should throw error without encryption key', () => {
      expect(() => new TokenEncryptionService('')).toThrow('Encryption key is required');
    });

    it('should throw error with short encryption key', () => {
      expect(() => new TokenEncryptionService('short')).toThrow('Encryption key must be at least 32 characters long');
    });
  });

  describe('encrypt', () => {
    it('should encrypt plaintext successfully', () => {
      const plaintext = 'test-access-token';
      
      const result = encryptionService.encrypt(plaintext);
      
      expect(result).toHaveProperty('encryptedData');
      expect(result).toHaveProperty('iv');
      expect(result).toHaveProperty('tag');
      expect(result.encryptedData).toBe('encrypted-data');
      expect(result.iv).toBe('746573742d69762d31362d62797465732d');
    });

    it('should throw error for empty plaintext', () => {
      expect(() => encryptionService.encrypt('')).toThrow('Plaintext must be a non-empty string');
    });

    it('should throw error for non-string plaintext', () => {
      expect(() => encryptionService.encrypt(null as any)).toThrow('Plaintext must be a non-empty string');
    });
  });

  describe('decrypt', () => {
    it('should decrypt encrypted token successfully', () => {
      const encryptedToken: EncryptedToken = {
        encryptedData: 'encrypted-data',
        iv: 'test-iv',
        tag: 'test-tag'
      };
      
      const result = encryptionService.decrypt(encryptedToken);
      
      expect(result).toBe('decrypted-data');
    });

    it('should throw error for invalid encrypted token', () => {
      const invalidToken = {
        encryptedData: '',
        iv: 'test-iv',
        tag: 'test-tag'
      };
      
      expect(() => encryptionService.decrypt(invalidToken)).toThrow('Invalid encrypted token format');
    });

    it('should throw error for missing iv', () => {
      const invalidToken = {
        encryptedData: 'encrypted-data',
        iv: '',
        tag: 'test-tag'
      };
      
      expect(() => encryptionService.decrypt(invalidToken)).toThrow('Invalid encrypted token format');
    });
  });

  describe('validateToken', () => {
    it('should return true for valid encrypted token', () => {
      const validToken: EncryptedToken = {
        encryptedData: 'encrypted-data',
        iv: 'test-iv',
        tag: 'test-tag'
      };
      
      const result = encryptionService.validateToken(validToken);
      
      expect(result).toBe(true);
    });

    it('should return false for invalid encrypted token', () => {
      const invalidToken: EncryptedToken = {
        encryptedData: '',
        iv: 'test-iv',
        tag: 'test-tag'
      };
      
      const result = encryptionService.validateToken(invalidToken);
      
      expect(result).toBe(false);
    });
  });
}); 