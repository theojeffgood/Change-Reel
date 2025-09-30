import { NextResponse } from 'next/server';

export async function GET() {
  // Only show config in non-production or when explicitly enabled
  const allowDebug = process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEBUG === 'true';
  
  if (!allowDebug) {
    return NextResponse.json({ error: 'Debug endpoint disabled in production' }, { status: 403 });
  }

  const config = {
    nextAuthUrl: process.env.NEXTAUTH_URL || '(not set)',
    oauthClientId: process.env.OAUTH_CLIENT_ID || '(not set)',
    oauthClientSecretSet: !!process.env.OAUTH_CLIENT_SECRET,
    nextAuthSecretSet: !!process.env.NEXTAUTH_SECRET,
    nodeEnv: process.env.NODE_ENV,
    expectedCallbackUrl: process.env.NEXTAUTH_URL 
      ? `${process.env.NEXTAUTH_URL}/api/auth/callback/github`
      : '(NEXTAUTH_URL not set)',
  };

  return NextResponse.json(config);
}
