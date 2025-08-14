import { createSupabaseClient } from '@/lib/supabase/client';

// Security: Use environment variable for encryption key, with strict validation
const ENCRYPTION_KEY_RAW = process.env.TOKEN_ENCRYPTION_KEY;
const ALGORITHM = 'AES-CBC';
const KEY_DERIVATION_ITERATIONS = 100000; // PBKDF2 iterations for security

// Validate encryption key on module load
if (!ENCRYPTION_KEY_RAW || ENCRYPTION_KEY_RAW.length < 32) {
  throw new Error('TOKEN_ENCRYPTION_KEY must be at least 32 characters long');
}

// Now we know it exists and is valid
const ENCRYPTION_KEY: string = ENCRYPTION_KEY_RAW;

// Security: Use different salts for different purposes
const TOKEN_SALT = 'token-encryption-salt-v1';
const AUDIT_SALT = 'audit-log-salt-v1';

interface StoredToken {
  id: string;
  user_id: string;
  encrypted_token: string;
  iv: string;
  auth_tag: string;
  provider: string;
  scopes: string[];
  expires_at?: string;
  created_at: string;
  updated_at: string;
  last_used_at?: string;
  token_version: number; // For token rotation
}

interface TokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scopes: string[];
}

interface SecurityAuditLog {
  user_id: string;
  action: 'token_stored' | 'token_retrieved' | 'token_revoked' | 'token_expired' | 'token_invalid' | 'token_refreshed';
  provider: string;
  ip_address?: string;
  user_agent?: string;
  success: boolean;
  error_message?: string;
  timestamp: string;
}

