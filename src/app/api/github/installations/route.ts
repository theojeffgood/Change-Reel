export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getToken } from 'next-auth/jwt';
import { authConfig } from '@/lib/auth/config';
import { listUserInstallations } from '@/lib/github/app-auth';

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

    if (userAccessToken) {
      const installs = await listUserInstallations(userAccessToken);
      return NextResponse.json({ installations: installs });
    }

    // Fallback (should not normally happen): return empty to avoid leaking other users' installations
    // Alternatively, we could throw an error to prompt re-auth.
    // return NextResponse.json({ error: 'Missing user access token' }, { status: 401 });
    return NextResponse.json({ installations: [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to list installations' }, { status: 500 });
  }
}
