import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import AdminPage from '@/app/admin/page';
import { useRepositoryConfig } from '@/lib/hooks/useRepositoryConfig';
import { useCommitHistory } from '@/lib/hooks/useCommitHistory';
import { mockProject, mockCommits } from './fixtures';

// Mock the hooks
jest.mock('@/lib/hooks/useRepositoryConfig');
jest.mock('@/lib/hooks/useCommitHistory');

const mockUseRepositoryConfig = useRepositoryConfig as jest.Mock;
const mockUseCommitHistory = useCommitHistory as jest.Mock;

describe.skip('AdminPage Integration', () => {
  beforeEach(() => {
    // Reset mocks before each test
    mockUseRepositoryConfig.mockClear();
    mockUseCommitHistory.mockClear();
  });

  it('should render repository config and commit history correctly', async () => {
    // Arrange: Set up mock return values for the hooks
    mockUseRepositoryConfig.mockReturnValue({
      project: mockProject,
      isLoading: false,
      error: null,
    });

    mockUseCommitHistory.mockReturnValue({
      commits: mockCommits,
      isLoading: false,
      error: null,
      totalCount: mockCommits.length,
      loadMoreCommits: jest.fn(),
    });

    // Act
    render(<AdminPage />);

    // Assert
    // Check if the repository config panel is rendered with correct data
    await waitFor(() => {
      expect(screen.getByText('Product Timeline')).toBeInTheDocument();
      expect(screen.getByText('Live Monitoring')).toBeInTheDocument();
    });

    // Check if the commit history panel is rendered with correct data
    await waitFor(() => {
      // Check for a few commit summaries to ensure the list is rendered
      expect(screen.getByText(/Implemented the main feature/)).toBeInTheDocument();
      expect(screen.getByText(/Patched a critical bug/)).toBeInTheDocument();
      expect(screen.getByText(/Improved performance/)).toBeInTheDocument();
    });
  });
}); 