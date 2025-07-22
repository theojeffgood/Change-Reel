import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth/config';
import { GitHubWebhookService } from '@/lib/github/webhook-service';
import { getServiceRoleSupabaseService } from '@/lib/supabase/client';

interface WebhookSetupRequest {
  repositoryFullName: string;
}

interface WebhookSetupResponse {
  success: boolean;
  message: string;
  webhookId?: number;
  webhookUrl?: string;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<WebhookSetupResponse>> {
  try {
    // Check authentication
    const session = await getServerSession(authConfig);
    if (!session?.user?.githubId) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized', error: 'No authenticated session' },
        { status: 401 }
      );
    }

    // Parse request body
    const body: WebhookSetupRequest = await request.json();
    if (!body.repositoryFullName) {
      return NextResponse.json(
        { success: false, message: 'Repository name is required', error: 'missing repositoryFullName' },
        { status: 400 }
      );
    }

    // Parse repository owner and name
    const [owner, repo] = body.repositoryFullName.split('/');
    if (!owner || !repo) {
      return NextResponse.json(
        { success: false, message: 'Invalid repository format. Expected: owner/repo', error: 'invalid repository format' },
        { status: 400 }
      );
    }

    // Get the webhook secret from the database
    const supabaseService = getServiceRoleSupabaseService();
    const { data: user } = await supabaseService.users.getUserByGithubId(String(session.user.githubId));
    
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found', error: 'user not found in database' },
        { status: 404 }
      );
    }

    const { data: project } = await supabaseService.projects.getProjectByUserId(user.id);
    
    if (!project || !project.webhook_secret) {
      return NextResponse.json(
        { success: false, message: 'Project configuration not found. Please save your configuration first.', error: 'project or webhook secret not found' },
        { status: 404 }
      );
    }

    // Generate webhook URL (use ngrok URL so GitHub can reach the webhook endpoint)
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const webhookUrl = GitHubWebhookService.generateWebhookUrl(baseUrl);

    // Check permissions first
    const permissionsResult = await GitHubWebhookService.checkWebhookPermissions(
      String(session.user.githubId),
      owner,
      repo
    );

    if (!permissionsResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Failed to check permissions', 
          error: permissionsResult.error 
        },
        { status: permissionsResult.statusCode || 500 }
      );
    }

    if (!permissionsResult.data?.canCreateWebhooks) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Insufficient permissions to create webhooks. Admin or push access required.',
          error: 'insufficient permissions'
        },
        { status: 403 }
      );
    }

    // Setup webhook with the secret from the database
    const webhookResult = await GitHubWebhookService.setupRepositoryWebhook(
      String(session.user.githubId),
      owner,
      repo,
      webhookUrl,
      undefined, // events (use defaults)
      project.webhook_secret // Pass the database secret
    );

    if (!webhookResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Failed to create webhook', 
          error: webhookResult.error 
        },
        { status: webhookResult.statusCode || 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook created successfully',
      webhookId: webhookResult.data?.id,
      webhookUrl: webhookResult.data?.config?.url
    });

  } catch (error) {
    console.error('Webhook setup error:', error);
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