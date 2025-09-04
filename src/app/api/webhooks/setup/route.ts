export const runtime = 'nodejs'

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

export async function POST(): Promise<NextResponse<WebhookSetupResponse>> {
  // Deprecated in GitHub App model; repository webhooks are created at install time and
  // delivered to the app-level webhook URL.
  return NextResponse.json({
    success: false,
    message: 'Not applicable under GitHub App model. Webhooks are delivered at the App level.',
    error: 'deprecated'
  }, { status: 410 });
}