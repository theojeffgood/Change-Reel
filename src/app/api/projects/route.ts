import { NextResponse } from 'next/server';
import { getServerSession, Session } from 'next-auth';
import { authConfig } from '@/lib/auth/config';
import { getServiceRoleSupabaseService } from '@/lib/supabase/client';

export async function GET() {
  const session = (await getServerSession(authConfig)) as Session | null;

  if (!session?.user?.githubId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabaseService = getServiceRoleSupabaseService();
    const { data: user, error: userError } = await supabaseService.users.getUserByGithubId(String(session.user.githubId));

    if (userError || !user) {
      const errorMessage = userError ? userError.message : 'User not found';
      return NextResponse.json({ error: errorMessage }, { status: 404 });
    }

    const { data: project, error: projectError } = await supabaseService.projects.getProjectByUserId(user.id);

    if (projectError) {
      console.error('Error fetching project:', projectError);
      return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 });
    }
    
    if (!project) {
      return NextResponse.json({ project: null }, { status: 200 });
    }

    // Don't expose sensitive details. The 'webhook_secret' is sensitive.
    const { webhook_secret, ...safeProject } = project;

    return NextResponse.json({ project: safeProject });
  } catch (error) {
    console.error('Error fetching project config:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: `Internal Server Error: ${errorMessage}` }, { status: 500 });
  }
} 