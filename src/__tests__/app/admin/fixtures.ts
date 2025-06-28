import { Project, Commit } from '@/lib/types/supabase';

export const mockProject: Project = {
  id: '1',
  name: 'Test Project',
  repo_name: 'test-org/test-repo',
  provider: 'github',
  email_distribution_list: ['test1@example.com', 'test2@example.com'],
  user_id: 'user-123',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const mockCommits: Commit[] = [
  {
    id: 'commit-1',
    project_id: '1',
    sha: 'a1b2c3d4',
    author: 'Test User 1',
    timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    summary: 'feat: Implemented the main feature',
    type: 'feature',
    is_published: true,
    email_sent: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'commit-2',
    project_id: '1',
    sha: 'e5f6g7h8',
    author: 'Test User 2',
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    summary: 'fix: Patched a critical bug',
    type: 'fix',
    is_published: true,
    email_sent: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'commit-3',
    project_id: '1',
    sha: 'i9j0k1l2',
    author: 'Test User 1',
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    summary: 'refactor: Improved performance of the main algorithm',
    type: 'refactor',
    is_published: false,
    email_sent: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
]; 