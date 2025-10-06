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

const fetchUserProjects = async (): Promise<string[]> => {
  try {
    const res = await fetch('/api/projects');
    if (!res.ok) return [];
    const data = await res.json();
    const projects = data.projects || [];
    return projects.map((p: any) => p.id).filter(Boolean);
  } catch {
    return [];
  }
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
  }, [pageSize]);

  // Fetch user's project IDs on mount for realtime filtering
  useEffect(() => {
    fetchUserProjects().then(setUserProjectIds);
  }, []);

  // Set up Supabase Realtime subscription for commit updates
  // User-scoped: only listens to commits for the current user's projects
  useEffect(() => {
    // Wait until we have the user's project IDs
    // New users will have projects created during installation (before commits)
    if (userProjectIds.length === 0) return;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.warn('Supabase credentials not found, realtime updates disabled');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Create a filtered subscription for each user project
    // This ensures we only receive updates for commits belonging to this user
    const channels = userProjectIds.map((projectId) => {
      return supabase
        .channel(`commit-updates-${projectId}`)
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'commits',
            filter: `project_id=eq.${projectId}`, // Only this project's commits
          },
          (payload) => {
            const commitId = (payload.new as any)?.id || 'unknown';
            console.log('🔔 Realtime event received:', payload.eventType, 'commit:', commitId, 'project:', projectId);
            // Silently refresh - will only show commits for this user's projects
            fetchCommits(state.page, true);
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('📡 Subscribed to project:', projectId);
          }
        });
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