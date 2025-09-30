import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth/config';
import { NextRequest } from 'next/server';

const handler = NextAuth(authConfig)

// Wrapper to log all auth requests
async function loggedHandler(req: NextRequest, context: any) {
  console.log('[Auth Route]', {
    method: req.method,
    url: req.url,
    path: context?.params?.nextauth,
    headers: {
      host: req.headers.get('host'),
      origin: req.headers.get('origin'),
      referer: req.headers.get('referer'),
    },
  });

  try {
    const response = await handler(req, context);
    const location = response?.headers?.get('location');
    console.log('[Auth Route] Response:', {
      status: response?.status,
      location: location || 'none',
      isRedirect: response?.status === 302 || response?.status === 307,
    });
    return response;
  } catch (error) {
    console.error('[Auth Route] Error:', error);
    throw error;
  }
}

export { loggedHandler as GET, loggedHandler as POST }
