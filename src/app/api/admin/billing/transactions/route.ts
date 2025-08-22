import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth/config'
import { getServiceRoleSupabaseService } from '@/lib/supabase/client'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authConfig)
    const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase()
    if (!session?.user?.email || !adminEmail || session.user.email.toLowerCase() !== adminEmail) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const userId = req.nextUrl.searchParams.get('userId')
    const limit = Number(req.nextUrl.searchParams.get('limit') || '50')
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 })

    const supa = getServiceRoleSupabaseService().getClient()
    const { data, error } = await supa
      .from('credits_ledger')
      .select('id, amount, type, description, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ userId, transactions: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}


