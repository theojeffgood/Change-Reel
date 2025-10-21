import { NextAuthOptions } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import GitHubProvider from 'next-auth/providers/github';

const TOKEN_EXPIRY_BUFFER_MS = 60_000; // refresh 1 minute before expiry

type GithubJwt = JWT & {
  accessToken?: string;
  accessTokenExpires?: number;
  refreshToken?: string;
  refreshTokenExpires?: number;
  accessTokenError?: string;
};

// Fetch the user's primary verified email from GitHub if not provided by default profile
async function fetchGithubPrimaryVerifiedEmail(accessToken: string | undefined): Promise<string | undefined> {
  if (!accessToken) return undefined;
  try {
    console.log('[auth] [emails] starting fetch to GitHub user/emails (Bearer token present)');
    const res = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'change-reel/1.0.0',
      },
    });
    console.log('[auth] [emails] response status', res.status, 'ok=', res.ok);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn('[auth] [emails] non-OK response body:', text?.slice(0, 500));
      return undefined;
    }
    const emails = await res.json();
    console.log('[auth] [emails] parsed emails count:', Array.isArray(emails) ? emails.length : 'n/a');
    if (!Array.isArray(emails)) return undefined;
    // Prefer primary & verified
    const primaryVerified = emails.find((e: any) => e?.primary && e?.verified && typeof e?.email === 'string');
    if (primaryVerified?.email) return primaryVerified.email as string;
    // Fallback to any verified
    const anyVerified = emails.find((e: any) => e?.verified && typeof e?.email === 'string');
    if (anyVerified?.email) return anyVerified.email as string;
    // Last resort: first email string
    const first = emails.find((e: any) => typeof e?.email === 'string');
    return first?.email as string | undefined;
  } catch (e) {
    console.warn('[auth] [emails] fetch failed', (e as any)?.message);
    return undefined;
  }
}

async function refreshGitHubAccessToken(token: GithubJwt): Promise<GithubJwt> {
  if (!token.refreshToken) {
    return {
      ...token,
      accessTokenError: 'Missing refresh token',
    };
  }

  try {
    const params = new URLSearchParams({
      client_id: process.env.OAUTH_CLIENT_ID!,
      client_secret: process.env.OAUTH_CLIENT_SECRET!,
      grant_type: 'refresh_token',
      refresh_token: token.refreshToken,
    });

    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: params.toString(),
    });

    const refreshed = await response.json();

    if (!response.ok || !refreshed?.access_token) {
      const message = refreshed?.error_description || refreshed?.error || `HTTP ${response.status}`;
      throw new Error(message);
    }

    const expiresInMs = typeof refreshed.expires_in === 'number' ? refreshed.expires_in * 1000 : undefined;
    const refreshExpiresInMs = typeof refreshed.refresh_token_expires_in === 'number' ? refreshed.refresh_token_expires_in * 1000 : undefined;

    return {
      ...token,
      accessToken: refreshed.access_token,
      accessTokenExpires: expiresInMs ? Date.now() + expiresInMs : undefined,
      refreshToken: refreshed.refresh_token || token.refreshToken,
      refreshTokenExpires: refreshExpiresInMs ? Date.now() + refreshExpiresInMs : token.refreshTokenExpires,
      accessTokenError: undefined,
    };
  } catch (error) {
    console.error('[auth] failed to refresh GitHub access token', error);
    return {
      ...token,
      accessToken: undefined,
      accessTokenExpires: undefined,
      accessTokenError: error instanceof Error ? error.message : 'Unknown refresh error',
    };
  }
}

// Only validate environment variables at runtime, not during build
const isRuntime = typeof window === 'undefined' && process.env.NODE_ENV !== 'test';
const isBuild = process.env.NODE_ENV === 'production' && !process.env.OAUTH_CLIENT_ID;

if (isRuntime && !isBuild) {
  if (!process.env.OAUTH_CLIENT_ID) {
    throw new Error('Missing OAUTH_CLIENT_ID environment variable');
  }

  if (!process.env.OAUTH_CLIENT_SECRET) {
    throw new Error('Missing OAUTH_CLIENT_SECRET environment variable');
  }

  if (!process.env.NEXTAUTH_SECRET) {
    throw new Error('Missing NEXTAUTH_SECRET environment variable');
  }
}

