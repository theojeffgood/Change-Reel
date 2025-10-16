'use client';

import { useEffect } from 'react';
import { SessionProvider, useSession } from 'next-auth/react';
import { identifyUser, resetAnalytics } from '@/lib/analytics';

interface AuthProviderProps {
  children: React.ReactNode;
}

function PostHogIdentifier() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === 'loading') return;

    if (session?.user) {
      // Identify the user with their GitHub ID as the stable identifier
      const userId = session.user.githubId?.toString() || session.user.id;
      
      identifyUser(userId, {
        email: session.user.email,
        name: session.user.name,
        github_login: session.user.login,
        github_id: session.user.githubId,
      });
    } else if (!session) {
      // User signed out; reset to anonymous
      resetAnalytics();
    }
  }, [session, status]);

  return null;
}

export function AuthProvider({ children }: AuthProviderProps) {
  return (
    <SessionProvider>
      <PostHogIdentifier />
      {children}
    </SessionProvider>
  );
} 