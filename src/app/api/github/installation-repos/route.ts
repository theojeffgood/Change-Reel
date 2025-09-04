export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth/config';
import { listInstallationRepositories } from '@/lib/github/app-auth';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authConfig);
  if (!session?.user?.githubId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const installationId = Number(searchParams.get('installation_id'));
  if (!installationId || Number.isNaN(installationId)) {
    return NextResponse.json({ error: 'installation_id is required' }, { status: 400 });
  }
  try {
    const repos = await listInstallationRepositories(installationId);
    return NextResponse.json({ repositories: repos });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to list repositories' }, { status: 500 });
  }
}


