/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useSession } from 'next-auth/react';
import ConfigPage from '@/app/config/page';

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

// Mock fetch for API calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('ConfigPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default authenticated session (not loading)
    mockUseSession.mockReturnValue({
      data: { 
        user: { 
          id: 'test-user-id',
          email: 'test@example.com' 
        },
        accessToken: 'mock-access-token',
        expires: '2024-12-31T23:59:59.999Z'
      } as any,
      status: 'authenticated',
      update: jest.fn()
    });

    // Mock successful API responses by default
    mockFetch.mockImplementation((url) => {
      if (url === '/api/auth/github/status') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ 
            connected: false, 
            user: null 
          })
        });
      }
      if (url === '/api/config') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ 
            repositories: [],
            emailRecipients: ['test@example.com']
          })
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      });
    });
  });

  it('renders the configuration page', async () => {
    await act(async () => {
      render(<ConfigPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Product Summary Setup')).toBeInTheDocument();
    });
  });

  it('displays GitHub connection status', async () => {
    await act(async () => {
      render(<ConfigPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Connect to Start Your Change Reel')).toBeInTheDocument();
    });
  });

  it('handles loading state correctly', async () => {
    // Test the loading state specifically
    mockUseSession.mockReturnValue({
      data: null,
      status: 'loading',
      update: jest.fn()
    });

    await act(async () => {
      render(<ConfigPage />);
    });

    // Loading state now shows the hero header while session loads
    expect(screen.getByText('Connect your GitHub')).toBeInTheDocument();
  });


  it('handles API errors gracefully', async () => {
    mockFetch.mockImplementation(() => {
      return Promise.reject(new Error('API Error'));
    });

    await act(async () => {
      render(<ConfigPage />);
    });

    // Should still render the page structure despite API errors
    await waitFor(() => {
      expect(screen.getByText('Product Summary Setup')).toBeInTheDocument();
    });
  });
}); 