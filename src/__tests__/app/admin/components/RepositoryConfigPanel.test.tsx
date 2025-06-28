import React from 'react';
import { render, screen } from '@testing-library/react';
import RepositoryConfigPanel from '@/app/admin/components/RepositoryConfigPanel';
import { useRepositoryConfig } from '@/lib/hooks/useRepositoryConfig';

// Mock the hook
jest.mock('@/lib/hooks/useRepositoryConfig');

const mockUseRepositoryConfig = useRepositoryConfig as jest.Mock;

describe('RepositoryConfigPanel', () => {
  it('should display loading spinner when loading', () => {
    mockUseRepositoryConfig.mockReturnValue({
      project: null,
      isLoading: true,
      error: null,
    });

    render(<RepositoryConfigPanel />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should display error message on error', () => {
    mockUseRepositoryConfig.mockReturnValue({
      project: null,
      isLoading: false,
      error: 'Failed to fetch',
    });

    render(<RepositoryConfigPanel />);
    expect(screen.getByText('Error: Failed to fetch')).toBeInTheDocument();
  });

  it('should display message when no project is configured', () => {
    mockUseRepositoryConfig.mockReturnValue({
      project: null,
      isLoading: false,
      error: null,
    });

    render(<RepositoryConfigPanel />);
    expect(screen.getByText('No project configured. Please set one up.')).toBeInTheDocument();
  });

  it('should display project configuration when data is available', () => {
    const mockProject = {
      id: '1',
      name: 'Test Project',
      provider: 'github',
      repo_name: 'test/project',
      email_distribution_list: ['test@example.com'],
      user_id: 'user-1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      webhook_url: 'http://localhost/webhook',
      webhook_secret: 'secret'
    };

    mockUseRepositoryConfig.mockReturnValue({
      project: mockProject,
      isLoading: false,
      error: null,
    });

    render(<RepositoryConfigPanel />);
    expect(screen.getByText('Repository Configuration')).toBeInTheDocument();
    expect(screen.getByText(/Test Project/)).toBeInTheDocument();
    expect(screen.getByText(/github/)).toBeInTheDocument();
    expect(screen.getByText(/test\/project/)).toBeInTheDocument();
  });
}); 