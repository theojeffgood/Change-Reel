/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useSession } from 'next-auth/react';
import ConfigPage from '@/app/config/page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
  }),
  useSearchParams: () => ({
    get: () => null,
  }),
}));

jest.mock('next-auth/react');
const mockUseSession = useSession as jest.MockedFunction<typeof useSession>;

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const defaultGitHubStatus = {
  connected: true,
  user: {
    id: 1,
    login: 'octocat',
    name: 'Octo Cat',
    avatar_url: 'https://example.com/avatar.png',
    email: 'octo@example.com',
  },
};

let lastConfigPayload: any = null;

describe('ConfigurationPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    lastConfigPayload = null;

    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
        },
        accessToken: 'mock-access-token',
        expires: '2099-12-31T23:59:59.999Z',
      },
      status: 'authenticated',
      update: jest.fn(),
    });

    mockFetch.mockImplementation((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url === '/api/auth/github/status') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(defaultGitHubStatus),
        });
      }

      if (url === '/api/github/installations') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            installations: [{ id: 1, account: { login: 'acme' } }],
          }),
        });
      }

      if (url.startsWith('/api/github/installation-repos')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            repositories: [
              {
                id: 101,
                name: 'repo-one',
                full_name: 'theo/repo-one',
                description: '',
                private: false,
                html_url: 'https://github.com/theo/repo-one',
                default_branch: 'main',
              },
              {
                id: 102,
                name: 'repo-two',
                full_name: 'theo/repo-two',
                description: '',
                private: false,
                html_url: 'https://github.com/theo/repo-two',
                default_branch: 'main',
              },
            ],
          }),
        });
      }

      if (url === '/api/projects') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            projects: [
              {
                id: 'proj-1',
                repo_name: 'theo/repo-one',
                name: 'theo/repo-one',
                is_tracked: true,
                email_distribution_list: ['team@example.com'],
              },
            ],
          }),
        });
      }

      if (url === '/api/config' && (!init || init.method !== 'POST')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            configuration: {
              repositories: ['theo/repo-one'],
              emailRecipients: ['team@example.com'],
              installationId: 1,
            },
          }),
        });
      }

      if (url === '/api/config' && init?.method === 'POST') {
        if (init.body) {
          try {
            lastConfigPayload = JSON.parse(init.body as string);
          } catch {
            lastConfigPayload = init.body;
          }
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            repositories: Array.isArray(lastConfigPayload?.repositories) ? lastConfigPayload.repositories : [],
          }),
        });
      }

      if (url === '/api/users/me') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: 'user-123' }),
        });
      }

      if (url === '/api/billing/balance') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ balance: 42 }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
  });

  it('renders the configuration header', async () => {
    await act(async () => {
      render(<ConfigPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Choose your Repositories')).toBeInTheDocument();
    });
    expect(screen.getByText('We watch your repos & create plain-English summaries when things change.')).toBeInTheDocument();
  });

  it('submits all selected repositories and emails when saving', async () => {
    await act(async () => {
      render(<ConfigPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('theo/repo-one')).toBeInTheDocument();
    });

    const repoTwoButton = screen.getByRole('button', { name: /theo\/repo-two/i });
    fireEvent.click(repoTwoButton);

    const emailInput = screen.getByPlaceholderText('team@example.com');
    fireEvent.change(emailInput, { target: { value: 'alerts@example.com' } });

    const submitButton = screen.getByRole('button', { name: /see dashboard/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(lastConfigPayload).not.toBeNull();
    });

    expect(lastConfigPayload.repositories).toEqual(expect.arrayContaining(['theo/repo-one', 'theo/repo-two']));
    expect(lastConfigPayload.emailRecipients).toEqual(expect.arrayContaining(['team@example.com', 'alerts@example.com']));
    expect(lastConfigPayload.installationId).toBe(1);
  });
});

