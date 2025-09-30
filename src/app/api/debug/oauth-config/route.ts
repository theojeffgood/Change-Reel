import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  // Require a secret key to access debug info
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');
  
  // Use NEXTAUTH_SECRET as the debug key (already secret, already set)
  if (key !== process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
