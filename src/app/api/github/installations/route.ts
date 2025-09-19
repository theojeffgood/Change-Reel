export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getToken } from 'next-auth/jwt';
import { authConfig } from '@/lib/auth/config';
import { listUserInstallations } from '@/lib/github/app-auth';
import { getServiceRoleSupabaseService } from '@/lib/supabase/client';

interface InstallationResponse {
  id: number;
  account?: { login: string; type?: string };
  repositories_url: string;
  target_type?: string;
  permissions?: Record<string, string>;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authConfig);
  if (!session?.user?.githubId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    // Prefer user-scoped installations to ensure only the current user's
    // installations are shown in the /config UI.
    const jwt = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    const userAccessToken = (jwt as any)?.accessToken as string | undefined;
    const tokenError = (jwt as any)?.accessTokenError as string | undefined;
    const tokenExpiresAt = typeof (jwt as any)?.accessTokenExpires === 'number'
      ? (jwt as any).accessTokenExpires as number
      : undefined;

    let installations: InstallationResponse[] = [];
    let effectiveTokenError = tokenError;

    const tokenValid = userAccessToken && (!tokenExpiresAt || Date.now() < tokenExpiresAt);

    if (userAccessToken && !tokenValid) {
      effectiveTokenError = effectiveTokenError || 'refresh_required';
    }

    if (tokenValid && userAccessToken) {
      try {
        installations = await listUserInstallations(userAccessToken);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const isAuthError = message.includes('401') || message.toLowerCase().includes('bad credentials');
        if (isAuthError) {
          effectiveTokenError = effectiveTokenError || 'refresh_required';
          console.debug('[github/installations] user token invalid, relying on stored installations');
        } else {
          console.warn('[github/installations] user installation lookup failed, falling back to stored data', err);
        }
      }
    }

    return NextResponse.json({ installations, tokenError: effectiveTokenError || undefined });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to list installations' }, { status: 500 });
  }
}
