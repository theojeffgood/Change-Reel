'use client';

import React from 'react';
import { useCommitHistory } from '@/lib/hooks/useCommitHistory';
import CommitList from './CommitList';
import LoadingSpinner from './LoadingSpinner';
import PaginationControls from './PaginationControls';

export default function CommitHistoryPanel() {
  const { commits, isLoading, error, page, totalPages, setPage } = useCommitHistory();

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Recent Product Updates</h2>
            <p className="text-sm text-gray-600 mt-1">AI-generated newsletter content from your latest product changes</p>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm text-gray-600">Live Monitoring</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
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
        ) : (
          <>
            {commits && commits.length > 0 ? (
              <>
                <CommitList commits={commits} />
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
          </>
        )}
      </div>
    </div>
  );
} 