import React from 'react';
import { render, screen } from '@testing-library/react';
import CommitCard from '@/app/admin/components/CommitCard';
import { Commit } from '@/lib/types/supabase';

describe('CommitCard', () => {
  const mockCommit: Commit = {
    id: '1',
    project_id: 'proj-1',
    sha: 'a1b2c3d4e5f6g7h8i9j0',
    author: 'Test Author',
    timestamp: new Date().toISOString(),
    summary: 'This is a test commit summary.',
    type: 'feature',
    is_published: false,
    email_sent: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  it('should render commit details correctly', () => {
    render(<CommitCard commit={mockCommit} />);

    expect(screen.getByText('a1b2c3d')).toBeInTheDocument();
    expect(screen.getByText('Test Author')).toBeInTheDocument();
    expect(screen.getByText('This is a test commit summary.')).toBeInTheDocument();
    expect(screen.getByText('feature')).toBeInTheDocument();
    expect(screen.getByText(new Date(mockCommit.timestamp).toLocaleString())).toBeInTheDocument();
  });
}); 