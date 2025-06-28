import React from 'react';
import { Commit } from '@/lib/types/supabase';

interface CommitCardProps {
  commit: Commit;
}

export default function CommitCard({ commit }: CommitCardProps) {
  return (
    <div className="p-4 border rounded-lg mb-2">
      <div className="flex justify-between items-center">
        <p className="font-mono text-sm">{commit.sha.substring(0, 7)}</p>
        <span className="text-xs text-gray-500">
          {new Date(commit.timestamp).toLocaleString()}
        </span>
      </div>
      <p className="mt-2">{commit.summary}</p>
      <div className="mt-2 flex items-center">
        <span className="text-sm font-medium">{commit.author}</span>
        <span className="mx-2 text-gray-400">•</span>
        <span className="px-2 py-1 text-xs font-semibold text-blue-800 bg-blue-100 rounded-full">
          {commit.type}
        </span>
      </div>
    </div>
  );
} 