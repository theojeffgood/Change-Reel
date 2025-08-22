import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth/config'
import { getServiceRoleSupabaseService } from '@/lib/supabase/client'

export async function GET() {
  try {
    const session = await getServerSession(authConfig)
    if (!session?.user?.githubId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supa = getServiceRoleSupabaseService()
    const { data: user, error } = await supa.users.getUserByGithubId(String(session.user.githubId))
    if (error || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ id: user.id })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}


