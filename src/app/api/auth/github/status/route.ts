export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth/config';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authConfig);
    if (!session?.user) {
      // Not authenticated
      return NextResponse.json({ connected: false, user: null, repository: null });
    }

    // GitHub App model: do not rely on user OAuth tokens here
    return NextResponse.json({
      connected: true,
      user: {
        id: Number((session.user as any).githubId) || 0,
        login: (session.user as any).login || null,
        name: (session.user as any).name || null,
        avatar_url: (session.user as any).image || null,
        email: (session.user as any).email || null,
      },
      repository: null,
    });
  } catch (error) {
    console.error('Error checking OAuth status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}