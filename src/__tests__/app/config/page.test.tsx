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

    it('should show loading state while fetching repositories', () => {
      // Mock slow repository fetch
      mockFetch.mockImplementationOnce(() => new Promise(resolve => setTimeout(resolve, 1000)));

      render(<ConfigPage />);

      expect(screen.getByText(/loading repositories/i)).toBeInTheDocument();
    });

    it('should handle repository fetch errors', async () => {
      // Mock repository fetch error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ error: 'Insufficient permissions' }),
      });

      render(<ConfigPage />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load repositories/i)).toBeInTheDocument();
      });
    });
  });

  describe('Email Management', () => {
    beforeEach(() => {
      // Mock connected state
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ connected: true, user: mockGitHubAPIResponses.user }),
      });
    });

    it('should add valid email addresses', async () => {
      const user = userEvent.setup();
      
      render(<ConfigPage />);

      const emailInput = screen.getByPlaceholderText(/enter email address/i);
      const addButton = screen.getByText(/add email/i);

      await user.type(emailInput, 'test@example.com');
      await user.click(addButton);

      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    it('should validate email format', async () => {
      const user = userEvent.setup();
      
      render(<ConfigPage />);

      const emailInput = screen.getByPlaceholderText(/enter email address/i);
      const addButton = screen.getByText(/add email/i);

      await user.type(emailInput, 'invalid-email');
      await user.click(addButton);

      expect(screen.getByText(/invalid email format/i)).toBeInTheDocument();
    });

    it('should prevent duplicate email addresses', async () => {
      const user = userEvent.setup();
      
      render(<ConfigPage />);

      const emailInput = screen.getByPlaceholderText(/enter email address/i);
      const addButton = screen.getByText(/add email/i);

      // Add first email
      await user.type(emailInput, 'test@example.com');
      await user.click(addButton);

      // Try to add the same email again
      await user.clear(emailInput);
      await user.type(emailInput, 'test@example.com');
      await user.click(addButton);

      expect(screen.getByText(/email already added/i)).toBeInTheDocument();
    });

    it('should remove email addresses', async () => {
      const user = userEvent.setup();
      
      render(<ConfigPage />);

      const emailInput = screen.getByPlaceholderText(/enter email address/i);
      const addButton = screen.getByText(/add email/i);

      // Add email
      await user.type(emailInput, 'test@example.com');
      await user.click(addButton);

      // Remove email
      const removeButton = screen.getByLabelText(/remove test@example\.com/i);
      await user.click(removeButton);

      expect(screen.queryByText('test@example.com')).not.toBeInTheDocument();
    });
  });

  describe('Connection Testing', () => {
    beforeEach(() => {
      // Mock connected state with selected repository
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

    it('should test OAuth token connection', async () => {
      const user = userEvent.setup();
      
      render(<ConfigPage />);

      await waitFor(() => {
        expect(screen.getByText(/test connection/i)).toBeInTheDocument();
      });

      // Mock successful connection test
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ 
          success: true, 
          message: 'Connection successful',
          permissions: ['repo', 'write:repo_hook']
        }),
      });

      const testButton = screen.getByText(/test connection/i);
      await user.click(testButton);

      await waitFor(() => {
        expect(screen.getByText(/connection successful/i)).toBeInTheDocument();
      });
    });

    it('should show connection test failures', async () => {
      const user = userEvent.setup();
      
      render(<ConfigPage />);

      // Mock failed connection test
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Token expired' }),
      });

      const testButton = await screen.findByText(/test connection/i);
      await user.click(testButton);

      await waitFor(() => {
        expect(screen.getByText(/token expired/i)).toBeInTheDocument();
      });
    });

    it('should validate webhook permissions', async () => {
      const user = userEvent.setup();
      
      render(<ConfigPage />);

      // Mock connection test with limited permissions
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ 
          success: true,
          permissions: ['repo'], // Missing write:repo_hook
          warnings: ['Insufficient permissions for webhooks']
        }),
      });

      const testButton = await screen.findByText(/test connection/i);
      await user.click(testButton);

      await waitFor(() => {
        expect(screen.getByText(/insufficient permissions for webhooks/i)).toBeInTheDocument();
      });
    });
  });

  describe('Toast Notifications', () => {
    beforeEach(() => {
      // Mock connected state
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ connected: true, user: mockGitHubAPIResponses.user }),
      });
    });

    it('should show success toast for successful operations', async () => {
      const user = userEvent.setup();
      
      render(<ConfigPage />);

      // Mock successful configuration save
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const saveButton = await screen.findByText(/save configuration/i);
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/configuration saved successfully/i)).toBeInTheDocument();
      });
    });

    it('should show error toast for failed operations', async () => {
      const user = userEvent.setup();
      
      render(<ConfigPage />);

      // Mock failed operation
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Internal server error' }),
      });

      const saveButton = await screen.findByText(/save configuration/i);
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/internal server error/i)).toBeInTheDocument();
      });
    });

    it('should auto-dismiss toasts after timeout', async () => {
      jest.useFakeTimers();
      
      const user = userEvent.setup();
      
      render(<ConfigPage />);

      // Trigger success toast
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const saveButton = await screen.findByText(/save configuration/i);
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/configuration saved successfully/i)).toBeInTheDocument();
      });

      // Fast-forward past toast timeout
      jest.advanceTimersByTime(6000);

      await waitFor(() => {
        expect(screen.queryByText(/configuration saved successfully/i)).not.toBeInTheDocument();
      });

      jest.useRealTimers();
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      // Mock network error
      mockFetch.mockRejectedValue(new Error('Network error'));

      render(<ConfigPage />);

      await waitFor(() => {
        expect(screen.getByText(/connection error/i)).toBeInTheDocument();
      });
    });

    it('should handle API rate limiting', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: () => Promise.resolve({ 
          error: 'API rate limit exceeded',
          retry_after: 60 
        }),
      });

      render(<ConfigPage />);

      await waitFor(() => {
        expect(screen.getByText(/rate limit exceeded/i)).toBeInTheDocument();
      });
    });

    it('should handle token validation errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Token validation failed' }),
      });

      render(<ConfigPage />);

      await waitFor(() => {
        expect(screen.getByText(/token validation failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<ConfigPage />);

      expect(screen.getByLabelText(/github account connection/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/repository selection/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email recipients/i)).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      
      render(<ConfigPage />);

      // Test Tab navigation
      await user.tab();
      expect(document.activeElement).toHaveAttribute('role', 'button');

      await user.tab();
      expect(document.activeElement).toHaveAttribute('type', 'email');
    });

    it('should announce status changes to screen readers', async () => {
      render(<ConfigPage />);

      await waitFor(() => {
        expect(screen.getByRole('status')).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading spinners during async operations', async () => {
      const user = userEvent.setup();
      
      // Mock slow API response
      mockFetch.mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve({ success: true })
        }), 1000))
      );

      render(<ConfigPage />);

      const saveButton = await screen.findByText(/save configuration/i);
      await user.click(saveButton);

      expect(screen.getByLabelText(/loading/i)).toBeInTheDocument();
    });

    it('should disable buttons during loading', async () => {
      const user = userEvent.setup();
      
      // Mock slow API response
      mockFetch.mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve({ success: true })
        }), 1000))
      );

      render(<ConfigPage />);

      const saveButton = await screen.findByText(/save configuration/i);
      await user.click(saveButton);

      expect(saveButton).toBeDisabled();
    });
  });
}); 