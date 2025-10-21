import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth/config';
import { getServiceRoleSupabaseService } from '@/lib/supabase/client';

interface ConfigRequest {
  installationId?: number;
  emailRecipients?: string[];
  repositories?: string[];
}

interface ConfigResponse {
  success: boolean;
  message: string;
  project?: any;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<ConfigResponse>> {
  try {
    // Check authentication
    const session = await getServerSession(authConfig);
    if (!session?.user?.githubId) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized', error: 'No authenticated session' },
        { status: 401 }
      );
    }

    console.log('Session user:', {
      githubId: session.user.githubId,
      email: session.user.email,
      name: session.user.name
    });

    // Parse request body
    const body: ConfigRequest = await request.json();
    const { installationId } = body;

    const repositories = Array.from(
      new Set(
        Array.isArray(body.repositories)
          ? body.repositories
          .map(repo => (typeof repo === 'string' ? repo.trim() : ''))
          .filter(repo => repo.includes('/'))
          : []
      )
    );

    if (repositories.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields', error: 'At least one repository must be selected' },
        { status: 400 }
      );
    }

    if (!installationId) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields', error: 'Installation ID is required' },
        { status: 400 }
      );
    }

    // Normalize/validate emails server-side (accept array or comma-separated string)
    const rawEmailsValue = (body as any)?.emailRecipients;
    const rawEmails = Array.isArray(rawEmailsValue)
      ? rawEmailsValue
      : (typeof rawEmailsValue === 'string' ? rawEmailsValue.split(',') : []);
    const normalizedEmails = rawEmails
      .map((e: any) => (typeof e === 'string' ? e.trim() : ''))
      .filter((e: string) => e.length > 0);
    const hasEmailField = Object.prototype.hasOwnProperty.call(body, 'emailRecipients');

    // Get Supabase service (using service role for server-side operations)
    const supabaseService = getServiceRoleSupabaseService();
    console.log('Using service role Supabase client for database operations');

    // Get or create user
    console.log('Attempting to get user by GitHub ID:', session.user.githubId);
    const userResult = await supabaseService.users.getUserByGithubId(String(session.user.githubId));
    console.log('User lookup result:', { data: userResult.data, error: userResult.error?.message });
    let user = userResult.data;
    
    if (!user) {
      console.log('User not found, creating new user...');
      // Create user without requiring email; email may be backfilled later
      const newUser = {
        github_id: String(session.user.githubId),
        email: typeof session.user.email === 'string' && session.user.email.trim() ? session.user.email.trim() : undefined,
        name: session.user.name || '',
      };
      console.log('Creating user with data:', newUser);
      
      const createUserResult = await supabaseService.users.createUser(newUser);
      console.log('User creation result:', { data: !!createUserResult.data, error: createUserResult.error?.message });
      if (createUserResult.error || !createUserResult.data) {
        console.error('User creation failed:', createUserResult.error);
        return NextResponse.json(
          { success: false, message: 'Failed to create user', error: createUserResult.error?.message },
          { status: 500 }
        );
      }
      user = createUserResult.data;
      console.log('User created successfully:', user.id);
    } else {
      console.log('Existing user found:', user.id);
    }

    if (!user) {
      console.error('User is null after creation attempt');
      return NextResponse.json(
        { success: false, message: 'User creation failed' },
        { status: 500 }
      );
    }

    // Fetch all projects owned by the user once for reuse
    const userProjectsResult = await supabaseService.projects.getProjectsByUser(user.id);
    if (userProjectsResult.error) {
      console.error('Failed to load existing projects:', userProjectsResult.error.message);
    }
    const userProjects = userProjectsResult.data || [];
    const projectMap = new Map<string, any>();
    for (const project of userProjects) {
      if (project?.repo_name) {
        projectMap.set(project.repo_name, project);
      }
    }

    const updatedProjects: string[] = [];

    for (const repositoryFullName of repositories) {
      const [owner, repoName] = repositoryFullName.split('/');
      if (!owner || !repoName) {
        console.error('Invalid repository format:', repositoryFullName);
        return NextResponse.json(
          { success: false, message: 'Invalid repository format', error: 'Repository should be in format owner/repo' },
          { status: 400 }
        );
      }

      // Prepare project payload
      const baseProjectData: any = {
        name: `${owner}/${repoName}`,
        repo_name: repositoryFullName,
        provider: 'github' as const,
        installation_id: installationId,
        is_tracked: true,
      };

      if (hasEmailField) {
        baseProjectData.email_distribution_list = normalizedEmails;
      } else if (typeof user.email === 'string' && user.email && !user.email.endsWith('@users.noreply.github.com')) {
        baseProjectData.email_distribution_list = [user.email];
      }

      const existingProject = projectMap.get(repositoryFullName);
      if (existingProject) {
        const updateResult = await supabaseService.projects.updateProject(
          existingProject.id,
          baseProjectData
        );
        if (updateResult.error) {
          console.error('Project update failed:', updateResult.error);
          return NextResponse.json(
            { success: false, message: 'Failed to update project', error: updateResult.error.message },
            { status: 500 }
          );
        }
      } else {
        const defaultEmails = baseProjectData.email_distribution_list && Array.isArray(baseProjectData.email_distribution_list)
          ? baseProjectData.email_distribution_list
          : [];
        const createResult = await supabaseService.projects.createProject({
          ...baseProjectData,
          user_id: user.id,
          email_distribution_list: defaultEmails,
        });
        if (createResult.error) {
          console.error('Project creation failed:', createResult.error);
          return NextResponse.json(
            { success: false, message: 'Failed to create project', error: createResult.error.message },
            { status: 500 }
          );
        }
      }

      updatedProjects.push(repositoryFullName);
    }

    // Update tracked flag across user's repos to match selection
    try {
      for (const project of projectMap.values()) {
        const repoName = project.repo_name || project.name;
        if (!repoName) continue;
        const shouldTrack = repositories.includes(repoName);
        if ((project as any).is_tracked !== shouldTrack) {
          await supabaseService.projects.updateProject(project.id, { is_tracked: shouldTrack } as any);
        }
      }
    } catch (e) {
      console.warn('[config] failed to update tracked flags', (e as any)?.message);
    }

    // Automatically upsert installation mapping and register all repos for this installation
    if (installationId) {
      try {
        // Upsert installations row using service
        const { createInstallationService } = await import('@/lib/supabase/services/installations');
        const installationsSvc = createInstallationService(supabaseService.getClient());
        await installationsSvc.upsertInstallation({
          installation_id: installationId,
          provider: 'github',
          user_id: user.id,
        });

        // Sync all repos for installation
        const { listInstallationRepositories } = await import('@/lib/github/app-auth');
        const repos = await listInstallationRepositories(installationId);
        for (const r of repos) {
          const existing = await supabaseService.projects.getProjectByRepository(r.full_name)
          if (!existing.data) {
            await supabaseService.projects.createProject({
              user_id: user.id,
              name: r.full_name,
              repo_name: r.full_name,
              provider: 'github',
              installation_id: installationId,
              email_distribution_list: [],
            })
          }
        }
      } catch (e) {
        console.warn('[config] installation auto-sync skipped', (e as any)?.message)
      }
    }

    // In GitHub App model, webhooks are automatically delivered to the app-level webhook URL
    // No need for repository-specific webhook creation
    console.log('Configuration saved successfully. Webhooks handled at app level.');
    
    return NextResponse.json({
      success: true,
      message: 'Configuration saved successfully! Webhooks are automatically handled by the GitHub App.',
      repositories: updatedProjects,
    });

  } catch (error) {
    console.error('Config save error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Internal server error', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

export async function GET(): Promise<NextResponse> {
  try {
    // Check authentication
    const session = await getServerSession(authConfig);
    if (!session?.user?.githubId) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized', error: 'No authenticated session' },
        { status: 401 }
      );
    }

    // Get Supabase service
    const supabaseService = getServiceRoleSupabaseService();
    
    // Get user
    const userResult = await supabaseService.users.getUserByGithubId(String(session.user.githubId));
    const user = userResult.data;
    
    if (!user) {
      return NextResponse.json({
        success: true,
        configuration: null,
        message: 'No configuration found'
      });
    }

    const projectsResult = await supabaseService.projects.getProjectsByUser(user.id);
    const projects = projectsResult.data || [];

    if (!projects || projects.length === 0) {
      return NextResponse.json({
        success: true,
        configuration: null,
        message: 'No configuration found'
      });
    }

    const latestProject = await supabaseService.projects.getLatestProjectForUser(user.id);
    const trackedProjects = projects.filter((project: any) => project.is_tracked !== false);
    const selectedRepos = trackedProjects.length > 0 ? trackedProjects : projects;
    const uniqueEmails = Array.from(
      new Set(
        selectedRepos.flatMap((project: any) => Array.isArray(project.email_distribution_list) ? project.email_distribution_list : [])
      )
    );
    const installationId = selectedRepos.find(project => project.installation_id)?.installation_id ?? null;
    const referenceProject = latestProject ?? selectedRepos[0];

    // Return configuration (without sensitive data)
    return NextResponse.json({
      success: true,
      configuration: {
        repositories: selectedRepos.map(project => project.repo_name || project.name).filter(Boolean),
        emailRecipients: uniqueEmails,
        provider: referenceProject?.provider,
        createdAt: referenceProject?.created_at,
        updatedAt: referenceProject?.updated_at,
        installationId,
      }
    });

  } catch (error) {
    console.error('Config GET error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Internal server error', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
