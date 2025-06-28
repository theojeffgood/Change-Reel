'use client';

import React from 'react';
import { Commit } from '@/lib/types/supabase';
import CommitCard from './CommitCard';

interface CommitListProps {
  commits: Commit[];
}

export default function CommitList({ commits }: CommitListProps) {
  if (commits.length === 0) {
    return <p>No commits found.</p>;
  }

  return (
    <div>
      {commits.map(commit => (
        <CommitCard key={commit.id} commit={commit} />
      ))}
    </div>
  );
} 