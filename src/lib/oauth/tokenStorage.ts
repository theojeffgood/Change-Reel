/**
 * OAuth Token Storage Service
 * Handles CRUD operations for OAuth tokens with encryption
 */

import { createClient } from '@supabase/supabase-js';
import { TokenEncryptionService, EncryptedToken } from './tokenEncryption';

export interface OAuthToken {
  id?: string;
  user_id: string;
  provider: string;
  access_token: string;
  refresh_token?: string;
  expires_at?: Date;
  token_type?: string;
  scope?: string;
  created_at?: Date;
  updated_at?: Date;
  token_version?: number;
}

export interface StoredOAuthToken {
  id: string;
  user_id: string;
  provider: string;
  encrypted_access_token: string;
  encrypted_refresh_token?: string;
  expires_at?: string;
  token_type?: string;
  scope?: string;
  created_at: string;
  updated_at: string;
  token_version: number;
}

export class TokenStorageService {
  private supabaseClient: any;
  private encryptionService: TokenEncryptionService;

  constructor(supabaseUrl: string, supabaseKey: string, encryptionKey: string) {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL and key are required');
    }
    
    this.supabaseClient = createClient(supabaseUrl, supabaseKey);
    this.encryptionService = new TokenEncryptionService(encryptionKey);
  }

  /**
   * Store a new OAuth token
   */
  async storeToken(token: OAuthToken): Promise<{ data: StoredOAuthToken | null; error: Error | null }> {
    try {
      this.validateToken(token);

      const encryptedAccessToken = this.encryptionService.encrypt(token.access_token);
      const encryptedRefreshToken = token.refresh_token 
        ? this.encryptionService.encrypt(token.refresh_token)
        : null;

      const tokenData = {
        user_id: token.user_id,
        provider: token.provider,
        encrypted_access_token: JSON.stringify(encryptedAccessToken),
        encrypted_refresh_token: encryptedRefreshToken ? JSON.stringify(encryptedRefreshToken) : null,
        expires_at: token.expires_at?.toISOString(),
        token_type: token.token_type || 'Bearer',
        scope: token.scope,
        token_version: token.token_version || 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await this.supabaseClient
        .from('oauth_tokens')
        .insert(tokenData)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to store token: ${error.message}`);
      }

      return { data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }

  /**
   * Retrieve and decrypt an OAuth token
   */
  async getToken(userId: string, provider: string): Promise<{ data: OAuthToken | null; error: Error | null }> {
    try {
      const { data, error } = await this.supabaseClient
        .from('oauth_tokens')
        .select('*')
        .eq('user_id', userId)
        .eq('provider', provider)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return { data: null, error: null }; // No token found
        }
        throw new Error(`Failed to retrieve token: ${error.message}`);
      }

      const decryptedToken = this.decryptStoredToken(data);
      return { data: decryptedToken, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }

  /**
   * Update an existing OAuth token
   */
  async updateToken(userId: string, provider: string, updates: Partial<OAuthToken>): Promise<{ data: StoredOAuthToken | null; error: Error | null }> {
    try {
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (updates.access_token) {
        const encryptedAccessToken = this.encryptionService.encrypt(updates.access_token);
        updateData.encrypted_access_token = JSON.stringify(encryptedAccessToken);
      }

      if (updates.refresh_token) {
        const encryptedRefreshToken = this.encryptionService.encrypt(updates.refresh_token);
        updateData.encrypted_refresh_token = JSON.stringify(encryptedRefreshToken);
      }

      if (updates.expires_at) {
        updateData.expires_at = updates.expires_at.toISOString();
      }

      if (updates.scope) {
        updateData.scope = updates.scope;
      }

      const { data, error } = await this.supabaseClient
        .from('oauth_tokens')
        .update(updateData)
        .eq('user_id', userId)
        .eq('provider', provider)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update token: ${error.message}`);
      }

      return { data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }

  /**
   * Delete an OAuth token
   */
  async deleteToken(userId: string, provider: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await this.supabaseClient
        .from('oauth_tokens')
        .delete()
        .eq('user_id', userId)
        .eq('provider', provider);

      if (error) {
        throw new Error(`Failed to delete token: ${error.message}`);
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }

  /**
   * List all tokens for a user
   */
  async listTokens(userId: string): Promise<{ data: OAuthToken[] | null; error: Error | null }> {
    try {
      const { data, error } = await this.supabaseClient
        .from('oauth_tokens')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Failed to list tokens: ${error.message}`);
      }

      const decryptedTokens = data.map((token: StoredOAuthToken) => this.decryptStoredToken(token));
      return { data: decryptedTokens, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }

  /**
   * Check if a token exists
   */
  async tokenExists(userId: string, provider: string): Promise<{ exists: boolean; error: Error | null }> {
    try {
      const { data, error } = await this.supabaseClient
        .from('oauth_tokens')
        .select('id')
        .eq('user_id', userId)
        .eq('provider', provider)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new Error(`Failed to check token existence: ${error.message}`);
      }

      return { exists: !!data, error: null };
    } catch (error) {
      return { exists: false, error: error as Error };
    }
  }

  /**
   * Validate token data
   */
  private validateToken(token: OAuthToken): void {
    if (!token.user_id || !token.provider || !token.access_token) {
      throw new Error('Token must have user_id, provider, and access_token');
    }

    if (token.provider.length > 50) {
      throw new Error('Provider name too long (max 50 characters)');
    }

    if (token.access_token.length > 2000) {
      throw new Error('Access token too long (max 2000 characters)');
    }

    if (token.refresh_token && token.refresh_token.length > 2000) {
      throw new Error('Refresh token too long (max 2000 characters)');
    }
  }

  /**
   * Decrypt a stored token
   */
  private decryptStoredToken(storedToken: StoredOAuthToken): OAuthToken {
    const encryptedAccessToken: EncryptedToken = JSON.parse(storedToken.encrypted_access_token);
    const accessToken = this.encryptionService.decrypt(encryptedAccessToken);

    let refreshToken: string | undefined;
    if (storedToken.encrypted_refresh_token) {
      const encryptedRefreshToken: EncryptedToken = JSON.parse(storedToken.encrypted_refresh_token);
      refreshToken = this.encryptionService.decrypt(encryptedRefreshToken);
    }

    return {
      id: storedToken.id,
      user_id: storedToken.user_id,
      provider: storedToken.provider,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: storedToken.expires_at ? new Date(storedToken.expires_at) : undefined,
      token_type: storedToken.token_type,
      scope: storedToken.scope,
      created_at: new Date(storedToken.created_at),
      updated_at: new Date(storedToken.updated_at),
      token_version: storedToken.token_version
    };
  }
} 