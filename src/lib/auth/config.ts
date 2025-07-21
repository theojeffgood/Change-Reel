import { NextAuthOptions } from 'next-auth';
import GitHubProvider from 'next-auth/providers/github';
import { storeOAuthToken } from '@/lib/auth/token-storage';

if (!process.env.GITHUB_CLIENT_ID) {
  throw new Error('Missing GITHUB_CLIENT_ID environment variable');
}

if (!process.env.GITHUB_CLIENT_SECRET) {
  throw new Error('Missing GITHUB_CLIENT_SECRET environment variable');
}

if (!process.env.NEXTAUTH_SECRET) {
  throw new Error('Missing NEXTAUTH_SECRET environment variable');
}

export const authConfig: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      authorization: {
        params: {
          scope: 'repo write:repo_hook user:email',
        },
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      // Persist the OAuth access_token to the token right after signin
      if (account) {
        token.accessToken = account.access_token;
        token.githubId = profile?.id;
        token.login = profile?.login;
      }
      return token;
    },
    async session({ session, token }) {
      // Send properties to the client
      if (session.user) {
        session.accessToken = token.accessToken;
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
      // Store GitHub access token securely after successful sign-in
      if (account?.provider === 'github' && account.access_token && profile?.id) {
        try {
          // Import Supabase service
          const { getSupabaseService } = await import('@/lib/supabase/client');
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
            }
          }

          // Store OAuth token
          const scopes = account.scope ? account.scope.split(' ') : [];
          await storeOAuthToken(
            String(profile.id), // Use GitHub ID as user identifier
            'github',
            {
              accessToken: account.access_token,
              scopes,
              expiresAt: account.expires_at ? new Date(account.expires_at * 1000) : undefined
            }
          );
          console.log('GitHub OAuth token stored successfully for user:', user.email);
        } catch (error) {
          console.error('Failed to store GitHub OAuth token or create user:', error);
        }
      }
    },
  },
}; 