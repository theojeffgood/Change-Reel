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
  try {
    const body = (await req.json()) as CreateSessionBody;
    if (!body || !body.credit_pack) {
      return NextResponse.json({ error: 'Missing credit_pack' }, { status: 400 });
    }

    const priceId = getCreditPackPriceId(body.credit_pack);
    if (!priceId) {
      return NextResponse.json({ error: 'Unsupported or unconfigured credit pack' }, { status: 400 });
    }

    // Resolve the authenticated user via server session and Supabase
    const session = await getServerSession(authConfig);
    if (!session?.user?.githubId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const supaService = getServiceRoleSupabaseService();
    const { data: userRow, error: userErr } = await supaService.users.getUserByGithubId(String(session.user.githubId));
    if (userErr) {
      return NextResponse.json({ error: 'User lookup failed' }, { status: 500 });
    }
    if (!userRow) {
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

    // For Embedded Checkout we return client_secret used by the client SDK
    return NextResponse.json({ client_secret: checkoutSession.client_secret }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


