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

console.log('[Auth Config] Initializing with:', {
  hasClientId: !!process.env.OAUTH_CLIENT_ID,
  clientIdLength: process.env.OAUTH_CLIENT_ID?.length,
  hasClientSecret: !!process.env.OAUTH_CLIENT_SECRET,
  hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
  nextAuthUrl: process.env.NEXTAUTH_URL,
});

if (!process.env.OAUTH_CLIENT_ID) {
  throw new Error('Missing OAUTH_CLIENT_ID environment variable');
}

if (!process.env.OAUTH_CLIENT_SECRET) {
  throw new Error('Missing OAUTH_CLIENT_SECRET environment variable');
}

if (!process.env.NEXTAUTH_SECRET) {
  throw new Error('Missing NEXTAUTH_SECRET environment variable');
}

export const authConfig: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.OAUTH_CLIENT_ID,
      clientSecret: process.env.OAUTH_CLIENT_SECRET,
      authorization: {
        params: {
          scope: 'read:user user:email read:org',
        },
      },
      // CRITICAL: Disable checks entirely - this was breaking OAuth after domain migration
      // GitHub App-initiated OAuth provides its own state, causing mismatch
      checks: [],
      profile(profile) {
        console.log('[Auth] GitHub profile received:', {
          id: profile.id,
          login: profile.login,
          email: profile.email,
        });
        return {
          id: profile.id.toString(),
          name: profile.name || profile.login,
          email: profile.email,
          image: profile.avatar_url,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  // Configure cookies for the new domain (migration from winscolumn.com to changereel.com)
  cookies: {
    sessionToken: {
      name: `__Secure-next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: true,
        domain: process.env.NODE_ENV === 'production' ? '.changereel.com' : undefined,
      },
    },
    callbackUrl: {
      name: `__Secure-next-auth.callback-url`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: true,
        domain: process.env.NODE_ENV === 'production' ? '.changereel.com' : undefined,
      },
    },
    csrfToken: {
      name: `__Host-next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: true,
      },
    },
  },
  // Enable debug logging in production for OAuth troubleshooting
  debug: true,
  logger: {
    error(code, metadata) {
      console.error('[NextAuth Error]', code, JSON.stringify(metadata, null, 2));
    },
    warn(code) {
      console.warn('[NextAuth Warn]', code);
    },
    debug(code, metadata) {
      console.log('[NextAuth Debug]', code, JSON.stringify(metadata, null, 2));
    },
  },
  // Use NextAuth defaults for cookies/state handling
  callbacks: {
    async jwt({ token, account, profile }) {
      console.log('[Auth] JWT callback triggered', {
        hasAccount: !!account,
        hasProfile: !!profile,
        provider: account?.provider,
        profileId: profile?.id,
        profileLogin: (profile as any)?.login,
      });

      const githubToken = token as GithubJwt;

      if (profile?.id) {
        githubToken.githubId = profile.id;
        console.log('[Auth] Set githubId from profile:', profile.id);
      }
      if (profile?.login) {
        githubToken.login = profile.login;
        console.log('[Auth] Set login from profile:', profile.login);
      }

      if (account?.provider === 'github') {
        console.log('[Auth] Processing GitHub account', {
          accessToken: account.access_token ? 'present' : 'missing',
          expiresAt: (account as any)?.expires_at,
          refreshToken: (account as any)?.refresh_token ? 'present' : 'missing',
        });
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
      console.log('[Auth] Session callback triggered', {
        hasUser: !!session.user,
        githubId: token.githubId,
        login: token.login,
        hasAccessTokenError: !!(token as GithubJwt).accessTokenError,
      });

      // Send properties to the client
      if (session.user) {
        session.user.githubId = token.githubId;
        session.user.login = token.login;
        // Ensure we have a proper user ID for token storage
        if (token.githubId) {
          session.user.id = String(token.githubId);
        }
      }
      if ((token as GithubJwt).accessTokenError) {
        (session as any).error = (token as GithubJwt).accessTokenError;
        console.log('[Auth] Access token error:', (token as GithubJwt).accessTokenError);
      }
      // Intentionally DO NOT add accessToken to the session object to avoid exposing it to the client.
      return session;
    },
    // Removed custom redirect callback - it was interfering with OAuth flow
    // NextAuth will handle redirects using the callbackUrl parameter
  },
  pages: {
    signIn: '/config',
    error: '/config',
  },
  events: {
    async signIn({ user, account, profile, isNewUser }) {
      console.log('[Auth] SignIn event triggered', {
        userId: user?.id,
        userEmail: user?.email,
        provider: account?.provider,
        profileId: profile?.id,
        isNewUser,
      });

      // Create user record on first sign-in (OAuth used for identity only)
      if (account?.provider === 'github' && profile?.id) {
        console.log('[Auth] Processing GitHub sign-in for profile:', profile.id);
        try {
          // Import Supabase service (use service role for server-side operations)
          const { getServiceRoleSupabaseService } = await import('@/lib/supabase/client');
          const supabaseService = getServiceRoleSupabaseService();

          // Create or update user record in database
          const { data: existingUser } = await supabaseService.users.getUserByGithubId(String(profile.id));
          
          if (!existingUser) {
            // Create new user record
            const { data: newUser, error: createError } = await supabaseService.users.createUser({
              email: user.email || '',
              name: user.name || '',
              github_id: String(profile.id),
            });
            
            if (createError) {
              console.error('Failed to create user record:', createError);
            } else {
              console.log('User record created successfully:', newUser?.email);
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
                  for (const r of repos) {
                    const existing = await supabaseService.projects.getProjectByRepository(r.full_name)
                    if (!existing.data) {
                      await supabaseService.projects.createProject({
                        user_id: userId,
                        name: r.full_name,
                        repo_name: r.full_name,
                        provider: 'github',
                        installation_id: inst.id,
                        email_distribution_list: [],
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
