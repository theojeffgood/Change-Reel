'use client';

import React from 'react';
import { Commit } from '@/lib/types/supabase';
import CommitCard from './CommitCard';

interface CommitListProps {
  commits: Commit[];
}

export default function CommitList({ commits }: CommitListProps) {
  if (commits.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-gray-400 text-2xl">📝</span>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No commits found</h3>
        <p className="text-gray-600">
          Commits will appear here once they are processed and have summaries generated.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {commits.map(commit => (
        <CommitCard key={commit.id} commit={commit} />
      ))}
    </div>
  );
} 