import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth/config';
import { NextRequest } from 'next/server';

// Create handler once at module level (NextAuth best practice)
const handler = NextAuth(authConfig);

// Wrapper to add diagnostics
async function loggedHandler(req: NextRequest, context: any) {
  const { nextauth } = context.params;
  const isSignIn = nextauth?.[0] === 'signin';
  
  console.log('[Auth Route]', {
    method: req.method,
    url: req.url,
    path: nextauth,
    headers: {
      host: req.headers.get('host'),
      origin: req.headers.get('origin'),
      referer: req.headers.get('referer'),
      cookie: req.headers.get('cookie') ? 'present' : 'missing',
    },
  });

  if (isSignIn && nextauth?.[1] === 'github') {
    console.log('[Auth Route] GitHub sign-in attempt detected');
    console.log('[Auth Route] OAuth credentials check:', {
      clientId: process.env.OAUTH_CLIENT_ID ? `${process.env.OAUTH_CLIENT_ID.slice(0, 10)}...` : 'MISSING',
      clientSecret: process.env.OAUTH_CLIENT_SECRET ? 'present' : 'MISSING',
      nextAuthUrl: process.env.NEXTAUTH_URL,
      nextAuthSecret: process.env.NEXTAUTH_SECRET ? 'present' : 'MISSING',
    });
  }

  try {
    const response = await handler(req, context);
    const location = response?.headers?.get('location');
    
    console.log('[Auth Route] Response:', {
      status: response?.status,
      location: location || 'none',
      isRedirect: response?.status === 302 || response?.status === 307,
    });
    
    if (isSignIn && location?.includes('error=')) {
      console.error('[Auth Route] SIGN-IN FAILED - Redirecting to error page:', location);
      console.error('[Auth Route] This indicates NextAuth rejected the OAuth flow before GitHub');
    }
    
    return response;
  } catch (error) {
    console.error('[Auth Route] Exception caught:', error);
    throw error;
  }
}

export { loggedHandler as GET, loggedHandler as POST }
