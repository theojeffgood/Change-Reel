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

    // Filter to tracked projects only
    const tracked = (projects || []).filter((p: any) => p.is_tracked !== false);
    if (!tracked.length) {
      return NextResponse.json({ commits: [], count: 0 });
    }
    const projectIds = tracked.map(p => p.id);
    const projectIdToRepoName: Record<string, string> = Object.fromEntries(
      tracked.map(p => [p.id, p.repo_name || p.name || ''])
    );

    // Paginated commits across all projects (including those without summaries)
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data: commits, error: queryError, count } = await supabaseService
      .getClient()
      .from('commits')
      .select('*', { count: 'exact' })
      .in('project_id', projectIds)
      .order('timestamp', { ascending: false })
      .range(from, to);

    if (queryError) {
      return NextResponse.json({ error: queryError.message }, { status: 500 });
    }

    // For commits without summaries, fetch the latest failed generate_summary job to get error info
    const commitsWithoutSummary = (commits || []).filter((c: any) => !c.summary);
    const commitIds = commitsWithoutSummary.map((c: any) => c.id);
    
    let insufficientCreditsCommitIds = new Set<string>();
    if (commitIds.length > 0) {
      const { data: failedJobs } = await supabaseService
        .getClient()
        .from('jobs')
        .select('commit_id, error_message, status')
        .in('commit_id', commitIds)
        .eq('type', 'generate_summary')
        .eq('status', 'failed')
        .eq('error_message', 'Insufficient credits')
        .order('created_at', { ascending: false });
      
      // Track which commits failed due to insufficient credits
      if (failedJobs) {
        insufficientCreditsCommitIds = new Set(failedJobs.map((job: any) => job.commit_id));
      }
    }

    // Filter to only show commits that either:
    // 1. Have a summary, OR
    // 2. Failed specifically due to insufficient credits
    const visibleCommits = (commits || []).filter((c: any) => 
      c.summary || insufficientCreditsCommitIds.has(c.id)
    );

    // Enrich with repository_name and insufficient credits flag
    const enriched = visibleCommits.map((c: any) => ({
      ...c,
      repository_name: projectIdToRepoName[c.project_id] || '',
      failed_job: insufficientCreditsCommitIds.has(c.id) ? { error_message: 'Insufficient credits' } : null,
    }));

    return NextResponse.json({ commits: enriched, count: visibleCommits.length });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 