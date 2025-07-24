import React from 'react';
import { Commit } from '@/lib/types/supabase';

interface CommitCardProps {
  commit: Commit;
}

const getUpdateTypeColor = (type: string) => {
  switch (type.toLowerCase()) {
    case 'feature':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'fix':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'refactor':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'chore':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    default:
      return 'bg-purple-100 text-purple-800 border-purple-200';
  }
};

const getUpdateTypeIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case 'feature':
      return '🚀';
    case 'fix':
      return '🔧';
    case 'refactor':
      return '⚡';
    case 'chore':
      return '🔧';
    default:
      return '📝';
  }
};

const getUpdateTypeLabel = (type: string) => {
  switch (type.toLowerCase()) {
    case 'feature':
      return 'New Feature';
    case 'fix':
      return 'Bug Fix';
    case 'refactor':
      return 'Improvement';
    case 'chore':
      return 'Maintenance';
    default:
      return 'Update';
  }
};

export default function CommitCard({ commit }: CommitCardProps) {
  const timeAgo = new Date(commit.timestamp).toLocaleString();

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
            <span className="text-lg">{getUpdateTypeIcon(commit.type || 'unknown')}</span>
          </div>
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded border ${getUpdateTypeColor(commit.type || 'unknown')}`}>
                <span className="mr-1">{getUpdateTypeIcon(commit.type || 'unknown')}</span>
                {getUpdateTypeLabel(commit.type || 'unknown')}
              </span>
            </div>
            <p className="text-sm text-gray-600">
              By {commit.author} • {timeAgo}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
            commit.summary ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
          }`}>
            {commit.summary ? '📰 Newsletter Ready' : '⏳ Processing'}
          </span>
        </div>
      </div>

      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Newsletter Content</h3>
        {commit.summary ? (
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <p className="text-gray-800 leading-relaxed">{commit.summary}</p>
          </div>
        ) : (
          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
            <div className="flex items-center">
              <div className="animate-spin w-5 h-5 border-2 border-yellow-600 border-t-transparent rounded-full mr-3"></div>
              <p className="text-yellow-800 font-medium">Generating newsletter content...</p>
            </div>
            <p className="text-yellow-700 text-sm mt-2">
              Our AI is analyzing this product update to create clear, business-focused newsletter content.
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 text-xs">#</span>
            </div>
            <span className="text-sm text-gray-600 font-mono">{commit.sha?.substring(0, 7)}</span>
          </div>
          
          {commit.is_published && (
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600 text-xs">✓</span>
              </div>
              <span className="text-sm text-green-700 font-medium">Published</span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <button className="inline-flex items-center px-3 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors">
            <span className="mr-1">📧</span>
            Include in Newsletter
          </button>
          
          <button className="inline-flex items-center px-3 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors">
            <span className="mr-1">✏️</span>
            Edit Content
          </button>
        </div>
      </div>
    </div>
  );
} 