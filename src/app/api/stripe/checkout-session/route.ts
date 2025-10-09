import { NextRequest, NextResponse } from 'next/server';
import { getStripeClient, getCreditPackPriceId } from '@/lib/stripe/client';
import { getStripeEnvConfig } from '@/lib/stripe/config';
import { getServiceRoleSupabaseService } from '@/lib/supabase/client';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth/config';

export const runtime = 'nodejs';

type CreateSessionBody = {
  credit_pack: 'credits100' | 'credits1000';
};

export async function POST(req: NextRequest) {
  console.log('[stripe] Checkout session request received');
  try {
    const body = (await req.json()) as CreateSessionBody;
    console.log('[stripe] Request body:', body);
    if (!body || !body.credit_pack) {
      console.log('[stripe] Missing credit_pack in request');
      return NextResponse.json({ error: 'Missing credit_pack' }, { status: 400 });
    }

    const priceId = getCreditPackPriceId(body.credit_pack);
    console.log('[stripe] Price ID for', body.credit_pack, ':', priceId);
    if (!priceId) {
      console.log('[stripe] No price ID configured for credit pack:', body.credit_pack);
      return NextResponse.json({ error: 'Unsupported or unconfigured credit pack' }, { status: 400 });
    }

    // Resolve the authenticated user via server session and Supabase
    const session = await getServerSession(authConfig);
    console.log('[stripe] Session check:', { hasSession: !!session, githubId: session?.user?.githubId });
    if (!session?.user?.githubId) {
      console.log('[stripe] No authenticated session found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const supaService = getServiceRoleSupabaseService();
    const { data: userRow, error: userErr } = await supaService.users.getUserByGithubId(String(session.user.githubId));
    console.log('[stripe] User lookup result:', { found: !!userRow, error: userErr?.message });
    if (userErr) {
      console.log('[stripe] User lookup error:', userErr);
      return NextResponse.json({ error: 'User lookup failed' }, { status: 500 });
    }
    if (!userRow) {
      console.log('[stripe] User not found in database');
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const stripe = getStripeClient();
    const cfg = getStripeEnvConfig();

    // Build absolute return URL for Embedded Checkout (Stripe requires absolute URLs)
    // Prefer forwarded headers (behind proxy) and avoid 0.0.0.0/localhost in production
    const forwardedProto = req.headers.get('x-forwarded-proto');
    const forwardedHost = req.headers.get('x-forwarded-host') || req.headers.get('host');
    let origin = (forwardedProto && forwardedHost) ? `${forwardedProto}://${forwardedHost}` : (req.nextUrl?.origin || req.headers.get('origin') || '');
    if (!origin || origin.includes('0.0.0.0') || origin.includes('localhost')) {
      origin = process.env.NEXTAUTH_URL || origin;
    }
    const successPath = cfg.successUrl.startsWith('http') ? cfg.successUrl : `${origin}${cfg.successUrl}`;
    // Include session_id placeholder per Stripe docs for Embedded Checkout
    const returnUrl = `${successPath}${successPath.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`;

    console.log('[stripe] Creating checkout session with:', {
      priceId,
      userId: userRow.id,
      creditPack: body.credit_pack,
      returnUrl
    });

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      ui_mode: 'embedded',
      line_items: [{ price: priceId, quantity: 1 }],
      return_url: returnUrl,
      payment_method_types: ['card'],
      metadata: { user_id: userRow.id, credit_pack: body.credit_pack },
      payment_intent_data: {
        metadata: {
          user_id: userRow.id,
          credit_pack: body.credit_pack,
          // Explicit credits purchased for webhook logic (removes need for creditsPerUsd)
          credits: body.credit_pack === 'credits1000' ? '1500' : '100',
        },
      },
    });

    console.log('[stripe] Checkout session created successfully:', {
      sessionId: checkoutSession.id,
      hasClientSecret: !!checkoutSession.client_secret
    });

    // For Embedded Checkout we return client_secret used by the client SDK
    return NextResponse.json({ client_secret: checkoutSession.client_secret }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


