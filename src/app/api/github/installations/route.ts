export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth/config';
import { listAppInstallations } from '@/lib/github/app-auth';

export async function GET(_request: NextRequest) {
  const session = await getServerSession(authConfig);
  if (!session?.user?.githubId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const installs = await listAppInstallations();
    return NextResponse.json({ installations: installs });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to list installations' }, { status: 500 });
  }
}


