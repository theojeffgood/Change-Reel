import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleSupabaseService } from '@/lib/supabase/client'
import { createBillingService } from '@/lib/supabase/services/billing'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id')?.trim()
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!userId || !uuidRegex.test(userId)) {
      return NextResponse.json({ error: 'Invalid or missing x-user-id' }, { status: 422 })
    }

    const supa = getServiceRoleSupabaseService().getClient()
    const billing = createBillingService(supa)

    const [balance, txns] = await Promise.all([
      billing.getBalance(userId),
      billing.getRecentTransactions(userId, 25),
    ])

    return NextResponse.json({ balance, transactions: txns }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to fetch balance' }, { status: 500 })
  }
}


