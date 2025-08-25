import { NextRequest, NextResponse } from 'next/server';
import { getStripeClient, getCreditPackPriceId } from '@/lib/stripe/client';
import { getStripeEnvConfig } from '@/lib/stripe/config';
import { getServiceRoleSupabaseService } from '@/lib/supabase/client';

export const runtime = 'nodejs';

type CreateSessionBody = {
  credit_pack: 'credits100' | 'credits1000';
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CreateSessionBody;
    if (!body || !body.credit_pack) {
      return NextResponse.json({ error: 'Missing credit_pack' }, { status: 400 });
    }

    const priceId = getCreditPackPriceId(body.credit_pack);
    if (!priceId) {
      return NextResponse.json({ error: 'Unsupported or unconfigured credit pack' }, { status: 400 });
    }

    // Require a real UUID and verify it exists in users table
    const userId = req.headers.get('x-user-id')?.trim();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!userId || !uuidRegex.test(userId)) {
      return NextResponse.json({ error: 'Invalid or missing x-user-id (must be a UUID)' }, { status: 422 });
    }

    // Verify user exists (prevents webhook FK/format failures later)
    const supa = getServiceRoleSupabaseService().getClient();
    const { data: userRow, error: userErr } = await supa
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
    if (userErr) {
      return NextResponse.json({ error: 'User lookup failed' }, { status: 500 });
    }
    if (!userRow) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const stripe = getStripeClient();
    const cfg = getStripeEnvConfig();

    // Build absolute return URL for Embedded Checkout (Stripe requires absolute URLs)
    const origin = req.nextUrl?.origin || req.headers.get('origin') || '';
    const successPath = cfg.successUrl.startsWith('http') ? cfg.successUrl : `${origin}${cfg.successUrl}`;
    // Include session_id placeholder per Stripe docs for Embedded Checkout
    const returnUrl = `${successPath}${successPath.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      ui_mode: 'embedded',
      line_items: [{ price: priceId, quantity: 1 }],
      return_url: returnUrl,
      payment_method_types: ['card'],
      metadata: { user_id: userId, credit_pack: body.credit_pack },
      payment_intent_data: {
        metadata: {
          user_id: userId,
          credit_pack: body.credit_pack,
          // Explicit credits purchased for webhook logic (removes need for creditsPerUsd)
          credits: body.credit_pack === 'credits1000' ? '1500' : '100',
        },
      },
    });

    // For Embedded Checkout we return client_secret used by the client SDK
    return NextResponse.json({ client_secret: session.client_secret }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


