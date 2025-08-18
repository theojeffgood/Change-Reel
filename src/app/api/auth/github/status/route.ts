export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth/config';
import { getOAuthToken, isTokenValid } from '@/lib/auth/token-storage';

export async function GET(request: NextRequest) {
  try {
    // Get the session to verify user is authenticated
    const session = await getServerSession(authConfig);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Check if user has a valid GitHub token
    const { valid, error: validityError } = await isTokenValid(
      session.user.id,
      'github'
    );

    if (validityError) {
      return NextResponse.json(
        { error: `Token validation failed: ${validityError}` },
        { status: 500 }
      );
    }

    if (!valid) {
      return NextResponse.json({
        connected: false,
        user: null,
        repository: null,
      });
    }

    // Get the token and fetch user/repository information
    const { token, error: tokenError } = await getOAuthToken(
      session.user.id,
      'github'
    );

    if (tokenError || !token) {
      return NextResponse.json({
        connected: false,
        user: null,
        repository: null,
        error: tokenError || 'No token found',
      });
    }

    // Fetch GitHub user information
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'Change-Reel/1.0',
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!userResponse.ok) {
      return NextResponse.json({
        connected: false,
        user: null,
        repository: null,
        error: 'Failed to fetch user information',
      });
    }

    const userData = await userResponse.json();

    // For now, return basic connection status
    // In the future, we'll also fetch selected repository information
    return NextResponse.json({
      connected: true,
      user: {
        id: userData.id,
        login: userData.login,
        name: userData.name,
        avatar_url: userData.avatar_url,
        email: userData.email,
      },
      repository: null, // TODO: Store and retrieve selected repository
      scopes: session.accessToken ? await getTokenScopes(token) : [],
    });
  } catch (error) {
    console.error('Error checking OAuth status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Helper function to get token scopes from GitHub
 */
async function getTokenScopes(token: string): Promise<string[]> {
  try {
    const authToken = String(token).trim();
    const response = await fetch('https://api.github.com/user', {
      method: 'HEAD',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'User-Agent': 'Change-Reel/1.0',
      },
    });

    const scopes = response.headers.get('X-OAuth-Scopes');
    return scopes ? scopes.split(', ').map(s => s.trim()) : [];
  } catch (error) {
    console.error('Error fetching token scopes:', error);
    return [];
  }
} 