import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth/config';
import type { NextRequest } from 'next/server'

const handler = NextAuth(authConfig);

export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl
    const path = `${url.pathname}${url.search}`
    const maskedId = (process.env.OAUTH_CLIENT_ID || '').slice(0, 4) + '***' + (process.env.OAUTH_CLIENT_ID || '').slice(-4)
    const isCallback = url.pathname.startsWith('/api/auth/callback/github')
    const qp: Record<string, string | number | boolean> = {}
    if (isCallback) {
      const code = url.searchParams.get('code') || ''
      qp.code_len = code.length
      qp.installation_id = url.searchParams.get('installation_id') || ''
      qp.setup_action = url.searchParams.get('setup_action') || ''
      qp.error = url.searchParams.get('error') || ''
      qp.state_len = (url.searchParams.get('state') || '').length
    }
    console.log('[auth][GET]', { path, isCallback, NEXTAUTH_URL: process.env.NEXTAUTH_URL, OAUTH_CLIENT_ID: maskedId, ...qp })
  } catch {}
  return handler(req)
}

export async function POST(req: NextRequest) {
  try {
    const url = req.nextUrl
    const path = `${url.pathname}${url.search}`
    console.log('[auth][POST]', { path })
  } catch {}
  return handler(req)
}
