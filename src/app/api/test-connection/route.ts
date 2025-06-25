import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth/config';
import { getOAuthToken } from '@/lib/auth/token-storage';

interface TestConnectionRequest {
  repositoryName: string;
}

interface TestConnectionResponse {
  success: boolean;
  message: string;
  repository?: {
    name: string;
    fullName: string;
    description: string;
    isPrivate: boolean;
    defaultBranch: string;
    permissions: {
      admin: boolean;
      push: boolean;
      pull: boolean;
    };
    hasWebhooks: boolean;
  };
  webhookPermissions?: {
    canCreateWebhooks: boolean;
    webhookUrl?: string;
  };
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<TestConnectionResponse>> {
  try {
    // Get the authenticated session
    const session = await getServerSession(authConfig);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated', error: 'User not logged in' },
        { status: 401 }
      );
    }

    // Parse request body
    const body: TestConnectionRequest = await request.json();
    if (!body.repositoryName) {
      return NextResponse.json(
        { success: false, message: 'Repository name is required', error: 'Missing repository name' },
        { status: 400 }
      );
    }

    // Get OAuth token for the user
    const tokenResult = await getOAuthToken(session.user.id, 'github');
    if (!tokenResult.token || tokenResult.error) {
      return NextResponse.json(
        { success: false, message: 'GitHub not connected', error: tokenResult.error || 'No OAuth token found' },
        { status: 401 }
      );
    }

    // Test repository access
    const repoResponse = await fetch(
      `https://api.github.com/repos/${body.repositoryName}`,
      {
        headers: {
          'Authorization': `Bearer ${tokenResult.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Change-Reel/1.0'
        }
      }
    );

    if (!repoResponse.ok) {
      let errorMessage = 'Repository access failed';
      switch (repoResponse.status) {
        case 401:
          errorMessage = 'Invalid or expired GitHub token';
          break;
        case 403:
          errorMessage = 'Access forbidden - insufficient permissions';
          break;
        case 404:
          errorMessage = 'Repository not found or no access';
          break;
        case 429:
          errorMessage = 'GitHub API rate limit exceeded';
          break;
        default:
          errorMessage = `GitHub API error: ${repoResponse.status}`;
      }

      return NextResponse.json(
        { success: false, message: errorMessage, error: `HTTP ${repoResponse.status}` },
        { status: repoResponse.status }
      );
    }

    const repoData = await repoResponse.json();

    // Test webhook creation permissions
    const hooksResponse = await fetch(
      `https://api.github.com/repos/${body.repositoryName}/hooks`,
      {
        headers: {
          'Authorization': `Bearer ${tokenResult.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Change-Reel/1.0'
        }
      }
    );

    const canCreateWebhooks = hooksResponse.ok;
    const hasWebhooks = canCreateWebhooks;
    let webhookUrl: string | undefined;

    if (hasWebhooks) {
      const hooksData = await hooksResponse.json();
      // Look for existing Change Reel webhook
      const existingWebhook = hooksData.find((hook: any) => 
        hook.config?.url?.includes('change-reel') || 
        hook.config?.url?.includes('webhooks/github')
      );
      webhookUrl = existingWebhook?.config?.url;
    }

    // Build successful response
    const response: TestConnectionResponse = {
      success: true,
      message: 'Connection test successful',
      repository: {
        name: repoData.name,
        fullName: repoData.full_name,
        description: repoData.description || '',
        isPrivate: repoData.private,
        defaultBranch: repoData.default_branch,
        permissions: {
          admin: repoData.permissions?.admin || false,
          push: repoData.permissions?.push || false,
          pull: repoData.permissions?.pull || false
        },
        hasWebhooks
      },
      webhookPermissions: {
        canCreateWebhooks,
        webhookUrl
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Connection test error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Internal server error during connection test',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 