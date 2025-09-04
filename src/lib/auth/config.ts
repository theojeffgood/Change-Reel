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
      authorization: {
        url: 'https://github.com/login/oauth/authorize',
        params: {
          scope: 'read:user user:email',
        },
      },
      token: 'https://github.com/login/oauth/access_token',
      userinfo: 'https://api.github.com/user',
      checks: [],
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  cookies: {
    state: {
      name: `next-auth.state-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 900,
      },
    },
  },
  debug: process.env.NODE_ENV === 'development',
  callbacks: {
    async jwt({ token, account, profile }) {
      // Persist the OAuth access_token to the token right after signin
      if (account) {
        token.githubId = profile?.id;
        token.login = profile?.login;
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
      return session;
    },
  },
  pages: {
    signIn: '/config',
    error: '/config',
  },
  events: {
    async signIn({ user, account, profile, isNewUser }) {
      // Create user record on first sign-in; do not store repository OAuth tokens
      if (account?.provider === 'github' && profile?.id) {
        try {
          // Import Supabase service
          const { getSupabaseService, getServiceRoleSupabaseService } = await import('@/lib/supabase/client');
          const supabaseService = getSupabaseService();

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
        } catch (error) {
          console.error('Failed to create user on sign-in:', error);
        }
      }
    },
  },
}; 