import React from 'react';
import { Commit } from '@/lib/types/supabase';

interface CommitCardProps {
  commit: Commit;
  hasCredits?: boolean;
  repositoryName?: string;
}

const getUpdateTypeColor = (type: string) => {
  let t = type.toLowerCase();
  if (t === 'fix') t = 'bug fix';
  if (t === 'feature') return 'bg-green-100 text-green-800 border-green-200';
  if (t === 'bug fix') return 'bg-red-100 text-red-800 border-red-200';
  return 'bg-purple-100 text-purple-800 border-purple-200';
};


const getUpdateTypeLabel = (type: string) => {
  let t = type.toLowerCase();
  if (t === 'fix') t = 'bug fix';
  if (t === 'feature') return 'Feature';
  if (t === 'bug fix') return 'Bug fix';
  return 'Update';
};

export default function CommitCard({ commit, hasCredits = false, repositoryName }: CommitCardProps) {
  const dateOnly = new Date(commit.timestamp).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });

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
              <span>At: {dateOnly}</span>
              <span>By: {commit.author}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4">
        {commit.summary ? (
          <div className="">
            {/* <h3 className="text-lg font-semibold text-gray-900 mb-2">What Changed:</h3> */}
            <p className="text-gray-800 leading-relaxed">{commit.summary}</p>
          </div>
        ) : hasCredits ? (
          <div className="text-center">
            <form action={`/api/commits/${commit.id}/queue-summary`} method="post">
              <button
                type="submit"
                className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-lg"
              >
                Create summary →
              </button>
            </form>
          </div>
        ) : (
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
                Create summary →
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 
