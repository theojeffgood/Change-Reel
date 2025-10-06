'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Commit } from '@/lib/types/supabase';

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

export function useCommitHistory(pageSize: number = 10) {
  const [state, setState] = useState<CommitHistoryState>({
    commits: [],
    isLoading: true,
    error: null,
    page: 1,
    totalPages: 1,
  });

  const [userProjectIds, setUserProjectIds] = useState<string[]>([]);

  const fetchCommits = useCallback(async (currentPage: number, silent = false) => {
    // Only show loading state if not silent (to avoid flickering on realtime updates)
    if (!silent) {
      setState(prevState => ({ ...prevState, isLoading: true }));
    }
    
    try {
      const { commits, count } = await fetcher(currentPage, pageSize);
      
      // Extract unique project IDs from the returned commits for realtime filtering
      if (commits && commits.length > 0 && userProjectIds.length === 0) {
        const projectIds = [...new Set(commits.map((c: any) => c.project_id))];
        setUserProjectIds(projectIds);
      }
      
      setState(prevState => ({
        ...prevState,
        commits,
        isLoading: false,
        page: currentPage,
        totalPages: Math.ceil(count / pageSize),
        error: null,
      }));
    } catch (error) {
      setState(prevState => ({
        ...prevState,
        isLoading: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      }));
    }
  }, [pageSize, userProjectIds.length]);

  // Set up Supabase Realtime subscription for commit updates
  // Only subscribes to commits for the current user's projects
  useEffect(() => {
    // Don't subscribe until we know which projects belong to this user
    if (userProjectIds.length === 0) return;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.warn('Supabase credentials not found, realtime updates disabled');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Create a subscription for each user project
    // This ensures we only get notified about commits relevant to this user
    const channels = userProjectIds.map((projectId) => {
      return supabase
        .channel(`commit-updates-${projectId}`)
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: 'commits',
            filter: `project_id=eq.${projectId}`, // CRITICAL: Only listen to this user's projects
          },
          () => {
            // When a relevant commit changes, silently refresh the current page
            fetchCommits(state.page, true);
          }
        )
        .subscribe();
    });

    return () => {
      // Clean up all subscriptions
      channels.forEach((channel) => {
        supabase.removeChannel(channel);
      });
    };
  }, [userProjectIds, state.page, fetchCommits]);

  // Initial fetch
  useEffect(() => {
    fetchCommits(1);
  }, [fetchCommits]);

  const setPage = (newPage: number) => {
    if (newPage > 0 && newPage <= state.totalPages) {
      fetchCommits(newPage);
    }
  };

  return { ...state, setPage };
} 