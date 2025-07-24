import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth/config';
import { getServiceRoleSupabaseService } from '@/lib/supabase/client';

interface ConfigRequest {
  repositoryFullName: string;
  emailRecipients?: string[]; // Made optional
}

interface ConfigResponse {
  success: boolean;
  message: string;
  project?: any;
  webhook?: {
    id: number;
    url: string;
  };
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
    const { repositoryFullName, emailRecipients = [] } = body; // Default to empty array

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

    // Generate webhook secret
    const crypto = await import('crypto');
    const webhookSecret = crypto.randomBytes(32).toString('hex');
    console.log('Generated webhook secret length:', webhookSecret.length);

    // Create or update project
    const projectData = {
      user_id: user.id,
      name: `${owner}/${repoName}`,
      repo_name: repositoryFullName,
      provider: 'github' as const,
      webhook_secret: webhookSecret,
      email_distribution_list: emailRecipients,
    };
    console.log('Project data prepared:', { ...projectData, webhook_secret: '[REDACTED]' });

    // Check if project already exists
    console.log('Checking for existing project for user:', user.id);
    const existingProjectResult = await supabaseService.projects.getProjectByUserId(user.id);
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

    // Now create the webhook automatically
    console.log('Starting webhook creation...');
    try {
      const webhookUrl = `${process.env.NEXTAUTH_URL}/api/webhooks/setup`;
      console.log('Webhook setup URL:', webhookUrl);
      console.log('Sending webhook request with repository:', repositoryFullName);
      
      const webhookResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': request.headers.get('Cookie') || '', // Forward session cookies
        },
        body: JSON.stringify({
          repositoryFullName,
        }),
      });

      console.log('Webhook response status:', webhookResponse.status);
      const webhookResult = await webhookResponse.json();
      console.log('Webhook result:', { success: webhookResult.success, error: webhookResult.error });

      if (!webhookResponse.ok || !webhookResult.success) {
        // Project was saved but webhook creation failed
        return NextResponse.json({
          success: true,
          message: 'Configuration saved successfully, but webhook creation failed. You may need to create the webhook manually.',
          project,
          error: webhookResult.error || 'Webhook creation failed',
        });
      }

      // Both project and webhook created successfully
      return NextResponse.json({
        success: true,
        message: 'Configuration saved and webhook created successfully!',
        project,
        webhook: {
          id: webhookResult.webhookId,
          url: webhookResult.webhookUrl,
        },
      });

    } catch (webhookError) {
      // Project was saved but webhook creation failed
      return NextResponse.json({
        success: true,
        message: 'Configuration saved successfully, but webhook creation failed. You may need to create the webhook manually.',
        project,
        error: webhookError instanceof Error ? webhookError.message : 'Webhook creation failed',
      });
    }

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

    // Get user's project
    const projectResult = await supabaseService.projects.getProjectByUserId(user.id);
    const project = projectResult.data;
    
    if (!project) {
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
        repositoryFullName: project.repo_name || project.name,
        emailRecipients: project.email_distribution_list || [],
        provider: project.provider,
        createdAt: project.created_at,
        updatedAt: project.updated_at,
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