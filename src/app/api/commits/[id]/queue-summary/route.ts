import { NextResponse } from 'next/server'
import { getServiceRoleSupabaseService } from '@/lib/supabase/client'
import { createBillingService } from '@/lib/supabase/services/billing'

export const runtime = 'nodejs'

export async function POST(req: Request, context: any) {
  const params = context?.params || {}
  try {
    const commitId = params.id
    if (!commitId) {
      return NextResponse.json({ error: 'Missing commit id' }, { status: 400 })
    }

    const supabaseService = getServiceRoleSupabaseService()

    // Load the commit to get project_id and metadata
    const { data: commit, error: commitErr } = await supabaseService.commits.getCommit(commitId)
    if (commitErr || !commit) {
      return NextResponse.json({ error: 'Commit not found' }, { status: 404 })
    }

    // Determine project owner user and current credit balance
    const { data: project, error: projErr } = await supabaseService.projects.getProject(commit.project_id)
    if (projErr || !project || !project.user_id) {
      return NextResponse.json({ error: 'Project not found for commit' }, { status: 404 })
    }

    const billing = createBillingService(supabaseService.getClient())
    const hasCredits = await billing.hasCredits(project.user_id)

    if (!hasCredits) {
      // Redirect to billing when insufficient credits
      const url = new URL('/billing', req.url)
      return NextResponse.redirect(url)
    }

    // Create fetch_diff job
    const { data: fetchJob, error: fetchErr } = await supabaseService.jobs.createJob({
      type: 'fetch_diff',
      priority: 70,
      data: {
        commit_sha: commit.sha,
        repository_owner: (project.repo_name || project.name || 'unknown').split('/')[0] || 'unknown',
        repository_name: (project.repo_name || project.name || 'unknown').split('/')[1] || 'unknown',
        branch: 'main',
      },
      commit_id: commit.id,
      project_id: project.id,
    })

    if (fetchErr || !fetchJob) {
      return NextResponse.json({ error: fetchErr?.message || 'Failed to create fetch_diff job' }, { status: 500 })
    }

    // Create generate_summary job without placeholder diff (will read from dependency context)
    const { data: summaryJob, error: summaryErr } = await supabaseService.jobs.createJob({
      type: 'generate_summary',
      priority: 60,
      data: {
        commit_id: commit.id,
        commit_message: '',
        author: commit.author,
        branch: 'main',
        diff_content: '',
      },
      commit_id: commit.id,
      project_id: commit.project_id,
    })

    if (summaryErr || !summaryJob) {
      return NextResponse.json({ error: summaryErr?.message || 'Failed to create generate_summary job' }, { status: 500 })
    }

    // Link dependency: generate_summary depends on fetch_diff
    const depRes = await supabaseService.jobs.addJobDependency(summaryJob.id, fetchJob.id)
    if (depRes.error) {
      return NextResponse.json({ error: depRes.error.message || 'Failed to link job dependency' }, { status: 500 })
    }

    return NextResponse.json({ success: true, fetchJobId: fetchJob.id, summaryJobId: summaryJob.id })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}


