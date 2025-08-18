import React from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import CommitHistoryPanel from './components/CommitHistoryPanel';
import Link from 'next/link';

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Title */}
            <div className="flex items-center space-x-4">
              <Link href="/" className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">📰</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Wins Column</h1>
                </div>
              </Link>
            </div>

            {/* Navigation */}
            <nav className="flex items-center space-x-6">
              <Link 
                href="/config" 
                className="text-gray-600 hover:text-gray-900 transition-colors font-medium"
              >
                Setup
              </Link>
              <Link 
                href="/" 
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <span className="mr-2">🏠</span>
                Home
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header - emphasize summaries */}
        <div className="py-4">

        <div className="flex items-center justify-between"> 
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Recent Product Updates
          </h2>

          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-600">Live Monitoring</span>
            </div>
          </div>
        </div>

        {/* Dashboard Grid - focus on summaries */}
        <div className="grid grid-cols-1 gap-8">
          {/* Main Panel */}
          <div className="space-y-6">
            <ErrorBoundary>
              <CommitHistoryPanel />
            </ErrorBoundary>
          </div>
        </div>
      </main>
    </div>
  );
} 