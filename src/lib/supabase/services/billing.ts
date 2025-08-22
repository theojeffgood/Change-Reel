import type { ISupabaseClient } from '../../types/supabase'

/**
 * BillingService
 * - Single source of truth for credits: balance reads, writes, checks, and charges
 * - Encapsulates pricing/markup → credits conversion for usage-based charging
 * - Called from API routes and job handlers (e.g., summary generation)
 */

export interface IBillingService {
  /** Get the user's current credit balance */
  getBalance(userId: string): Promise<number>
  /** Grant credits (Stripe success/webhook) and record ledger entry */
  addCredits(userId: string, amount: number, description: string, stripeEventId?: string): Promise<void>
  /** Atomically deduct credits (returns false if insufficient) and record ledger entry */
  deductCredits(userId: string, amount: number, description: string): Promise<boolean>
  /** Fetch the user's recent credit ledger transactions */
  getRecentTransactions(userId: string, limit?: number): Promise<Array<{ id: string; amount: number; type: 'credit' | 'debit'; description: string | null; created_at: string }>>
  /** Convenience check: does the user have at least `minimum` credits? */
  hasCredits(userId: string, minimum?: number): Promise<boolean>
  /** Estimate required credits for a summary (no deduction) */
  estimateSummaryCredits(diffContent: string): Promise<number>
}

export class BillingService implements IBillingService {
  constructor(private readonly client: ISupabaseClient) {}

  /**
   * Read the current balance from `credit_balances`.
   * Used by: admin page gating, queue-summary API pre-checks.
   */
  async getBalance(userId: string): Promise<number> {
    const { data, error } = await this.client
      .from('credit_balances')
      .select('balance')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throw error
    return data?.balance ?? 0
  }

  /**
   * Grant credits via RPC `grant_credits` (idempotent by stripe_event_id) and write ledger.
   * Used by: Stripe webhook on successful checkout.
   */
  async addCredits(userId: string, amount: number, description: string, stripeEventId?: string): Promise<void> {
    console.log('[billing] addCredits start', { userId, amount, stripeEventId })
    const { data, error } = await this.client
      .rpc('grant_credits', {
        p_user_id: userId,
        p_amount: amount,
        p_description: description,
        p_stripe_event_id: stripeEventId ?? null,
      })
    if (error) {
      console.error('[billing] grant_credits error', error)
      throw error
    }
    console.log('[billing] addCredits done', { userId, newBalance: data })
  }

  /**
   * Deduct credits via RPC `deduct_credits` (atomic, OCC-safe). Returns false if insufficient.
   * Used by: summary generation pre-charge, refunds/holds adjustments.
   */
  async deductCredits(userId: string, amount: number, description: string): Promise<boolean> {
    const { data, error } = await this.client
      .rpc('deduct_credits', {
        p_user_id: userId,
        p_amount: amount,
        p_description: description,
      })
    if (error) {
      console.error('[billing] deduct_credits error', error)
      throw error
    }
    console.log('[billing] deductCredits done', { userId, result: data })
    return Boolean(data)
  }

  /**
   * List recent ledger entries for the user.
   * Useful for UI history panes and audits.
   */
  async getRecentTransactions(userId: string, limit = 20) {
    const { data, error } = await this.client
      .from('credits_ledger')
      .select('id, amount, type, description, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return data as Array<{ id: string; amount: number; type: 'credit' | 'debit'; description: string | null; created_at: string }>
  }

  /**
   * Check if user has at least `minimum` credits.
   */
  async hasCredits(userId: string, minimum: number = 1): Promise<boolean> {
    const balance = await this.getBalance(userId)
    return Number(balance) >= Number(minimum)
  }

  /**
   * Legacy converter (USD→credits) removed for simplified pricing model.
   */
  // (intentionally omitted)

  // ensureCredits removed; call deductCredits directly where needed

  // chargeEstimatedUsage removed under simplified pricing

  // chargeSummaryEstimation removed; summaries cost a flat 1 credit

  async estimateSummaryCredits(_diffContent: string): Promise<number> {
    // New pricing model: 1 credit = 1 commit summary
    return 1
  }
}

export function createBillingService(client: ISupabaseClient): IBillingService {
  return new BillingService(client)
}


