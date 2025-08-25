import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getStripeClient } from '@/lib/stripe/client'
import { getStripeEnvConfig } from '@/lib/stripe/config'
import { createBillingService } from '@/lib/supabase/services/billing'
import { getServiceRoleSupabaseService } from '@/lib/supabase/client'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  console.log('[stripe:webhook] request received')
  const sig = req.headers.get('stripe-signature')
  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })

  const rawBody = await req.text()

  const stripe = getStripeClient()
  const cfg = getStripeEnvConfig()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, cfg.webhookSecret)
    console.log('[stripe:webhook] event constructed', { id: event.id, type: event.type })
  } catch (err: any) {
    console.error('[stripe:webhook] signature error', { error: err?.message })
    return NextResponse.json({ error: `Invalid signature: ${err?.message || 'unknown'}` }, { status: 400 })
  }

  try {
    const supa = getServiceRoleSupabaseService().getClient()
    const billing = createBillingService(supa)

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.user_id
        if (!userId) {
          console.error('Webhook skipped: missing user_id metadata', { eventId: event.id })
          break
        }

        // Upsert billing_customers mapping if Stripe customer present
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
        if (customerId) {
          const { error: upsertCustErr } = await supa
            .from('billing_customers')
            .upsert({ user_id: userId, stripe_customer_id: customerId }, { onConflict: 'user_id' })
          if (upsertCustErr) {
            console.error('[billing] upsert billing_customers error', upsertCustErr)
          }
        }

        // Determine credits explicitly from PaymentIntent metadata (set during checkout session creation)
        let creditsToGrant = 0
        try {
          if (session.payment_intent) {
            const piId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent.id
            const pi = await stripe.paymentIntents.retrieve(piId)
            const metaCredits = Number((pi.metadata?.credits as string) || '0')
            if (!Number.isNaN(metaCredits) && metaCredits > 0) {
              creditsToGrant = metaCredits
            }
          }
          // Fallback: still try to inspect price/product metadata (in case legacy data exists)
          if (!creditsToGrant) {
            const items = await stripe.checkout.sessions.listLineItems(session.id, { expand: ['data.price.product'] })
            if (items.data.length > 0) {
              const item = items.data[0] as Stripe.LineItem & { price?: Stripe.Price & { product?: Stripe.Product } }
              const priceMeta = (item.price?.metadata || {}) as Record<string, string>
              const productMeta = (item.price?.product as Stripe.Product | undefined)?.metadata || {}
              const metaCredits = Number(priceMeta.credits || productMeta.credits)
              if (!Number.isNaN(metaCredits) && metaCredits > 0) {
                creditsToGrant = metaCredits
              }
            }
          }
        } catch (e: any) {
          console.error('[billing] determine credits error', e?.message)
        }

        if (creditsToGrant > 0) {
          await billing.addCredits(userId, creditsToGrant, `Stripe checkout`, event.id)
        } else {
          console.error('Webhook skipped: could not determine credits to grant', { eventId: event.id })
        }
        break
      }
      case 'payment_intent.succeeded': {
        // Optional confirm step. We already grant on checkout.session.completed; no-op by default.
        break
      }
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        const userId = (charge.metadata?.user_id as string) || undefined
        if (!userId) {
          console.error('Refund event missing user_id metadata', { eventId: event.id })
          break
        }
        // Proportionally compute credits to revoke based on PaymentIntent metadata
        const paymentIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : (charge.payment_intent as Stripe.PaymentIntent | null)?.id
        if (!paymentIntentId) break
        const pi = await stripe.paymentIntents.retrieve(paymentIntentId)
        const totalCredits = Number((pi.metadata?.credits as string) || '0')
        const totalUsd = ((pi.amount_received || pi.amount || 0) / 100)
        const refundedUsd = (charge.amount_refunded || 0) / 100
        let credits = 0
        if (totalCredits > 0 && totalUsd > 0 && refundedUsd > 0) {
          const proportion = Math.min(1, Math.max(0, refundedUsd / totalUsd))
          credits = Math.round(totalCredits * proportion)
        }
        if (credits > 0) {
          await billing.deductCredits(userId, credits, 'Stripe refund')
        }
        break
      }
      case 'charge.dispute.created': {
        const dispute = event.data.object as Stripe.Dispute
        const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge.id
        if (!chargeId) break
        const charge = await stripe.charges.retrieve(chargeId)
        const userId = (charge.metadata?.user_id as string) || undefined
        if (!userId) {
          console.error('Dispute event missing user_id metadata', { eventId: event.id })
          break
        }
        // Proportionally hold credits based on disputed amount vs original PaymentIntent
        const paymentIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : (charge.payment_intent as Stripe.PaymentIntent | null)?.id
        if (!paymentIntentId) break
        const pi = await stripe.paymentIntents.retrieve(paymentIntentId)
        const totalCredits = Number((pi.metadata?.credits as string) || '0')
        const totalUsd = ((pi.amount_received || pi.amount || 0) / 100)
        const disputedUsd = (dispute.amount || 0) / 100
        let credits = 0
        if (totalCredits > 0 && totalUsd > 0 && disputedUsd > 0) {
          const proportion = Math.min(1, Math.max(0, disputedUsd / totalUsd))
          credits = Math.round(totalCredits * proportion)
        }
        if (credits > 0) {
          await billing.deductCredits(userId, credits, 'Stripe dispute hold')
        }
        break
      }
      default:
        // Ignore unhandled events
        break
    }
  } catch (err: any) {
    console.error('[stripe:webhook] handler error', { error: err?.message, stack: err?.stack, eventId: (event as any)?.id })
    return NextResponse.json({ error: err?.message || 'Webhook handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}


