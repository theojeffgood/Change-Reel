'use client';

import React from 'react';
import { useRepositoryConfig } from '@/lib/hooks/useRepositoryConfig';
import LoadingSpinner from './LoadingSpinner';

export default function RepositoryConfigPanel() {
  const { project, isLoading, error } = useRepositoryConfig();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  if (!project) {
    return <div>No project configured. Please set one up.</div>;
  }

  return (
    <div className="p-4 border rounded-lg">
      <h2 className="text-xl font-bold mb-2">Repository Configuration</h2>
      <p>
        <strong>Project Name:</strong> {project.name}
      </p>
      <p>
        <strong>Repository:</strong> {project.repo_name}
      </p>
      <p>
        <strong>Provider:</strong> {project.provider}
      </p>
    </div>
  );
} 