import React from 'react';
import RepositoryConfigPanel from './components/RepositoryConfigPanel';
import ErrorBoundary from './components/ErrorBoundary';
import CommitHistoryPanel from './components/CommitHistoryPanel';

export default function AdminPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
      <ErrorBoundary>
        <RepositoryConfigPanel />
        <CommitHistoryPanel />
      </ErrorBoundary>
      {/* Other admin components will go here */}
    </div>
  );
} 