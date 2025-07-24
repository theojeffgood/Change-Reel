import React from 'react';
import RepositoryConfigPanel from './components/RepositoryConfigPanel';
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
                  <h1 className="text-xl font-bold text-gray-900">Change Reel</h1>
                  <p className="text-xs text-gray-500">Newsletter Dashboard</p>
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
              <a 
                href="#" 
                className="text-gray-600 hover:text-gray-900 transition-colors font-medium"
              >
                Analytics
              </a>
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
        {/* Page Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Product Newsletter Dashboard
          </h2>
          <p className="text-lg text-gray-600">
            Monitor your automated newsletters and product update communications
          </p>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Panel */}
          <div className="lg:col-span-2 space-y-6">
            <ErrorBoundary>
              <CommitHistoryPanel />
            </ErrorBoundary>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            <ErrorBoundary>
              <RepositoryConfigPanel />
            </ErrorBoundary>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <Link 
                  href="/config" 
                  className="w-full inline-flex items-center px-4 py-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <span className="mr-3">⚙️</span>
                  <div className="text-left">
                    <div className="font-medium">Newsletter Settings</div>
                    <div className="text-sm text-blue-600">Manage recipients and preferences</div>
                  </div>
                </Link>
                
                <button className="w-full inline-flex items-center px-4 py-3 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors">
                  <span className="mr-3">📧</span>
                  <div className="text-left">
                    <div className="font-medium">Send Test Newsletter</div>
                    <div className="text-sm text-green-600">Preview your newsletter format</div>
                  </div>
                </button>

                <button className="w-full inline-flex items-center px-4 py-3 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors">
                  <span className="mr-3">📊</span>
                  <div className="text-left">
                    <div className="font-medium">View Analytics</div>
                    <div className="text-sm text-purple-600">See engagement metrics</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Newsletter Stats */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Newsletter Performance</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Updates This Month</span>
                  <span className="font-semibold text-gray-900">12</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Active Recipients</span>
                  <span className="font-semibold text-gray-900">8</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Open Rate</span>
                  <span className="font-semibold text-green-600">78%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Last Newsletter</span>
                  <span className="font-semibold text-gray-900">2 hours ago</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 