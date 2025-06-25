import crypto from 'crypto';
import { createSupabaseClient } from '@/lib/supabase/client';

// Security: Use environment variable for encryption key, with strict validation
const ENCRYPTION_KEY_RAW = process.env.TOKEN_ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-cbc';
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

/**
 * Enhanced encryption using PBKDF2 for key derivation
 */
function encryptToken(token: string): { encrypted: string; iv: string; authTag: string } {
  const iv = crypto.randomBytes(16);
  const key = crypto.pbkdf2Sync(ENCRYPTION_KEY, TOKEN_SALT, KEY_DERIVATION_ITERATIONS, 32, 'sha256');
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: '', // CBC mode doesn't use auth tags, kept for interface compatibility
  };
}

/**
 * Enhanced decryption using PBKDF2 for key derivation
 */
function decryptToken(encrypted: string, iv: string, authTag: string): string {
  const key = crypto.pbkdf2Sync(ENCRYPTION_KEY, TOKEN_SALT, KEY_DERIVATION_ITERATIONS, 32, 'sha256');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Security audit logging for token operations
 */
async function logSecurityEvent(auditLog: SecurityAuditLog): Promise<void> {
  try {
    const supabase = createSupabaseClient();
    
    // Hash sensitive data for audit logs
    const hashedUserId = crypto.createHash('sha256')
      .update(auditLog.user_id + AUDIT_SALT)
      .digest('hex');
    
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
    
    const { encrypted, iv, authTag } = encryptToken(tokenData.accessToken);
    
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
    
    const decryptedToken = decryptToken(
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
        const decryptedToken = decryptToken(token.encrypted_token, token.iv, token.auth_tag);
        
        // Re-encrypt with new encryption (uses current key)
        const { encrypted, iv, authTag } = encryptToken(decryptedToken);
        
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