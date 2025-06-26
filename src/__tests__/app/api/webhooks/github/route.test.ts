/**
 * Tests for GitHub Webhook API endpoint
 * 
 * Tests the /api/webhooks/github endpoint that receives and processes
 * GitHub webhook events for commit notifications.
 */

import { POST } from '@/app/api/webhooks/github/route';
import {
  pushEventPayload,
  createWebhookHeaders,
} from '@/__tests__/fixtures/webhookFixtures';

// Mock the webhook service
jest.mock('@/lib/github/webhook-service', () => ({
  GitHubWebhookService: {
    validateWebhookSignature: jest.fn(),
  },
}));

// Mock the database services
jest.mock('@/lib/supabase/services', () => ({
  createSupabaseServices: jest.fn(),
}));

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

import { GitHubWebhookService } from '@/lib/github/webhook-service';
import { createSupabaseServices } from '@/lib/supabase/services';

const mockValidateWebhookSignature = GitHubWebhookService.validateWebhookSignature as jest.MockedFunction<typeof GitHubWebhookService.validateWebhookSignature>;
const mockCreateSupabaseServices = createSupabaseServices as jest.MockedFunction<typeof createSupabaseServices>;

// Mock services instances
const mockCommitService = {
  createCommit: jest.fn(),
  updateCommit: jest.fn(),
  getCommitsByProject: jest.fn(),
  getCommit: jest.fn(),
  getCommitBySha: jest.fn(),
  deleteCommit: jest.fn(),
  listCommits: jest.fn(),
  getPublishedCommits: jest.fn(),
  getUnprocessedCommits: jest.fn(),
  getCommitsForEmail: jest.fn(),
  markCommitAsEmailSent: jest.fn(),
  publishCommit: jest.fn(),
  unpublishCommit: jest.fn(),
  getCommitsByAuthor: jest.fn(),
  getCommitsByType: jest.fn(),
  getCommitsByDateRange: jest.fn(),
};

const mockProjectService = {
  getProject: jest.fn(),
  getProjectBySlug: jest.fn(),
  getProjectByRepository: jest.fn(),
  createProject: jest.fn(),
  updateProject: jest.fn(),
  deleteProject: jest.fn(),
  listProjects: jest.fn(),
  getProjectsByUser: jest.fn(),
};

// Helper function to create a mock NextRequest
function createMockRequest(options: {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}): Request {
  const { headers = {}, body = '' } = options;
  
  return new Request('http://localhost:3000/api/webhooks/github', {
    method: 'POST',
    headers: headers,
    body: body,
  });
}

describe('/api/webhooks/github', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up default mock implementations
    mockValidateWebhookSignature.mockReturnValue(true);
    
    mockCreateSupabaseServices.mockReturnValue({
      commits: mockCommitService,
      projects: mockProjectService,
      users: {} as any,
      backup: {} as any,
    });
    
    mockProjectService.getProjectByRepository.mockResolvedValue({
      data: {
        id: 'project-123',
        name: 'test-repo',
        user_id: 'user-123',
        provider: 'github',
        repo_name: 'testuser/test-repo',
        webhook_secret: 'test-secret',
        email_distribution_list: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      error: null,
    });
  });

  describe('POST method', () => {
    it('should successfully process a valid push webhook', async () => {
      const payloadString = JSON.stringify(pushEventPayload);
      const headers = createWebhookHeaders('push', payloadString, 'test-secret');
      
      mockCommitService.createCommit.mockResolvedValue({ 
        data: { id: 'commit-123' },
        error: null 
      });
      
      const request = createMockRequest({
        headers,
        body: payloadString,
      });

      const response = await POST(request as any);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(mockValidateWebhookSignature).toHaveBeenCalledWith(
        payloadString,
        headers['x-hub-signature-256'],
        'test-secret'
      );
    });

    it('should reject webhook with invalid signature', async () => {
      const payloadString = JSON.stringify(pushEventPayload);
      const headers = {
        ...createWebhookHeaders('push', payloadString, 'test-secret'),
        'x-hub-signature-256': 'sha256=invalid_signature'
      };
      
      mockValidateWebhookSignature.mockReturnValue(false);

      const request = createMockRequest({
        headers,
        body: payloadString,
      });

      const response = await POST(request as any);
      const result = await response.json();

      expect(response.status).toBe(401);
      expect(result.success).toBe(false);
      expect(result.error).toContain('invalid signature');
    });

    it('should handle missing required headers', async () => {
      const request = createMockRequest({
        headers: {
          'content-type': 'application/json'
          // Missing x-github-event and x-hub-signature-256
        },
        body: JSON.stringify(pushEventPayload),
      });

      const response = await POST(request as any);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toContain('missing required headers');
    });

    it('should handle malformed JSON payload', async () => {
      const invalidJson = '{ invalid json }';
      const headers = createWebhookHeaders('push', invalidJson);

      const request = createMockRequest({
        headers,
        body: invalidJson,
      });

      const response = await POST(request as any);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toContain('invalid JSON');
    });

    it('should validate GitHub User-Agent header', async () => {
      const payloadString = JSON.stringify(pushEventPayload);
      const headers = {
        ...createWebhookHeaders('push', payloadString),
        'user-agent': 'NotGitHub/1.0'
      };

      const request = createMockRequest({
        headers,
        body: payloadString,
      });

      const response = await POST(request as any);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toContain('invalid user agent');
    });

    it('should handle repository not found in configuration', async () => {
      const payloadString = JSON.stringify(pushEventPayload);
      const headers = createWebhookHeaders('push', payloadString);
      
      mockProjectService.getProjectByRepository.mockResolvedValue({
        data: null,
        error: new Error('Not found'),
      });

      const request = createMockRequest({
        headers,
        body: payloadString,
      });

      const response = await POST(request as any);
      const result = await response.json();

      expect(response.status).toBe(404);
      expect(result.success).toBe(false);
      expect(result.error).toContain('repository not configured');
    });
  });

  describe('Error handling', () => {
    it('should handle database errors gracefully', async () => {
      const payloadString = JSON.stringify(pushEventPayload);
      const headers = createWebhookHeaders('push', payloadString);
      
      mockCommitService.createCommit.mockRejectedValue(new Error('Database connection failed'));

      const request = createMockRequest({
        headers,
        body: payloadString,
      });

      const response = await POST(request as any);
      const result = await response.json();

      expect(response.status).toBe(500);
      expect(result.success).toBe(false);
      expect(result.error).toContain('processing failed');
    });
  });
}); 