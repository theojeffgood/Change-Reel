'use client';

import { useState, useEffect } from 'react';
import { Project } from '@/lib/types/supabase';

interface RepositoryConfigState {
  project: Project | null;
  isLoading: boolean;
  error: string | null;
}

const fetcher = async (): Promise<{ project: Project | null }> => {
  const res = await fetch('/api/projects');

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || 'Failed to fetch repository configuration');
  }

  return res.json();
};

export function useRepositoryConfig(): RepositoryConfigState {
  const [state, setState] = useState<RepositoryConfigState>({
    project: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const getConfig = async () => {
      try {
        const { project } = await fetcher();
        setState({ project, isLoading: false, error: null });
      } catch (error) {
        setState({
          project: null,
          isLoading: false,
          error: error instanceof Error ? error.message : 'An unknown error occurred',
        });
      }
    };

    getConfig();
  }, []);

  return state;
} 