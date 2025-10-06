export const runtime = 'nodejs'

/**
 * GitHub Webhook Event Processing API
 * 
 * This endpoint receives webhook events from GitHub and processes them
 * to extract commit information for storage in our database.
 * 
 * POST /api/webhooks/github - Process incoming GitHub webhook events
 */

import { NextRequest, NextResponse } from 'next/server';
import { WebhookProcessingService } from '@/lib/github/webhook-processing-service';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

interface WebhookResponse {
  success: boolean;
  message: string;
  processed?: number;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<WebhookResponse>> {
  try {
    // Extract and validate headers
    const githubEvent = request.headers.get('x-github-event');
    const githubSignature = request.headers.get('x-hub-signature-256');
    const githubDelivery = request.headers.get('x-github-delivery');
    const userAgent = request.headers.get('user-agent');

    // Check for missing required headers
    const missingHeaders = [];
    if (!githubEvent) missingHeaders.push('x-github-event');
    if (!githubSignature) missingHeaders.push('x-hub-signature-256');
    if (!githubDelivery) missingHeaders.push('x-github-delivery');

    if (missingHeaders.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Missing required headers',
          error: `missing required headers: ${missingHeaders.join(', ')}`
        },
        { status: 400 }
      );
    }

    // Read and validate payload
    const bodyText = await request.text();
    if (!bodyText) {
      return NextResponse.json(
        { success: false, message: 'Empty request body' },
        { status: 400 }
      );
    }

    let payload: any;
    try {
      payload = JSON.parse(bodyText);
    } catch (error) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Invalid JSON payload',
          error: 'invalid JSON payload format'
        },
        { status: 400 }
      );
    }

    // Build compact metadata for logs
    const meta = {
      event: githubEvent,
      deliveryId: githubDelivery,
      repository: payload?.repository?.full_name,
      ref: payload?.ref,
      commits: Array.isArray(payload?.commits) ? payload.commits.length : 0,
      head: payload?.head_commit?.id,
      pusher: payload?.pusher?.name || payload?.sender?.login,
    }

    // If the job system is disabled, don't enqueue jobs; just log metadata
    const jobSystemEnabled = process.env.JOB_SYSTEM_ENABLED === 'true'
    if (!jobSystemEnabled) {
      console.log('[webhook] received (job system disabled)', meta)
      return NextResponse.json(
        {
          success: true,
          message: 'Webhook received. Job creation disabled (JOB_SYSTEM_ENABLED!=true).',
        },
        { status: 200 }
      )
    }

    // Log receipt when enabled (without dumping payload)
    console.log('[webhook] received', meta)

    // Create Supabase client and job service for job creation
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    // Import and use job service directly
    const { JobQueueService } = await import('@/lib/supabase/services/jobs');
    const jobService = new JobQueueService(supabase);
    
    // Create a webhook_processing job instead of processing directly
    // All webhooks (including installation.created) are queued for async processing
    // Realtime subscriptions ensure the UI updates when commits are created
    const jobResult = await jobService.createJob({
      type: 'webhook_processing',
      priority: 90, // High priority for webhook events
      data: {
        webhook_event: githubEvent,
        signature: githubSignature,
        delivery_id: githubDelivery,
        user_agent: userAgent,
        payload: payload,
        raw_body: bodyText
      },
      context: {
        triggered_by: 'github_webhook',
        received_at: new Date().toISOString(),
      },
    });

    if (jobResult.error) {
      return NextResponse.json(
        {
          success: false,
          message: 'Failed to queue webhook for processing',
          error: jobResult.error.message
        },
        { status: 500 }
      );
    }

    // Return success - the job will be processed by the job runner
    return NextResponse.json(
      {
        success: true,
        message: 'Webhook received and queued for processing',
        jobId: jobResult.data?.id
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Webhook processing error:', error);
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
