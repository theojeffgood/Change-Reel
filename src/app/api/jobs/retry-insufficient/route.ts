import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth/config'
import { getServiceRoleSupabaseService } from '@/lib/supabase/client'

export async function POST() {
  try {
    const session = await getServerSession(authConfig)
    if (!session?.user?.githubId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supaService = getServiceRoleSupabaseService()
    const { data: user, error: userErr } = await supaService.users.getUserByGithubId(String(session.user.githubId))
    if (userErr || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get tracked projects for this user
    const { data: projects, error: projectsErr } = await supaService.projects.getProjectsByUser(user.id)
    if (projectsErr) {
      return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
    }
    const tracked = (projects || []).filter((p: any) => p.is_tracked !== false)
    if (!tracked.length) {
      return NextResponse.json({ retried: 0, message: 'No tracked projects' })
    }
    const projectIds = tracked.map((p: any) => p.id)

    // Find failed generate_summary jobs due to insufficient credits
    const { data: failedJobs, error: jobsErr } = await supaService
      .getClient()
      .from('jobs')
      .select('id, project_id, commit_id, status, error_message')
      .in('project_id', projectIds)
      .eq('type', 'generate_summary')
      .eq('status', 'failed')
      .eq('error_message', 'Insufficient credits')
      .order('created_at', { ascending: false })

    if (jobsErr) {
      return NextResponse.json({ error: 'Failed to query failed jobs' }, { status: 500 })
    }

    const jobs = failedJobs || []
    if (jobs.length === 0) {
      return NextResponse.json({ retried: 0, message: 'No failed jobs due to insufficient credits' })
    }

    // Reset to pending so the processor can pick them up
    let retried = 0
    for (const job of jobs) {
      try {
        const { error: updErr } = await supaService
          .getClient()
          .from('jobs')
          .update({ status: 'pending', started_at: null, retry_after: null })
          .eq('id', job.id)
        if (!updErr) retried++
      } catch {}
    }

    return NextResponse.json({ retried })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}


