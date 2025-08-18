export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth/config';
import { 
  refreshOAuthToken, 
  revokeOAuthToken, 
  isTokenValid, 
  shouldRefreshToken,
  performTokenHealthCheck
} from '@/lib/auth/token-storage';

interface TokenActionRequest {
  action: 'refresh' | 'revoke' | 'status' | 'health-check';
  provider?: string;
}

interface TokenStatusResponse {
  success: boolean;
  action: string;
  data?: any;
  message?: string;
  error?: string;
}

// Helper to get request info for security logging
function getRequestInfo(request: NextRequest) {
  return {
    ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
  };
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authConfig);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized', error: 'No valid session' },
        { status: 401 }
      );
    }

    const body: TokenActionRequest = await request.json();
    const requestInfo = getRequestInfo(request);

    switch (body.action) {
      case 'refresh':
        return await handleTokenRefresh(session.user.id, body.provider || 'github', requestInfo);
      
      case 'revoke':
        return await handleTokenRevocation(session.user.id, body.provider || 'github', requestInfo);
      
      case 'status':
        return await handleTokenStatus(session.user.id, body.provider || 'github');
      
      case 'health-check':
        return await handleHealthCheck();
      
      default:
        return NextResponse.json(
          { success: false, message: 'Invalid action', error: 'Action must be refresh, revoke, status, or health-check' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in token management API:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: 'Failed to process token action' },
      { status: 500 }
    );
  }
}

async function handleTokenRefresh(
  userId: string, 
  provider: string, 
  requestInfo: { ip: string; userAgent: string }
): Promise<NextResponse<TokenStatusResponse>> {
  const result = await refreshOAuthToken(userId, provider, undefined, requestInfo);
  
  if (result.success) {
    return NextResponse.json({
      success: true,
      action: 'refresh',
      message: 'Token refreshed successfully',
      data: { newTokenAvailable: !!result.newToken }
    });
  } else {
    return NextResponse.json(
      {
        success: false,
        action: 'refresh',
        message: 'Token refresh failed',
        error: result.error
      },
      { status: result.error?.includes('not implemented') ? 501 : 400 }
    );
  }
}

async function handleTokenRevocation(
  userId: string, 
  provider: string, 
  requestInfo: { ip: string; userAgent: string }
): Promise<NextResponse<TokenStatusResponse>> {
  const result = await revokeOAuthToken(userId, provider, requestInfo);
  
  if (result.success) {
    return NextResponse.json({
      success: true,
      action: 'revoke',
      message: 'Token revoked successfully',
      data: { revoked: true }
    });
  } else {
    return NextResponse.json(
      {
        success: false,
        action: 'revoke',
        message: 'Token revocation failed',
        error: result.error
      },
      { status: 400 }
    );
  }
}

async function handleTokenStatus(
  userId: string, 
  provider: string
): Promise<NextResponse<TokenStatusResponse>> {
  const [validityResult, refreshResult] = await Promise.all([
    isTokenValid(userId, provider),
    shouldRefreshToken(userId, provider)
  ]);
  
  return NextResponse.json({
    success: true,
    action: 'status',
    data: {
      isValid: validityResult.valid,
      expiresAt: validityResult.expiresAt,
      shouldRefresh: refreshResult.shouldRefresh,
      error: validityResult.error || refreshResult.error
    }
  });
}

async function handleHealthCheck(): Promise<NextResponse<TokenStatusResponse>> {
  try {
    const result = await performTokenHealthCheck();
    
    return NextResponse.json({
      success: true,
      action: 'health-check',
      message: `Health check completed. Checked ${result.checked} tokens.`,
      data: {
        checked: result.checked,
        refreshed: result.refreshed,
        errors: result.errors
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        action: 'health-check',
        message: 'Health check failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET endpoint for checking token status without actions
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authConfig);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized', error: 'No valid session' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider') || 'github';

    return await handleTokenStatus(session.user.id, provider);
  } catch (error) {
    console.error('Error checking token status:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: 'Failed to check token status' },
      { status: 500 }
    );
  }
} 