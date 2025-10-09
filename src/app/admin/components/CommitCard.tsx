import React from 'react';
import { Commit } from '@/lib/types/supabase';

interface CommitCardProps {
  commit: Commit;
  repositoryName?: string;
}

const getUpdateTypeColor = (type: string) => {
  const t = type.toLowerCase();
  if (t === 'feature') return 'bg-green-100 text-green-800 border-green-200';
  if (t === 'bugfix' || t === 'bug fix' || t === 'fix') return 'bg-red-100 text-red-800 border-red-200';
  return 'bg-purple-100 text-purple-800 border-purple-200';
};


const getUpdateTypeLabel = (type: string) => {
  const t = type.toLowerCase();
  if (t === 'feature') return 'Feature';
  if (t === 'bugfix' || t === 'bug fix' || t === 'fix') return 'Bugfix';
  return 'Update';
};

export default function CommitCard({ commit, repositoryName }: CommitCardProps) {
  const dateOnly = new Date(commit.timestamp).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });

  // Check if this commit failed due to insufficient credits
  const failedDueToInsufficientCredits = !commit.summary && (commit as any).failed_job;
  
  // Check if this commit is currently being processed
  const isProcessing = !commit.summary && (commit as any).processing;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="mb-2 flex items-start gap-3">
            <span className={`inline-flex px-2 py-3 text-xs font-medium rounded border ${getUpdateTypeColor(commit.type || 'unknown')}`}>
              {getUpdateTypeLabel(commit.type || 'unknown')}
            </span>
            <div className="flex flex-col text-sm text-gray-600 leading-tight">
              <span>Repo: {repositoryName || '—'}</span>
              <span>By: {commit.author}</span>
            </div>
          </div>
        </div>
        <div className="text-sm text-gray-500 whitespace-nowrap">{dateOnly}</div>
      </div>

      <div className="mb-4">
        {commit.summary ? (
          <div className="">
            <p className="text-gray-800 leading-relaxed">{commit.summary}</p>
          </div>
        ) : isProcessing ? (
          <div className="bg-blue-50 rounded-lg p-8 border border-blue-200">
            <div className="flex items-center justify-center space-x-3">
              <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-lg text-blue-800 font-medium">Generating summary...</p>
            </div>
          </div>
        ) : failedDueToInsufficientCredits ? (
          <div className="bg-yellow-50 rounded-lg p-8 border border-yellow-200">
            <p className="text-xl text-yellow-800 text-center font-medium">Not Enough Credits</p>
            <p className="text-lg text-yellow-700 text-center mt-2">
              Add credits to create a new summary.
            </p>
            <div className="mt-3 text-center">
              <a
                href="/billing"
                className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-lg"
              >
                Create Summary →
              </a>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
} 
