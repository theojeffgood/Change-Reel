import { NextResponse } from 'next/server';
import { getServerSession, Session } from 'next-auth';
import { authConfig } from '@/lib/auth/config';
import { getServiceRoleSupabaseService } from '@/lib/supabase/client';

export async function GET(request: Request) {
  const session = (await getServerSession(authConfig)) as Session | null;

  if (!session?.user?.githubId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);

  try {
    const supabaseService = getServiceRoleSupabaseService();

    // First, get the user and their projects
    const { data: user, error: userError } = await supabaseService.users.getUserByGithubId(String(session.user.githubId));
    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get all projects for user
    const { data: projects, error: projectsError } = await supabaseService.projects.getProjectsByUser(user.id);
    if (projectsError) {
      return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
    }

    if (!projects || projects.length === 0) {
      return NextResponse.json({ commits: [], count: 0 });
    }

    const projectIds = projects.map(p => p.id);
    const projectIdToRepoName: Record<string, string> = Object.fromEntries(
      projects.map(p => [p.id, p.repo_name || p.name || ''])
    );

    // Paginated commits across all projects with summaries only
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data: commits, error: queryError, count } = await supabaseService
      .getClient()
      .from('commits')
      .select('*', { count: 'exact' })
      .in('project_id', projectIds)
      .not('summary', 'is', null)
      .order('timestamp', { ascending: false })
      .range(from, to);

    if (queryError) {
      return NextResponse.json({ error: queryError.message }, { status: 500 });
    }

    // Enrich with repository_name per commit for UI convenience
    const enriched = (commits || []).map((c: any) => ({
      ...c,
      repository_name: projectIdToRepoName[c.project_id] || '',
    }));

    return NextResponse.json({ commits: enriched, count: count || 0 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 