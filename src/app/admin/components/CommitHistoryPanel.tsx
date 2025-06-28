'use client';

import React from 'react';
import { useCommitHistory } from '@/lib/hooks/useCommitHistory';
import CommitList from './CommitList';
import LoadingSpinner from './LoadingSpinner';
import PaginationControls from './PaginationControls';

export default function CommitHistoryPanel() {
  const { commits, isLoading, error, page, totalPages, setPage } = useCommitHistory();

  return (
    <div className="p-4 border rounded-lg mt-4">
      <h2 className="text-xl font-bold mb-2">Commit History</h2>
      
      {error && <div className="text-red-500">Error: {error}</div>}

      {isLoading && commits.length === 0 ? (
        <LoadingSpinner />
      ) : (
        <>
          <CommitList commits={commits} />
          <PaginationControls
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
} 