import { NextAuthOptions } from 'next-auth';
import GitHubProvider from 'next-auth/providers/github';

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
    async jwt({ token, account, profile }) {
      // Persist the OAuth access_token to the token right after signin
      if (account) {
        token.githubId = profile?.id;
        token.login = profile?.login;
        // Store the GitHub user OAuth access token on the server-side JWT
        // Used by server routes to call user-scoped GitHub APIs (e.g., /user/installations)
        // Do NOT expose this on the client session.
        // account.access_token is provided by next-auth for OAuth providers
        // Typing cast to any to avoid NextAuth type limitations.
        (token as any).accessToken = (account as any)?.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      // Send properties to the client
      if (session.user) {
        session.user.githubId = token.githubId;
        session.user.login = token.login;
        // Ensure we have a proper user ID for token storage
        if (token.githubId) {
          session.user.id = String(token.githubId);
        }
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
    signIn: '/config',
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
