'use client';

import React from 'react';
import { useRepositoryConfig } from '@/lib/hooks/useRepositoryConfig';

export default function RepositoryConfigPanel() {
  const { project, isLoading, error } = useRepositoryConfig();

  if (isLoading) {
    return (
      <div className="p-4 border rounded-lg">
        <h2 className="text-xl font-bold mb-2">Repository Configuration</h2>
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border rounded-lg">
        <h2 className="text-xl font-bold mb-2">Repository Configuration</h2>
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-4 border rounded-lg">
        <h2 className="text-xl font-bold mb-2">Repository Configuration</h2>
        <div className="text-gray-500">No project configured</div>
      </div>
    );
  }

  return (
    <div className="p-4 border rounded-lg">
      <h2 className="text-xl font-bold mb-2">Repository Configuration</h2>
      <div className="space-y-2">
        <p><strong>Project Name:</strong> {project.name}</p>
        <p><strong>Repository:</strong> {project.repo_name}</p>
        <p><strong>Provider:</strong> {project.provider}</p>
        <p><strong>Status:</strong> <span className="text-green-600">Configured ✓</span></p>
      </div>
    </div>
  );
} 