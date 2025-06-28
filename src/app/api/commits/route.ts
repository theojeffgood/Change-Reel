import { NextResponse } from 'next/server';
import { getServerSession, Session } from 'next-auth';
import { authConfig } from '@/lib/auth/config';
import { getSupabaseService } from '@/lib/supabase/client';

export async function GET(request: Request) {
  const session = (await getServerSession(authConfig)) as Session | null;

  if (!session?.user?.githubId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);

  try {
    const supabaseService = getSupabaseService();

    // First, get the user and their project
    const { data: user, error: userError } = await supabaseService.users.getUserByGithubId(String(session.user.githubId));
    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { data: project, error: projectError } = await supabaseService.projects.getProjectByUserId(user.id);
    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Then, get the commits for that project
    const { data, error: commitsError } = await supabaseService.commits.getCommitsByProjectId(
      project.id,
      page,
      pageSize,
    );

    if (commitsError) {
      return NextResponse.json({ error: commitsError.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 