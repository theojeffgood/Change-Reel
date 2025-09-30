export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { getToken } from 'next-auth/jwt'
import { authConfig } from '@/lib/auth/config'
import { getServiceRoleSupabaseService } from '@/lib/supabase/client'
import { listInstallationRepositories } from '@/lib/github/app-auth'

interface SyncBody {
  installation_id: number
  account_login?: string
  account_id?: number
  account_type?: string // 'User' | 'Organization'
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authConfig)
  if (!session?.user?.githubId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: SyncBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const installationId = Number(body.installation_id)
  if (!installationId || Number.isNaN(installationId)) {
    return NextResponse.json({ error: 'installation_id is required' }, { status: 400 })
  }

  try {
    const supa = getServiceRoleSupabaseService()

    // Ensure Change Reel user exists for the session
    const userResult = await supa.users.getUserByGithubId(String(session.user.githubId))
    let user = userResult.data
    if (!user) {
      const create = await supa.users.createUser({
        github_id: String(session.user.githubId),
        email: session.user.email || '',
        name: session.user.name || '',
      })
      if (create.error || !create.data) {
        return NextResponse.json({ error: create.error?.message || 'Failed to create user' }, { status: 500 })
      }
      user = create.data
    }

    // Link installation -> user
    const upsert = await supa.getClient()
      .from('installations')
      .upsert({
        installation_id: installationId,
        provider: 'github',
        user_id: user.id,
        account_login: body.account_login,
        account_id: body.account_id,
        account_type: body.account_type,
      }, { onConflict: 'installation_id' })
      .select()
      .limit(1)

    if (upsert.error) {
      return NextResponse.json({ error: upsert.error.message }, { status: 500 })
    }

    // Fetch repos under installation
    const repos = await listInstallationRepositories(installationId)

    // Upsert projects for each repo under this installation
    const projectRows = repos.map(r => ({
      user_id: user!.id,
      name: r.full_name,
      repo_name: r.full_name,
      provider: 'github' as const,
      installation_id: installationId,
      email_distribution_list: [] as string[],
    }))

    // Upsert by repo_name; relies on repo_name uniqueness policy in practice
    const { error: projectErr } = await supa.getClient()
      .from('projects')
      .upsert(projectRows, { onConflict: 'repo_name' })

    if (projectErr) {
      return NextResponse.json({ error: projectErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, count: repos.length })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to sync installation' }, { status: 500 })
  }
}
