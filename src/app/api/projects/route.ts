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

    // Get all projects for the user (now supports multiple repositories)
    const { data: projects, error: projectsError } = await supabaseService.projects.getProjectsByUser(user.id);

    if (projectsError) {
      console.error('Error fetching projects:', projectsError);
      return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
    }
    
    if (!projects || projects.length === 0) {
      return NextResponse.json({ project: null, projects: [] }, { status: 200 });
    }

    // For backward compatibility, return the first project as the "current" project
    // TODO: Add repository selection UI to choose which project to view
    const currentProject = projects[0];

    // webhook_secret is deprecated in GitHub App model, no longer sensitive
    return NextResponse.json({ 
      project: currentProject,
      projects // Include all projects for future repository selector
    });
  } catch (error) {
    console.error('Error fetching project config:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: `Internal Server Error: ${errorMessage}` }, { status: 500 });
  }
} 