'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Commit } from '@/lib/types/supabase';
import { trackError } from '@/lib/analytics';

interface CommitHistoryState {
  commits: Commit[];
  isLoading: boolean;
  error: string | null;
  page: number;
  totalPages: number;
}

const fetcher = async (page: number, pageSize: number): Promise<{ commits: Commit[]; count: number }> => {
  const res = await fetch(`/api/commits?page=${page}&pageSize=${pageSize}`);
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || 'Failed to fetch commit history');
  }
  return res.json();
};

export function useCommitHistory(pageSize: number = 10, initialInstallationIds: number[] = []) {
  const [state, setState] = useState<CommitHistoryState>({
    commits: [],
    isLoading: true,
    error: null,
    page: 1,
    totalPages: 1,
  });

  const fetchCommits = useCallback(async (currentPage: number, silent = false) => {
    // Only show loading state if not silent (to avoid flickering on realtime updates)
    if (!silent) {
      setState(prevState => ({ ...prevState, isLoading: true }));
    }
    
    try {
      const { commits, count } = await fetcher(currentPage, pageSize);
      
      setState(prevState => ({
        ...prevState,
        commits,
        isLoading: false,
        page: currentPage,
        totalPages: Math.ceil(count / pageSize),
        error: null,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      
      setState(prevState => ({
        ...prevState,
        isLoading: false,
        error: errorMessage,
      }));
      
      // Track commit history fetch error
      trackError('api_error', error as Error, {
        action: 'fetch_commit_history',
        page: currentPage,
        page_size: pageSize,
      });
    }
  }, [pageSize]);

  // Set up Supabase Realtime subscription for commit updates
  // Installation-scoped: filters by installation_id (timing-independent)
  useEffect(() => {
    // No installation IDs provided (e.g., user not logged in)
    if (initialInstallationIds.length === 0) return;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.warn('Supabase credentials not found, realtime updates disabled');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Create a filtered subscription for each user installation
    // Installation IDs are stable and known immediately (created during OAuth)
    // This makes realtime timing-independent - no race conditions
    const channels = initialInstallationIds.map((installationId) => {
      return supabase
        .channel(`commit-updates-install-${installationId}`)
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'commits',
            filter: `installation_id=eq.${installationId}`, // Only this installation's commits
          },
          (payload) => {
            const commitId = (payload.new as any)?.id || 'unknown';
            console.log('🔔 Realtime event received:', payload.eventType, 'commit:', commitId, 'installation:', installationId);
            // Silently refresh when commits change
            fetchCommits(state.page, true);
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('✅ Subscribed to installation:', installationId);
          }
        });
    });

    return () => {
      // Clean up all subscriptions
      channels.forEach((channel) => {
        supabase.removeChannel(channel);
      });
    };
  }, [initialInstallationIds, state.page, fetchCommits]);

  // Initial fetch
  useEffect(() => {
    fetchCommits(1);
  }, [fetchCommits]);

  // Listen for explicit refresh signals (e.g., after retrying failed jobs)
  useEffect(() => {
    const handler = () => {
      // Fetch non-silently so per-card processing state becomes visible
      fetchCommits(state.page, false);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('commits:refresh', handler);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('commits:refresh', handler);
      }
    };
  }, [state.page, fetchCommits]);

  const setPage = (newPage: number) => {
    if (newPage > 0 && newPage <= state.totalPages) {
      fetchCommits(newPage);
    }
  };

  return { ...state, setPage };
} 