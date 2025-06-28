'use client';

import { useState, useEffect, useCallback } from 'react';
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

  const fetchCommits = useCallback(async (currentPage: number) => {
    setState(prevState => ({ ...prevState, isLoading: true }));
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