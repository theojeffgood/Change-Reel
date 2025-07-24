'use client';

import React from 'react';
import { useRepositoryConfig } from '@/lib/hooks/useRepositoryConfig';
import Link from 'next/link';

export default function RepositoryConfigPanel() {
  const { project, isLoading, error } = useRepositoryConfig();

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Newsletter Configuration</h2>
          <div className="w-3 h-3 bg-gray-300 rounded-full animate-pulse"></div>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-24"></div>
            <div className="h-6 bg-gray-200 rounded w-full"></div>
          </div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-32"></div>
            <div className="h-6 bg-gray-200 rounded w-3/4"></div>
          </div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-28"></div>
            <div className="h-20 bg-gray-200 rounded w-full"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Newsletter Configuration</h2>
          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center mr-3">
              <span className="text-red-600 text-lg">⚠️</span>
            </div>
            <div>
              <h3 className="text-sm font-medium text-red-800">Configuration Error</h3>
              <p className="text-sm text-red-600 mt-1">{error}</p>
            </div>
          </div>
          <div className="mt-4">
            <Link 
              href="/config" 
              className="inline-flex items-center px-3 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
            >
              <span className="mr-2">⚙️</span>
              Fix Configuration
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Newsletter Configuration</h2>
          <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
        </div>
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-gray-400 text-2xl">📰</span>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Newsletter Setup</h3>
          <p className="text-gray-600 mb-6">
            Connect your product to start generating automated newsletters with AI-powered summaries.
          </p>
          <Link 
            href="/config" 
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <span className="mr-2">🚀</span>
            Setup Newsletter
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Newsletter Configuration</h2>
        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
      </div>

      <div className="space-y-6">
        {/* Product Information */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Connected Product
          </label>
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-blue-600 text-lg">📦</span>
              </div>
              <div>
                <p className="font-semibold text-gray-900">{project.name}</p>
                <p className="text-sm text-gray-600">
                  {project.provider === 'github' ? 'GitHub Product' : project.provider}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Newsletter Recipients */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Newsletter Recipients
          </label>
          {project.email_distribution_list && project.email_distribution_list.length > 0 ? (
            <div className="space-y-2">
              {project.email_distribution_list.map((email: string, index: number) => (
                <div key={index} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-green-600 text-sm">✉️</span>
                    </div>
                    <span className="text-gray-900 text-sm">{email}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center mr-3">
                  <span className="text-yellow-600 text-lg">📭</span>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-yellow-800">No Recipients Configured</h3>
                  <p className="text-sm text-yellow-600 mt-1">
                    Add email addresses to receive newsletter notifications when product updates are published.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Newsletter Status
          </label>
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600 text-lg">✅</span>
              </div>
              <div>
                <p className="text-sm font-medium text-green-800">Active & Monitoring</p>
                <p className="text-sm text-green-600">
                  Automatically generating newsletters from product updates
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col space-y-3 pt-4 border-t border-gray-200">
          <Link 
            href="/config" 
            className="w-full inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <span className="mr-2">⚙️</span>
            Manage Settings
          </Link>
          
          <button className="w-full inline-flex items-center justify-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium">
            <span className="mr-2">📧</span>
            Send Test Newsletter
          </button>
        </div>
      </div>
    </div>
  );
} 