// Utilities
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array {
  const len = hex.length;
  const out = new Uint8Array(len / 2);
  for (let i = 0; i < len; i += 2) {
    out[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return out;
}

function pkcs7Pad(data: Uint8Array): Uint8Array {
  const blockSize = 16;
  let padLen = blockSize - (data.length % blockSize);
  if (padLen === 0) padLen = blockSize;
  const out = new Uint8Array(data.length + padLen);
  out.set(data, 0);
  out.fill(padLen, data.length);
  return out;
}

function pkcs7Unpad(data: Uint8Array): Uint8Array {
  if (data.length === 0) return data;
  const padLen = data[data.length - 1];
  if (padLen < 1 || padLen > 16 || padLen > data.length) {
    throw new Error('Invalid padding');
  }
  return data.subarray(0, data.length - padLen);
}

async function getSubtle(): Promise<SubtleCrypto> {
  if (typeof globalThis !== 'undefined' && (globalThis as any).crypto?.subtle) {
    return (globalThis as any).crypto.subtle as SubtleCrypto;
  }
  // Node.js fallback (only executed in Node runtime, not Edge)
  // Use dynamic import to avoid bundling in Edge
  const nodeCrypto = await import('crypto');
  return ((nodeCrypto as unknown as { webcrypto?: { subtle: SubtleCrypto } }).webcrypto!.subtle);
}

async function deriveAesKey(passphrase: string, salt: string): Promise<CryptoKey> {
  const subtle = await getSubtle();
  const baseKey = await subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  const aesKey = await subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: KEY_DERIVATION_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: ALGORITHM, length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
  return aesKey;
}

/**
 * Encryption using Web Crypto PBKDF2 + AES-CBC (compatible with Edge runtime)
 */
async function encryptToken(token: string): Promise<{ encrypted: string; iv: string; authTag: string }> {
  const subtle = await getSubtle();
  const key = await deriveAesKey(ENCRYPTION_KEY, TOKEN_SALT);
  const iv = new Uint8Array(16);
  const webcrypto = (globalThis as any).crypto?.getRandomValues
    ? (globalThis as any).crypto
    : (await import('crypto') as unknown as { webcrypto: Crypto }).webcrypto;
  webcrypto.getRandomValues(iv);
  const plaintext = encoder.encode(token);
  const padded = pkcs7Pad(plaintext);
  const ciphertext = await subtle.encrypt({ name: ALGORITHM, iv }, key, padded);
  const encryptedBytes = new Uint8Array(ciphertext);
  return {
    encrypted: bytesToHex(encryptedBytes),
    iv: bytesToHex(iv),
    authTag: '', // CBC mode doesn't use auth tags, kept for interface compatibility
  };
}

/**
 * Decryption using Web Crypto PBKDF2 + AES-CBC (compatible with Edge runtime)
 */
async function decryptToken(encryptedHex: string, ivHex: string, authTag: string): Promise<string> {
  const subtle = await getSubtle();
  const key = await deriveAesKey(ENCRYPTION_KEY, TOKEN_SALT);
  const iv = hexToBytes(ivHex);
  const encryptedBytes = hexToBytes(encryptedHex);
  const decryptedBuf = await subtle.decrypt({ name: ALGORITHM, iv }, key, encryptedBytes);
  const unpadded = pkcs7Unpad(new Uint8Array(decryptedBuf));
  return decoder.decode(unpadded);
}

/**
 * Security audit logging for token operations
 */
async function logSecurityEvent(auditLog: SecurityAuditLog): Promise<void> {
  try {
    const supabase = createSupabaseClient();
    // Hash sensitive data for audit logs using Web Crypto
    const subtle = await getSubtle();
    const data = encoder.encode(auditLog.user_id + AUDIT_SALT);
    const digest = await subtle.digest('SHA-256', data);
    const hashedUserId = bytesToHex(new Uint8Array(digest));
    
    await supabase
      .from('security_audit_logs')
      .insert({
        hashed_user_id: hashedUserId,
        action: auditLog.action,
        provider: auditLog.provider,
        ip_address: auditLog.ip_address,
        user_agent: auditLog.user_agent,
        success: auditLog.success,
        error_message: auditLog.error_message,
        timestamp: auditLog.timestamp,
      });
  } catch (error) {
    // Don't fail the main operation if audit logging fails
    console.error('Failed to log security event:', error);
  }
}

/**
 * Store an encrypted OAuth token for a user with enhanced security
 */
export async function storeOAuthToken(
  userId: string,
  provider: string,
  tokenData: TokenData,
  requestInfo?: { ip?: string; userAgent?: string }
): Promise<{ success: boolean; error?: string }> {
  const timestamp = new Date().toISOString();
  
  try {
    // Security: Validate input parameters
    if (!userId || !provider || !tokenData.accessToken) {
      throw new Error('Missing required parameters for token storage');
    }
    
    if (tokenData.accessToken.length < 10) {
      throw new Error('Token appears to be invalid (too short)');
    }
    
    const supabase = createSupabaseClient();
    
    const { encrypted, iv, authTag } = await encryptToken(tokenData.accessToken);
    
    // Get current token version for rotation
    const { data: existingToken } = await supabase
      .from('oauth_tokens')
      .select('token_version')
      .eq('user_id', userId)
      .eq('provider', provider)
      .single();
    
    const tokenVersion = (existingToken?.token_version || 0) + 1;
    
    const tokenRecord: Partial<StoredToken> = {
      user_id: userId,
      encrypted_token: encrypted,
      iv,
      auth_tag: authTag,
      provider,
      scopes: tokenData.scopes,
      expires_at: tokenData.expiresAt?.toISOString(),
      created_at: timestamp,
      updated_at: timestamp,
      token_version: tokenVersion,
    };
    
    // Upsert token (update if exists, insert if not)
    const { error } = await supabase
      .from('oauth_tokens')
      .upsert(tokenRecord, {
        onConflict: 'user_id,provider',
      });
    
    if (error) {
      console.error('Error storing OAuth token:', error);
      
      // Log security event
      await logSecurityEvent({
        user_id: userId,
        action: 'token_stored',
        provider,
        ip_address: requestInfo?.ip,
        user_agent: requestInfo?.userAgent,
        success: false,
        error_message: error.message,
        timestamp,
      });
      
      return { success: false, error: error.message };
    }
    
    // Log successful token storage
    await logSecurityEvent({
      user_id: userId,
      action: 'token_stored',
      provider,
      ip_address: requestInfo?.ip,
      user_agent: requestInfo?.userAgent,
      success: true,
      timestamp,
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error encrypting/storing token:', error);
    
    // Log security event for encryption failure
    await logSecurityEvent({
      user_id: userId,
      action: 'token_stored',
      provider,
      ip_address: requestInfo?.ip,
      user_agent: requestInfo?.userAgent,
      success: false,
      error_message: error instanceof Error ? error.message : 'Unknown encryption error',
      timestamp,
    });
    
    return { success: false, error: 'Failed to store token securely' };
  }
}

/**
 * Retrieve and decrypt an OAuth token for a user with security tracking
 */
export async function getOAuthToken(
  userId: string,
  provider: string,
  requestInfo?: { ip?: string; userAgent?: string }
): Promise<{ token?: string; error?: string }> {
  const timestamp = new Date().toISOString();
  
  try {
    const supabase = createSupabaseClient();
    
    const { data, error } = await supabase
      .from('oauth_tokens')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', provider)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // No token found
        await logSecurityEvent({
          user_id: userId,
          action: 'token_retrieved',
          provider,
          ip_address: requestInfo?.ip,
          user_agent: requestInfo?.userAgent,
          success: false,
          error_message: 'No token found',
          timestamp,
        });
        
        return { error: 'No token found' };
      }
      
      console.error('Error retrieving OAuth token:', error);
      
      await logSecurityEvent({
        user_id: userId,
        action: 'token_retrieved',
        provider,
        ip_address: requestInfo?.ip,
        user_agent: requestInfo?.userAgent,
        success: false,
        error_message: error.message,
        timestamp,
      });
      
      return { error: error.message };
    }
    
    if (!data) {
      await logSecurityEvent({
        user_id: userId,
        action: 'token_retrieved',
        provider,
        ip_address: requestInfo?.ip,
        user_agent: requestInfo?.userAgent,
        success: false,
        error_message: 'No token data returned',
        timestamp,
      });
      
      return { error: 'No token found' };
    }
    
    // Check if token is expired
    if (data.expires_at) {
      const expiresAt = new Date(data.expires_at);
      if (expiresAt <= new Date()) {
        await logSecurityEvent({
          user_id: userId,
          action: 'token_expired',
          provider,
          ip_address: requestInfo?.ip,
          user_agent: requestInfo?.userAgent,
          success: false,
          error_message: 'Token expired',
          timestamp,
        });
        
        return { error: 'Token expired' };
      }
    }
    
    const decryptedToken = await decryptToken(
      data.encrypted_token,
      data.iv,
      data.auth_tag
    );
    
    // Update last_used_at timestamp
    await supabase
      .from('oauth_tokens')
      .update({ last_used_at: timestamp })
      .eq('user_id', userId)
      .eq('provider', provider);
    
    // Log successful token retrieval
    await logSecurityEvent({
      user_id: userId,
      action: 'token_retrieved',
      provider,
      ip_address: requestInfo?.ip,
      user_agent: requestInfo?.userAgent,
      success: true,
      timestamp,
    });
    
    return { token: decryptedToken };
  } catch (error) {
    console.error('Error decrypting/retrieving token:', error);
    
    await logSecurityEvent({
      user_id: userId,
      action: 'token_retrieved',
      provider,
      ip_address: requestInfo?.ip,
      user_agent: requestInfo?.userAgent,
      success: false,
      error_message: error instanceof Error ? error.message : 'Decryption error',
      timestamp,
    });
    
    return { error: 'Failed to retrieve token' };
  }
}

/**
 * Revoke (delete) an OAuth token for a user with security logging
 */
export async function revokeOAuthToken(
  userId: string,
  provider: string,
  requestInfo?: { ip?: string; userAgent?: string }
): Promise<{ success: boolean; error?: string }> {
  const timestamp = new Date().toISOString();
  
  try {
    const supabase = createSupabaseClient();
    
    const { error } = await supabase
      .from('oauth_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('provider', provider);
    
    if (error) {
      console.error('Error revoking OAuth token:', error);
      
      await logSecurityEvent({
        user_id: userId,
        action: 'token_revoked',
        provider,
        ip_address: requestInfo?.ip,
        user_agent: requestInfo?.userAgent,
        success: false,
        error_message: error.message,
        timestamp,
      });
      
      return { success: false, error: error.message };
    }
    
    // Log successful token revocation
    await logSecurityEvent({
      user_id: userId,
      action: 'token_revoked',
      provider,
      ip_address: requestInfo?.ip,
      user_agent: requestInfo?.userAgent,
      success: true,
      timestamp,
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error revoking token:', error);
    
    await logSecurityEvent({
      user_id: userId,
      action: 'token_revoked',
      provider,
      ip_address: requestInfo?.ip,
      user_agent: requestInfo?.userAgent,
      success: false,
      error_message: error instanceof Error ? error.message : 'Unknown error',
      timestamp,
    });
    
    return { success: false, error: 'Failed to revoke token' };
  }
}

/**
 * Check if a token exists and is valid (not expired) with enhanced validation
 */
export async function isTokenValid(
  userId: string,
  provider: string
): Promise<{ valid: boolean; error?: string; expiresAt?: Date }> {
  try {
    const supabase = createSupabaseClient();
    
    const { data, error } = await supabase
      .from('oauth_tokens')
      .select('expires_at, created_at, token_version')
      .eq('user_id', userId)
      .eq('provider', provider)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return { valid: false };
      }
      return { valid: false, error: error.message };
    }
    
    if (!data) {
      return { valid: false };
    }
    
    // Check expiration
    if (data.expires_at) {
      const expiresAt = new Date(data.expires_at);
      const now = new Date();
      
      if (expiresAt <= now) {
        return { valid: false, error: 'Token expired', expiresAt };
      }
      
      return { valid: true, expiresAt };
    }
    
    // If no expiration date, check if token is not too old (security measure)
    const createdAt = new Date(data.created_at);
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    const isOld = Date.now() - createdAt.getTime() > maxAge;
    
    if (isOld) {
      return { valid: false, error: 'Token too old (security policy)' };
    }
    
    return { valid: true };
  } catch (error) {
    console.error('Error checking token validity:', error);
    return { valid: false, error: 'Failed to check token validity' };
  }
}

/**
 * Refresh an OAuth token using a refresh token
 */
export async function refreshOAuthToken(
  userId: string,
  provider: string,
  refreshToken?: string,
  requestInfo?: { ip?: string; userAgent?: string }
): Promise<{ success: boolean; newToken?: string; error?: string }> {
  const timestamp = new Date().toISOString();
  
  try {
    // For GitHub, OAuth tokens generally don't expire or have refresh tokens
    // This function is primarily for future support of other providers
    if (provider === 'github') {
      return { 
        success: false, 
        error: 'GitHub tokens generally do not require refresh. Consider re-authentication if token is invalid.' 
      };
    }
    
    if (!refreshToken) {
      return { success: false, error: 'No refresh token available' };
    }
    
    // For other providers (future implementation)
    // This would make an API call to the provider's token refresh endpoint
    
    await logSecurityEvent({
      user_id: userId,
      action: 'token_refreshed',
      provider,
      ip_address: requestInfo?.ip,
      user_agent: requestInfo?.userAgent,
      success: false,
      error_message: 'Token refresh not implemented for this provider',
      timestamp,
    });
    
    return { success: false, error: 'Token refresh not implemented for this provider' };
  } catch (error) {
    console.error('Error refreshing token:', error);
    
    await logSecurityEvent({
      user_id: userId,
      action: 'token_refreshed',
      provider,
      ip_address: requestInfo?.ip,
      user_agent: requestInfo?.userAgent,
      success: false,
      error_message: error instanceof Error ? error.message : 'Unknown error',
      timestamp,
    });
    
    return { success: false, error: 'Failed to refresh token' };
  }
}

/**
 * Check if a token needs refresh soon (within next hour)
 */
export async function shouldRefreshToken(
  userId: string,
  provider: string
): Promise<{ shouldRefresh: boolean; expiresAt?: Date; error?: string }> {
  try {
    const { valid, expiresAt, error } = await isTokenValid(userId, provider);
    
    if (error) {
      return { shouldRefresh: false, error };
    }
    
    if (!valid) {
      return { shouldRefresh: true, expiresAt };
    }
    
    if (!expiresAt) {
      // No expiration date, assume token doesn't need refresh
      return { shouldRefresh: false };
    }
    
    // Check if token expires within next hour
    const now = new Date();
    const refreshThreshold = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
    
    const shouldRefresh = expiresAt <= refreshThreshold;
    
    return { shouldRefresh, expiresAt };
  } catch (error) {
    console.error('Error checking if token should refresh:', error);
    return { shouldRefresh: false, error: 'Failed to check refresh status' };
  }
}

/**
 * Background job to check and refresh tokens that are close to expiring
 */
export async function performTokenHealthCheck(): Promise<{ checked: number; refreshed: number; errors: number }> {
  try {
    const supabase = createSupabaseClient();
    
    // Get all tokens that expire within the next 2 hours
    const cutoffTime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    
    const { data: tokens, error } = await supabase
      .from('oauth_tokens')
      .select('user_id, provider, expires_at')
      .lt('expires_at', cutoffTime);
    
    if (error) {
      throw new Error(`Failed to fetch expiring tokens: ${error.message}`);
    }
    
    let checked = 0;
    let refreshed = 0;
    let errors = 0;
    
    for (const token of tokens || []) {
      try {
        checked++;
        
        const { shouldRefresh } = await shouldRefreshToken(token.user_id, token.provider);
        
        if (shouldRefresh) {
          const result = await refreshOAuthToken(token.user_id, token.provider);
          if (result.success) {
            refreshed++;
          } else {
            errors++;
            console.warn(`Failed to refresh token for user ${token.user_id} provider ${token.provider}: ${result.error}`);
          }
        }
      } catch (error) {
        console.error(`Error checking token for user ${token.user_id}:`, error);
        errors++;
      }
    }
    
    return { checked, refreshed, errors };
  } catch (error) {
    console.error('Error in token health check:', error);
    throw error;
  }
}

/**
 * Security utility: Rotate encryption for all stored tokens (admin function)
 */
export async function rotateTokenEncryption(): Promise<{ rotated: number; errors: number }> {
  try {
    const supabase = createSupabaseClient();
    
    const { data: tokens, error } = await supabase
      .from('oauth_tokens')
      .select('*');
    
    if (error) {
      throw new Error(`Failed to fetch tokens: ${error.message}`);
    }
    
    let rotated = 0;
    let errors = 0;
    
    for (const token of tokens || []) {
      try {
        // Decrypt with old encryption
        const decryptedToken = await decryptToken(token.encrypted_token, token.iv, token.auth_tag);
        
        // Re-encrypt with new encryption (uses current key)
        const { encrypted, iv, authTag } = await encryptToken(decryptedToken);
        
        // Update in database
        await supabase
          .from('oauth_tokens')
          .update({
            encrypted_token: encrypted,
            iv,
            auth_tag: authTag,
            updated_at: new Date().toISOString(),
            token_version: (token.token_version || 0) + 1,
          })
          .eq('id', token.id);
        
        rotated++;
      } catch (error) {
        console.error(`Failed to rotate token ${token.id}:`, error);
        errors++;
      }
    }
    
    return { rotated, errors };
  } catch (error) {
    console.error('Error in token rotation:', error);
    throw error;
  }
} 