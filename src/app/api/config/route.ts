import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth/config';
import { getServiceRoleSupabaseService } from '@/lib/supabase/client';

interface ConfigRequest {
  repositoryFullName: string;
  installationId?: number;
  emailRecipients?: string[]; // Made optional
  trackedRepositories?: string[]; // New: list of repo full_names to track
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
    const { repositoryFullName, installationId, emailRecipients = [], trackedRepositories = [] } = body; // Default to empty array

    if (!repositoryFullName) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields', error: 'Repository is required' },
        { status: 400 }
      );
    }

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
      // Create user if doesn't exist
      const newUser = {
        github_id: String(session.user.githubId),
        email: session.user.email || '',
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

    // Parse repository name from full name (owner/repo)
    console.log('Parsing repository name:', repositoryFullName);
    const [owner, repoName] = repositoryFullName.split('/');
    if (!owner || !repoName) {
      console.error('Invalid repository format:', repositoryFullName);
      return NextResponse.json(
        { success: false, message: 'Invalid repository format', error: 'Repository should be in format owner/repo' },
        { status: 400 }
      );
    }
    console.log('Repository parsed successfully:', { owner, repoName });

    // Create or update project (webhook secrets handled at app level in GitHub App model)
    const projectData = {
      user_id: user.id,
      name: `${owner}/${repoName}`,
      repo_name: repositoryFullName,
      provider: 'github' as const,
      installation_id: installationId,
      email_distribution_list: emailRecipients,
    };
    console.log('Project data prepared:', projectData);

    // Check if project already exists for this user and repository
    console.log('Checking for existing project for user:', user.id, 'and repository:', repositoryFullName);
    const existingProjectResult = await supabaseService.projects.getProjectByUserAndRepository(user.id, repositoryFullName);
    console.log('Existing project lookup result:', { data: !!existingProjectResult.data, error: existingProjectResult.error?.message });
    const existingProject = existingProjectResult.data;
    
    let project;
    if (existingProject) {
      console.log('Updating existing project:', existingProject.id);
      // Update existing project
      const updateResult = await supabaseService.projects.updateProject(
        existingProject.id,
        projectData
      );
      console.log('Project update result:', { data: !!updateResult.data, error: updateResult.error?.message });
      if (updateResult.error) {
        console.error('Project update failed:', updateResult.error);
        return NextResponse.json(
          { success: false, message: 'Failed to update project', error: updateResult.error.message },
          { status: 500 }
        );
      }
      project = updateResult.data;
      console.log('Project updated successfully:', project?.id);
    } else {
      console.log('Creating new project...');
      // Create new project
      const createResult = await supabaseService.projects.createProject(projectData);
      console.log('Project creation result:', { data: !!createResult.data, error: createResult.error?.message });
      if (createResult.error) {
        console.error('Project creation failed:', createResult.error);
        return NextResponse.json(
          { success: false, message: 'Failed to create project', error: createResult.error.message },
          { status: 500 }
        );
      }
      project = createResult.data;
      console.log('Project created successfully:', project?.id);
    }
    // Update tracked flag across user's repos if provided
    try {
      if (Array.isArray(trackedRepositories)) {
        // Fetch all user projects
        const { data: userProjects } = await supabaseService.projects.getProjectsByUser(user.id);
        if (Array.isArray(userProjects)) {
          for (const p of userProjects) {
            const shouldTrack = trackedRepositories.includes(p.repo_name || p.name);
            if ((p as any).is_tracked !== shouldTrack) {
              await supabaseService.projects.updateProject(p.id, { is_tracked: shouldTrack } as any);
            }
          }
        }
      }
    } catch (e) {
      console.warn('[config] failed to update tracked flags', (e as any)?.message)
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
      project,
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

    const latestProject = await supabaseService.projects.getLatestProjectForUser(user.id);

    if (!latestProject) {
      return NextResponse.json({
        success: true,
        configuration: null,
        message: 'No configuration found'
      });
    }

    // Return configuration (without sensitive data)
    return NextResponse.json({
      success: true,
      configuration: {
        repositoryFullName: latestProject.repo_name || latestProject.name,
        emailRecipients: latestProject.email_distribution_list || [],
        provider: latestProject.provider,
        createdAt: latestProject.created_at,
        updatedAt: latestProject.updated_at,
        installationId: latestProject.installation_id ?? null,
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
