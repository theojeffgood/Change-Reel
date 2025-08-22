import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth/config'
import { getServiceRoleSupabaseService } from '@/lib/supabase/client'
import { createBillingService } from '@/lib/supabase/services/billing'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authConfig)
    const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase()
    if (!session?.user?.email || !adminEmail || session.user.email.toLowerCase() !== adminEmail) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const userId: string | undefined = body?.userId
    const amount: number | undefined = typeof body?.amount === 'number' ? body.amount : Number(body?.amount)
    const description: string = body?.description || 'Admin adjustment'

    if (!userId || !amount || Number.isNaN(amount)) {
      return NextResponse.json({ error: 'userId and numeric amount are required' }, { status: 400 })
    }

    const supa = getServiceRoleSupabaseService().getClient()
    const billing = createBillingService(supa)

    if (amount > 0) {
      await billing.addCredits(userId, amount, description)
    } else {
      const ok = await billing.deductCredits(userId, Math.abs(amount), description)
      if (!ok) return NextResponse.json({ error: 'Insufficient credits for deduction' }, { status: 409 })
    }

    const newBalance = await billing.getBalance(userId)
    return NextResponse.json({ success: true, balance: newBalance })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}


