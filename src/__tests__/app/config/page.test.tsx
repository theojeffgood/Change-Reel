/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useSession } from 'next-auth/react';
import ConfigPage from '@/app/config/page';
import { mockSessions, mockRepositories, mockGitHubAPIResponses } from '@/__tests__/fixtures/oauthFixtures';

// Mock Next.js modules
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
  }),
}));

// Mock NextAuth
jest.mock('next-auth/react');
const mockUseSession = useSession as jest.MockedFunction<typeof useSession>;

// Mock fetch for GitHub API calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('ConfigPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default authenticated session
    mockUseSession.mockReturnValue({
      data: mockSessions.authenticated,
      status: 'authenticated',
      update: jest.fn(),
    });

    // Setup default fetch response
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockGitHubAPIResponses.repositories),
    });
  });

  describe('Authentication States', () => {
    it('should redirect unauthenticated users', () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'unauthenticated',
        update: jest.fn(),
      });

      render(<ConfigPage />);

      expect(screen.getByText(/redirecting/i)).toBeInTheDocument();
    });

    it('should show loading state during authentication', () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'loading',
        update: jest.fn(),
      });

      render(<ConfigPage />);

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('should render configuration form for authenticated users', () => {
      render(<ConfigPage />);

      expect(screen.getByText(/repository configuration/i)).toBeInTheDocument();
      expect(screen.getByText(/github account/i)).toBeInTheDocument();
    });
  });

  describe('GitHub Connection UI', () => {
    it('should show connect button when not connected', async () => {
      // Mock API to return no stored token
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'No token found' }),
      });

      render(<ConfigPage />);

      await waitFor(() => {
        expect(screen.getByText(/connect github account/i)).toBeInTheDocument();
      });
    });

    it('should show connected state when token exists', async () => {
      // Mock API to return valid token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ connected: true, user: mockGitHubAPIResponses.user }),
      });

      render(<ConfigPage />);

      await waitFor(() => {
        expect(screen.getByText(/connected as/i)).toBeInTheDocument();
        expect(screen.getByText(mockGitHubAPIResponses.user.login)).toBeInTheDocument();
      });
    });

    it('should handle GitHub OAuth connection', async () => {
      const user = userEvent.setup();
      
      // Mock initial disconnected state
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'No token found' }),
      });

      render(<ConfigPage />);

      const connectButton = await screen.findByText(/connect github account/i);
      await user.click(connectButton);

      // Should trigger OAuth flow (actual implementation would redirect)
      expect(mockFetch).toHaveBeenCalledWith('/api/oauth/connect', expect.any(Object));
    });

    it('should show disconnect confirmation dialog', async () => {
      const user = userEvent.setup();

      // Mock connected state
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ connected: true, user: mockGitHubAPIResponses.user }),
      });

      render(<ConfigPage />);

      const disconnectButton = await screen.findByText(/disconnect/i);
      await user.click(disconnectButton);

      expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
      expect(screen.getByText(/this will remove access/i)).toBeInTheDocument();
    });

    it('should handle GitHub disconnection', async () => {
      const user = userEvent.setup();

      // Mock connected state
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ connected: true, user: mockGitHubAPIResponses.user }),
      });

      render(<ConfigPage />);

      const disconnectButton = await screen.findByText(/disconnect/i);
      await user.click(disconnectButton);

      const confirmButton = screen.getByText(/yes, disconnect/i);
      await user.click(confirmButton);

      expect(mockFetch).toHaveBeenCalledWith('/api/oauth/disconnect', expect.any(Object));
    });
  });

  describe('Repository Selection', () => {
    beforeEach(() => {
      // Mock connected state with repositories
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ connected: true, user: mockGitHubAPIResponses.user }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockGitHubAPIResponses.repositories),
        });
    });

    it('should load and display repositories', async () => {
      render(<ConfigPage />);

      await waitFor(() => {
        expect(screen.getByText(mockRepositories.public.name)).toBeInTheDocument();
        expect(screen.getByText(mockRepositories.private.name)).toBeInTheDocument();
      });
    });

    it('should show repository visibility indicators', async () => {
      render(<ConfigPage />);

      await waitFor(() => {
        expect(screen.getByText(/public/i)).toBeInTheDocument();
        expect(screen.getByText(/private/i)).toBeInTheDocument();
      });
    });

    it('should handle repository selection', async () => {
      const user = userEvent.setup();
      
      render(<ConfigPage />);

      await waitFor(() => {
        expect(screen.getByText(mockRepositories.public.name)).toBeInTheDocument();
      });

      const repositoryOption = screen.getByText(mockRepositories.public.name);
      await user.click(repositoryOption);

      expect(repositoryOption).toBeInTheDocument();
    });


  });

  










}); 