/**
 * GitHub Webhook Management API Routes
 * 
 * Handles creating, listing, and managing webhooks for GitHub repositories
 * using OAuth authentication.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authConfig } from '@/lib/auth/config';
import { GitHubWebhookService } from '@/lib/github/webhook-service';

/**
 * GET /api/webhooks/github
 * List webhooks for a repository
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authConfig);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');

    if (!owner || !repo) {
      return NextResponse.json(
        { error: 'Missing required parameters: owner and repo' },
        { status: 400 }
      );
    }

    const result = await GitHubWebhookService.listWebhooks(
      session.user.id,
      owner,
      repo
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.statusCode || 500 }
      );
    }

    return NextResponse.json({
      success: true,
      webhooks: result.data
    });

  } catch (error) {
    console.error('Error in GET /api/webhooks/github:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/webhooks/github
 * Create a webhook for a repository
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authConfig);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { owner, repo, webhookUrl, events, secret } = body;

    if (!owner || !repo || !webhookUrl) {
      return NextResponse.json(
        { error: 'Missing required parameters: owner, repo, and webhookUrl' },
        { status: 400 }
      );
    }

    // Validate webhook URL format
    try {
      new URL(webhookUrl);
    } catch {
      return NextResponse.json(
        { error: 'Invalid webhook URL format' },
        { status: 400 }
      );
    }

    const result = await GitHubWebhookService.createWebhook(
      session.user.id,
      {
        owner,
        repo,
        webhookUrl,
        events,
        secret
      }
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, details: result.data },
        { status: result.statusCode || 500 }
      );
    }

    return NextResponse.json({
      success: true,
      webhook: result.data
    }, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/webhooks/github:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/webhooks/github
 * Delete a webhook
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authConfig);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');
    const webhookId = searchParams.get('webhookId');

    if (!owner || !repo || !webhookId) {
      return NextResponse.json(
        { error: 'Missing required parameters: owner, repo, and webhookId' },
        { status: 400 }
      );
    }

    const webhookIdNum = parseInt(webhookId, 10);
    if (isNaN(webhookIdNum)) {
      return NextResponse.json(
        { error: 'Invalid webhook ID' },
        { status: 400 }
      );
    }

    const result = await GitHubWebhookService.deleteWebhook(
      session.user.id,
      owner,
      repo,
      webhookIdNum
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.statusCode || 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook deleted successfully'
    });

  } catch (error) {
    console.error('Error in DELETE /api/webhooks/github:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/webhooks/github
 * Update a webhook
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authConfig);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { owner, repo, webhookId, updates } = body;

    if (!owner || !repo || !webhookId || !updates) {
      return NextResponse.json(
        { error: 'Missing required parameters: owner, repo, webhookId, and updates' },
        { status: 400 }
      );
    }

    const webhookIdNum = parseInt(webhookId, 10);
    if (isNaN(webhookIdNum)) {
      return NextResponse.json(
        { error: 'Invalid webhook ID' },
        { status: 400 }
      );
    }

    // Validate webhook URL if provided
    if (updates.webhookUrl) {
      try {
        new URL(updates.webhookUrl);
      } catch {
        return NextResponse.json(
          { error: 'Invalid webhook URL format' },
          { status: 400 }
        );
      }
    }

    const result = await GitHubWebhookService.updateWebhook(
      session.user.id,
      owner,
      repo,
      webhookIdNum,
      updates
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.statusCode || 500 }
      );
    }

    return NextResponse.json({
      success: true,
      webhook: result.data
    });

  } catch (error) {
    console.error('Error in PATCH /api/webhooks/github:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 