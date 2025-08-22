import React from 'react';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth/config';
import { getServiceRoleSupabaseService } from '@/lib/supabase/client';
import { createBillingService } from '@/lib/supabase/services/billing';
import ErrorBoundary from './components/ErrorBoundary';
import CommitHistoryPanel from './components/CommitHistoryPanel';
import Link from 'next/link';
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import MetricsBar from './components/MetricsBar'

export default async function AdminPage() {
  // Determine if current user has credits
  let hasCredits = false;
  try {
    const session = await getServerSession(authConfig);
    if (session?.user?.githubId) {
      const supaService = getServiceRoleSupabaseService();
      const userRes = await supaService.users.getUserByGithubId(String(session.user.githubId));
      const user = userRes.data;
      if (user) {
        const billing = createBillingService(supaService.getClient());
        hasCredits = await billing.hasCredits(user.id);
      }
    }
  } catch (_) {
    hasCredits = false;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader isAuthenticated={true} />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <MetricsBar />
        {/* Page Header - emphasize summaries */}
        <div className="py-4">

        <div className="flex items-center justify-between"> 
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Recent Product Updates
          </h2>

          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-600">Live Monitoring</span>
            </div>
          </div>
        </div>

        {/* Dashboard Grid - focus on summaries */}
        <div className="grid grid-cols-1 gap-8">
          {/* Main Panel */}
          <div className="space-y-6">
            <ErrorBoundary>
              <CommitHistoryPanel hasCredits={hasCredits} />
            </ErrorBoundary>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
} 