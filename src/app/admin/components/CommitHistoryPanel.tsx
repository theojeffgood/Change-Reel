'use client';

import React from 'react';
import { useCommitHistory } from '@/lib/hooks/useCommitHistory';
import CommitCard from './CommitCard';
import LoadingSpinner from './LoadingSpinner';
import PaginationControls from './PaginationControls';

interface CommitHistoryPanelProps {
  repositoryName?: string;
  initialInstallationIds?: number[];
}

export default function CommitHistoryPanel({ repositoryName, initialInstallationIds = [] }: CommitHistoryPanelProps) {
  const { commits, isLoading, error, page, totalPages, setPage } = useCommitHistory(10, initialInstallationIds);

  return (
      <div>
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center mr-3">
                <span className="text-red-600 text-lg">⚠️</span>
              </div>
              <div>
                <h3 className="text-sm font-medium text-red-800">Unable to Load Updates</h3>
                <p className="text-sm text-red-600 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <LoadingSpinner text="Loading your product updates..." />
        ) : commits && commits.length > 0 ? (
          <>
            <div className="space-y-4">
              {commits.map((commit: any) => (
                <CommitCard
                  key={commit.id}
                  commit={commit}
                  repositoryName={(commit as any).repository_name || repositoryName}
                />
              ))}
            </div>
            {totalPages > 1 && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <PaginationControls
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                />
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-gray-400 text-2xl">📰</span>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Updates Yet</h3>
            <p className="text-gray-600 max-w-sm mx-auto">
              Product updates will appear here once new features, fixes, or improvements are detected and processed into newsletter content.
            </p>
            <div className="mt-6">
              <div className="inline-flex items-center px-4 py-2 bg-blue-50 text-blue-700 rounded-lg">
                <span className="mr-2">💡</span>
                <span className="text-sm font-medium">Tip: Make a change to your product to see your first newsletter update!</span>
              </div>
            </div>
          </div>
        )}
      </div>
  );
} 