export const authConfig: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.OAUTH_CLIENT_ID!,
      clientSecret: process.env.OAUTH_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'read:user user:email read:org',
        },
      },
      // Disable state/PKCE checks to support GitHub App-initiated OAuth during installation
      // (GitHub provides the state, not NextAuth; this prevents state mismatch)
      checks: [],
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  // Use NextAuth defaults for cookies/state handling
  debug: process.env.NODE_ENV === 'development',
  callbacks: {
    async jwt({ token, account, profile, user }) {
      const githubToken = token as GithubJwt;

      if (profile?.id) {
        githubToken.githubId = profile.id;
      }
      if (profile?.login) {
        githubToken.login = profile.login;
      }

      if (account?.provider === 'github') {
        console.log('[auth] [jwt] provider=github, has access_token=', Boolean((account as any)?.access_token));
        const expiresAtMs = typeof (account as any)?.expires_at === 'number'
          ? ((account as any).expires_at as number) * 1000
          : undefined;
        const expiresInMs = typeof (account as any)?.expires_in === 'number'
          ? ((account as any).expires_in as number) * 1000
          : undefined;

        githubToken.accessToken = (account as any)?.access_token ?? githubToken.accessToken;
        githubToken.accessTokenExpires = expiresAtMs ?? (expiresInMs ? Date.now() + expiresInMs : githubToken.accessTokenExpires);
        githubToken.refreshToken = (account as any)?.refresh_token ?? githubToken.refreshToken;
        const refreshExpiresInMs = typeof (account as any)?.refresh_token_expires_in === 'number'
          ? ((account as any).refresh_token_expires_in as number) * 1000
          : undefined;
        githubToken.refreshTokenExpires = refreshExpiresInMs
          ? Date.now() + refreshExpiresInMs
          : githubToken.refreshTokenExpires;
        githubToken.accessTokenError = undefined;

        // Ensure token.email is populated at sign-in time
        if (!token.email) {
          try {
            const oauthAccessToken = (account as any)?.access_token as string | undefined;
            console.log('[auth] [jwt] token.email missing; attempting email resolution via user/emails');
            const resolvedEmail = (user as any)?.email || (await fetchGithubPrimaryVerifiedEmail(oauthAccessToken));
            if (resolvedEmail) {
              token.email = resolvedEmail;
              console.log('[auth] [jwt] token.email set from resolution:', resolvedEmail);
            } else {
              console.log('[auth] [jwt] token.email still missing after resolution attempt');
            }
          } catch (e) {
            console.warn('[auth] [jwt] email resolution threw', (e as any)?.message);
          }
        }
      }

      const expiresAt = githubToken.accessTokenExpires;

      if (!githubToken.accessToken) {
        return githubToken;
      }

      if (!expiresAt) {
        // Token is treated as long-lived (some GitHub OAuth tokens never expire)
        return githubToken;
      }

      if (Date.now() < expiresAt - TOKEN_EXPIRY_BUFFER_MS) {
        return githubToken;
      }

      if (
        githubToken.refreshTokenExpires &&
        Date.now() >= githubToken.refreshTokenExpires - TOKEN_EXPIRY_BUFFER_MS
      ) {
        return {
          ...githubToken,
          accessToken: undefined,
          accessTokenExpires: undefined,
          accessTokenError: 'Refresh token expired',
        };
      }

      return refreshGitHubAccessToken(githubToken);
    },
    async session({ session, token }) {
      // Send properties to the client
      if (session.user) {
        session.user.githubId = token.githubId;
        session.user.login = token.login;
        if (!session.user.email && typeof token.email === 'string') {
          session.user.email = token.email as string;
        }
        // Ensure we have a proper user ID for token storage
        if (token.githubId) {
          session.user.id = String(token.githubId);
        }
      }
      if ((token as GithubJwt).accessTokenError) {
        (session as any).error = (token as GithubJwt).accessTokenError;
      }
      // Intentionally DO NOT add accessToken to the session object to avoid exposing it to the client.
      return session;
    },
    async redirect({ url, baseUrl }) {
      try {
        // Always land users on /config after auth/install flows
        // unless an internal non-auth page was explicitly requested.
        const to = new URL(url, baseUrl)
        const isInternal = to.origin === baseUrl
        if (isInternal) {
          const p = to.pathname
          // Redirect away from root and auth routes to /config
          if (p === '/' || p.startsWith('/api/auth')) return `${baseUrl}/config`
          return to.toString()
        }
      } catch {}
      return `${baseUrl}/config`
    },
  },
  pages: {
    signIn: '/signin',
    error: '/config',
  },
  events: {
    async signIn({ user, account, profile, isNewUser }) {
      // Create user record on first sign-in (OAuth used for identity only)
      if (account?.provider === 'github' && profile?.id) {
        try {
          // Import Supabase service (use service role for server-side operations)
          const { getServiceRoleSupabaseService } = await import('@/lib/supabase/client');
          const supabaseService = getServiceRoleSupabaseService();

          // Create or update user record in database
          const { data: existingUser } = await supabaseService.users.getUserByGithubId(String(profile.id));
          let resolvedUserEmail: string | undefined = existingUser?.email || undefined;
          console.log('[auth] [signIn] existingUser?', Boolean(existingUser), 'hasEmail=', Boolean(existingUser?.email));
          
          if (!existingUser) {
            // Resolve a reliable email: use provided one or fetch from /user/emails
            const oauthAccessToken = (account as any)?.access_token as string | undefined;
            console.log('[auth] [signIn] creating user; has access_token=', Boolean(oauthAccessToken));
            const resolvedEmail = user.email || (await fetchGithubPrimaryVerifiedEmail(oauthAccessToken)) || undefined;
            resolvedUserEmail = resolvedEmail;
            console.log('[auth] [signIn] resolvedEmail before create:', resolvedEmail || '(none)');

            // Create new user record
            const { data: newUser, error: createError } = await supabaseService.users.createUser({
              email: resolvedEmail,
              name: user.name || '',
              github_id: String(profile.id),
            });
            
            if (createError) {
              console.error('Failed to create user record:', createError);
            } else {
              console.log('User record created successfully:', newUser?.email);
              // If we didn't get an email earlier but now have token, backfill immediately
              try {
                if (!resolvedEmail && oauthAccessToken) {
                  console.log('[auth] [signIn] immediate backfill: fetching user/emails');
                  const fetched = await fetchGithubPrimaryVerifiedEmail(oauthAccessToken)
                  if (fetched && newUser?.id) {
                    await supabaseService.users.updateUser(newUser.id, { email: fetched });
                    resolvedUserEmail = fetched;
                    console.log('[auth] [signIn] immediate backfill set email:', fetched);
                  } else {
                    console.log('[auth] [signIn] immediate backfill found no email');
                  }
                }
              } catch (e) {
                console.warn('[auth] immediate email backfill skipped', (e as any)?.message)
              }
              // Grant starter credits (3) to newly created users
              try {
                if (newUser?.id) {
                  const { createBillingService } = await import('@/lib/supabase/services/billing');
                  const supaRole = getServiceRoleSupabaseService().getClient();
                  const billing = createBillingService(supaRole);
                  await billing.addCredits(newUser.id, 3, 'Starter credits');
                  console.log('[billing] granted starter credits', { userId: newUser.id, amount: 3 });
                }
              } catch (creditErr) {
                console.error('Failed to grant starter credits:', creditErr);
              }
            }
          }

          // Backfill user email if existing user has blank email
          try {
            if (existingUser?.id && !existingUser.email) {
              const oauthAccessToken = (account as any)?.access_token as string | undefined;
              console.log('[auth] [signIn] existing user email blank; attempting backfill; has token=', Boolean(oauthAccessToken));
              const resolvedEmail = user.email || (await fetchGithubPrimaryVerifiedEmail(oauthAccessToken));
              if (resolvedEmail) {
                await supabaseService.users.updateUser(existingUser.id, { email: resolvedEmail });
                resolvedUserEmail = resolvedEmail;
                console.log('[auth] [signIn] backfill set email:', resolvedEmail);
              } else {
                console.log('[auth] [signIn] backfill found no email');
              }
            }
          } catch (e) {
            console.warn('[auth] email backfill skipped', (e as any)?.message)
          }

          // Auto-register installations and repos on sign-in (no UI change)
          try {
            const userId = (existingUser?.id) || (await supabaseService.users.getUserByGithubId(String(profile.id))).data?.id
            const accessToken = (account as any)?.access_token as string | undefined
            if (userId && accessToken) {
              const { listUserInstallations, listInstallationRepositories } = await import('@/lib/github/app-auth')
              const { createInstallationService } = await import('@/lib/supabase/services/installations')
              const installationsSvc = createInstallationService(supabaseService.getClient())
              const installs = await listUserInstallations(accessToken)
              for (const inst of installs) {
                // Upsert installation mapping via service
                await installationsSvc.upsertInstallation({
                  installation_id: inst.id,
                  provider: 'github',
                  user_id: userId,
                  account_login: inst.account?.login,
                  account_id: undefined,
                  account_type: inst.account?.type,
                })

                // Upsert all repos as projects
                try {
                  const repos = await listInstallationRepositories(inst.id)
                  const defaultEmailList = resolvedUserEmail && !resolvedUserEmail.endsWith('@users.noreply.github.com')
                    ? [resolvedUserEmail]
                    : []
                  console.log('[auth] [signIn] default email list for projects:', defaultEmailList);
                  for (const r of repos) {
                    const existing = await supabaseService.projects.getProjectByRepository(r.full_name)
                    if (!existing.data) {
                      await supabaseService.projects.createProject({
                        user_id: userId,
                        name: r.full_name,
                        repo_name: r.full_name,
                        provider: 'github',
                        installation_id: inst.id,
                        email_distribution_list: defaultEmailList,
                      })
                    }
                  }
                } catch (e) {
                  console.warn('[auth] repo sync failed for installation', inst.id, (e as any)?.message)
                }
              }
            }
          } catch (e) {
            console.warn('[auth] installation auto-registration skipped', (e as any)?.message)
          }
        } catch (error) {
          console.error('Failed to create user on sign-in:', error);
        }
      }
    },
  },
};
