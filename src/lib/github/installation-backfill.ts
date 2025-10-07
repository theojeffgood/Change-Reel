import { IJobQueueService } from '@/lib/types/jobs'
import { ICommitService } from '@/lib/supabase/services/commits'
import { IProjectService } from '@/lib/supabase/services/projects'
import { IUserService } from '@/lib/supabase/services/users'
import { createCommitWorkflow } from '@/lib/jobs/setup'

type Repo = { full_name: string; default_branch: string }

export interface InstallationBackfillDeps {
  jobs: IJobQueueService
  commits: ICommitService
  projects: IProjectService
  users: IUserService
}

export interface InstallationBackfillResult {
  commits_processed: number
  jobs_created: number
  commit_ids: string[]
  job_ids: string[]
}

export async function runInstallationBackfill(
  deps: InstallationBackfillDeps,
  installationId: number,
  senderGithubId?: number
): Promise<InstallationBackfillResult> {
  const { listInstallationRepositories, createInstallationAccessToken } = await import('@/lib/github/app-auth')

  // Resolve user (best-effort) to link projects
  let userId: string | undefined
  if (senderGithubId) {
    try {
      const userRes = await deps.users.getUserByGithubId(String(senderGithubId))
      if (userRes?.data?.id) userId = userRes.data.id
    } catch {}
  }

  // List repositories for this installation
  const repositories: Repo[] = await listInstallationRepositories(installationId)

  // Ensure projects exist for repos (best-effort)
  for (const repo of repositories) {
    try {
      const existing = await deps.projects.getProjectByRepository(repo.full_name)
      if (!existing?.data && userId) {
        await deps.projects.createProject({
          user_id: userId,
          name: repo.full_name,
          repo_name: repo.full_name,
          provider: 'github',
          installation_id: installationId,
          email_distribution_list: [],
        } as any)
      }
    } catch {}
  }

  // Gather recent commits across installed repos (author-agnostic)
  const { token } = await createInstallationAccessToken(installationId)
  const headers = {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'change-reel/1.0.0',
  } as Record<string, string>

  type RepoCommit = {
    sha: string
    message: string
    date: string
    repo_full_name: string
    author_name?: string
    author_email?: string
  }

  const collected: RepoCommit[] = []
  for (const repo of repositories) {
    const [owner, name] = repo.full_name.split('/')
    const url = `https://api.github.com/repos/${owner}/${name}/commits?per_page=3`
    try {
      const res = await fetch(url, { headers })
      if (!res.ok) continue
      const commits = await res.json()
      if (Array.isArray(commits)) {
        for (const c of commits) {
          const sha = c?.sha
          const msg = c?.commit?.message || ''
          const dt = c?.commit?.author?.date || c?.commit?.committer?.date
          if (!sha || !dt) continue
          collected.push({
            sha,
            message: msg,
            date: dt,
            repo_full_name: repo.full_name,
            author_name: c?.commit?.author?.name || c?.commit?.committer?.name,
            author_email: c?.commit?.author?.email || c?.commit?.committer?.email,
          })
        }
      }
    } catch {}
  }

  if (collected.length === 0) {
    return { commits_processed: 0, jobs_created: 0, commit_ids: [], job_ids: [] }
  }

  const dedup = new Map<string, RepoCommit>()
  for (const c of collected) {
    if (!dedup.has(c.sha)) dedup.set(c.sha, c)
  }
  const top3 = Array.from(dedup.values())
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3)

  const createdCommits: string[] = []
  const createdJobs: string[] = []

  for (const c of top3) {
    try {
      const projRes = await deps.projects.getProjectByRepository(c.repo_full_name)
      const project = projRes?.data as any
      if (!project) continue

      // Create commit (idempotent)
      const created = await deps.commits.createCommit({
        project_id: project.id,
        sha: c.sha,
        author: c.author_name && c.author_email ? `${c.author_name} <${c.author_email}>` : (c.author_name || c.author_email || 'Unknown'),
        timestamp: c.date,
        installation_id: installationId,
        is_published: false,
        email_sent: false,
      })
      if (created.error) {
        if (created.error.message?.includes('already exists')) continue
        continue
      }
      const commit = created.data as any
      if (!commit?.id) continue
      createdCommits.push(commit.id)

      const [owner, repoName] = c.repo_full_name.split('/')
      const wf = await createCommitWorkflow(
        deps.jobs,
        commit.id,
        project.id,
        owner,
        repoName,
        c.sha,
        { commit_message: c.message, author: c.author_name || 'Unknown' }
      )
      if (wf?.jobs?.length) {
        for (const j of wf.jobs) { if ((j as any)?.id) createdJobs.push((j as any).id) }
      }
    } catch {}
  }

  return {
    commits_processed: createdCommits.length,
    jobs_created: createdJobs.length,
    commit_ids: createdCommits,
    job_ids: createdJobs,
  }
}

// Backwards-compatible alias
export const handle = runInstallationBackfill

