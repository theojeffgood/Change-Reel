export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth/config';
import { createInstallationAccessToken } from '@/lib/github/app-auth';

interface TestConnectionRequest {
  repositoryName: string;
  installationId: number;
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
    if (!body.repositoryName || !body.installationId) {
      return NextResponse.json(
        { success: false, message: 'Repository name and installationId are required', error: 'Missing repository name or installationId' },
        { status: 400 }
      );
    }

    // Get installation access token for the GitHub App
    const { token } = await createInstallationAccessToken(body.installationId);

    // Test repository access
    const repoResponse = await fetch(
      `https://api.github.com/repos/${body.repositoryName}`,
      {
        headers: {
          'Authorization': `token ${token}`,
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
    // Under GitHub App model, webhooks are app-level; skip repo hook checks
    const hasWebhooks = true;
    const canCreateWebhooks = true;
    let webhookUrl: string | undefined = process.env.NEXTAUTH_URL
      ? `${process.env.NEXTAUTH_URL.replace(/\/$/, '')}/api/webhooks/github`
      : undefined;

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
      webhookPermissions: { canCreateWebhooks, webhookUrl }
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