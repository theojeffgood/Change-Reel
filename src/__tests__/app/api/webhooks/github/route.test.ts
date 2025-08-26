/**
 * Tests for GitHub Webhook API endpoint
 * Updated to reflect job queue behavior: the route enqueues a job
 * and does not validate signature or repository directly.
 */

import { POST } from '@/app/api/webhooks/github/route';
import {
  pushEventPayload,
  createWebhookHeaders,
} from '@/__tests__/fixtures/webhookFixtures';

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({})),
}));

// Mock JobQueueService used by the route
jest.mock('@/lib/supabase/services/jobs', () => ({
  JobQueueService: jest.fn(),
}));

// Helper to create a mock NextRequest
function createMockRequest(options: {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}): Request {
  const { headers = {}, body = '' } = options;
  return new Request('http://localhost:3000/api/webhooks/github', {
    method: 'POST',
    headers,
    body,
  });
}

describe('/api/webhooks/github', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { JobQueueService } = require('@/lib/supabase/services/jobs');
    (JobQueueService as jest.Mock).mockImplementation(() => ({
      createJob: jest.fn().mockResolvedValue({ data: { id: 'job-123' }, error: null }),
    }));
  });

  describe('POST method', () => {
    it('queues a job successfully and returns 200', async () => {
      const payloadString = JSON.stringify(pushEventPayload);
      const headers = createWebhookHeaders('push', payloadString, 'test-secret');

      const request = createMockRequest({ headers, body: payloadString });
      const response = await POST(request as any);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.jobId).toBe('job-123');
    });

    it('returns 400 when required headers are missing', async () => {
      const request = createMockRequest({
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(pushEventPayload),
      });

      const response = await POST(request as any);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toContain('missing required headers');
    });

    it('returns 400 for invalid JSON payload', async () => {
      const invalidJson = '{ invalid json }';
      const headers = createWebhookHeaders('push', invalidJson);
      const request = createMockRequest({ headers, body: invalidJson });

      const response = await POST(request as any);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toContain('invalid JSON');
    });

    it('returns 500 when job queueing fails', async () => {
      const { JobQueueService } = require('@/lib/supabase/services/jobs');
      (JobQueueService as jest.Mock).mockImplementation(() => ({
        createJob: jest.fn().mockResolvedValue({ data: null, error: { message: 'Queue down' } }),
      }));

      const payloadString = JSON.stringify(pushEventPayload);
      const headers = createWebhookHeaders('push', payloadString);
      const request = createMockRequest({ headers, body: payloadString });

      const response = await POST(request as any);
      const result = await response.json();

      expect(response.status).toBe(500);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Queue down');
    });
  });
});