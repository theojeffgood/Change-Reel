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

    let installations: InstallationResponse[] = [];

    if (userAccessToken) {
      try {
        installations = await listUserInstallations(userAccessToken);
      } catch (err) {
        console.warn('[github/installations] user installation lookup failed, falling back to stored data', err);
      }
    }

    // If the user-scoped token is missing or returned no installations, fall back to
    // the installations stored for the current user in Supabase. This ensures that
    // users who already configured the app (or who lost the OAuth token) still see
    // their installations and can continue to the dashboard without being blocked.
    if (!installations.length) {
      const supabaseService = getServiceRoleSupabaseService();
      const userResult = await supabaseService.users.getUserByGithubId(String(session.user.githubId));
      const user = userResult.data;

      if (user) {
        try {
          const { createInstallationService } = await import('@/lib/supabase/services/installations');
          const installationService = createInstallationService(supabaseService.getClient());
          const stored = await installationService.listInstallationsByUser(user.id);

          if (stored.data?.length) {
            installations = stored.data.map((inst) => ({
              id: inst.installation_id,
              account: inst.account_login
                ? { login: inst.account_login, type: inst.account_type }
                : undefined,
              repositories_url: '',
            }));
          }
        } catch (fallbackErr) {
          console.warn('[github/installations] failed to load stored installations', fallbackErr);
        }
      }
    }

    return NextResponse.json({ installations, tokenError: tokenError || undefined });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to list installations' }, { status: 500 });
  }
}
