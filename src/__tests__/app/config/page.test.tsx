/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
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
    
    // Setup default authenticated session
    mockUseSession.mockReturnValue({
      data: { 
        user: { 
          id: 'test-user-id',
          name: 'Test User', 
          email: 'test@example.com' 
        },
        expires: '2024-12-31T23:59:59.999Z'
      },
      status: 'authenticated',
      update: jest.fn(),
    });

    // Setup default fetch response
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });

  describe('Basic Rendering', () => {
    it('should render configuration page title', () => {
      render(<ConfigPage />);
      expect(screen.getByText(/repository configuration/i)).toBeInTheDocument();
    });

    it('should render setup guide', () => {
      render(<ConfigPage />);
      expect(screen.getByText(/setup guide/i)).toBeInTheDocument();
    });
  });
}); 