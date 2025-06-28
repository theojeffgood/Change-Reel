import React from 'react';
import { render, screen } from '@testing-library/react';
import CommitList from '@/app/admin/components/CommitList';
import { Commit } from '@/lib/types/supabase';

jest.mock('@/app/admin/components/CommitCard', () => {
  return function DummyCommitCard({ commit }: { commit: Commit }) {
    return <div data-testid="commit-card">{commit.summary}</div>;
  };
});

describe('CommitList', () => {
  const mockCommits: Commit[] = [
    {
      id: '1',
      project_id: 'proj-1',
      sha: 'a1b2c3d',
      author: 'Author 1',
      timestamp: new Date().toISOString(),
      summary: 'Summary 1',
      type: 'feature',
      is_published: false,
      email_sent: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: '2',
      project_id: 'proj-1',
      sha: 'd4e5f6g',
      author: 'Author 2',
      timestamp: new Date().toISOString(),
      summary: 'Summary 2',
      type: 'fix',
      is_published: false,
      email_sent: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  it('should render a list of commits', () => {
    render(<CommitList commits={mockCommits} />);
    const commitCards = screen.getAllByTestId('commit-card');
    expect(commitCards).toHaveLength(2);
    expect(screen.getByText('Summary 1')).toBeInTheDocument();
    expect(screen.getByText('Summary 2')).toBeInTheDocument();
  });

  it('should display a message when no commits are provided', () => {
    render(<CommitList commits={[]} />);
    expect(screen.getByText('No commits found.')).toBeInTheDocument();
  });
}); 