import { NextResponse } from 'next/server'
import { createSupabaseClient, SupabaseService } from '@/lib/supabase/client'
import { JobQueueService } from '@/lib/supabase/services/jobs'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as { projectId?: string; recipients?: string[]; when?: string }
    const projectId = body.projectId
    const recipients = (body.recipients && body.recipients.length)
      ? body.recipients
      : (process.env.DAILY_DIGEST_RECIPIENTS || '').split(',').map(s => s.trim()).filter(Boolean)

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }
    if (!recipients.length) {
      return NextResponse.json({ error: 'No recipients provided (body.recipients or DAILY_DIGEST_RECIPIENTS)' }, { status: 400 })
    }

    // Use service role for server-side scheduling
    const supabaseService = new SupabaseService(undefined, true)
    const supabaseClient = supabaseService.getRawClient()
    const commitsRes = await supabaseService.commits.getCommitsForEmail(projectId, 100)
    if (commitsRes.error) {
      return NextResponse.json({ error: 'Failed to fetch commits', details: commitsRes.error.message }, { status: 500 })
    }
    const commitIds = (commitsRes.data || []).map(c => c.id)
    if (!commitIds.length) {
      return NextResponse.json({ message: 'No commits eligible for digest' }, { status: 200 })
    }

    // Schedule time: provided or next 09:00 local time
    const whenIso = body.when || nextLocalTimeIso(9)

    const jobs = new JobQueueService({
      from: supabaseClient.from.bind(supabaseClient),
      auth: supabaseClient.auth,
      storage: supabaseClient.storage,
      rpc: supabaseClient.rpc.bind(supabaseClient),
    } as any)

    const job = await jobs.createJob({
      type: 'send_email',
      priority: 10,
      data: {
        commit_ids: commitIds,
        recipients,
        template_type: 'digest',
      },
      project_id: projectId,
      scheduled_for: whenIso,
      max_attempts: 1,
    })
    if (job.error || !job.data) {
      return NextResponse.json({ error: 'Failed to schedule job', details: job.error?.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Daily digest scheduled', jobId: job.data.id, scheduled_for: whenIso }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to schedule daily digest', details: (error as Error).message }, { status: 500 })
  }
}

function nextLocalTimeIso(hour: number): string {
  const now = new Date()
  const next = new Date(now)
  next.setHours(hour, 0, 0, 0)
  if (next <= now) {
    next.setDate(next.getDate() + 1)
  }
  return next.toISOString()
}


