import { 
  WebhookProcessingService, 
  type WebhookProcessingRequest,
  type WebhookProcessingDependencies
} from '@/lib/github/webhook-processing-service';
import { pushEventPayload } from '../../fixtures/webhookFixtures';

// Mock dependencies
const mockSupabaseServices = {
  projects: {
    getProjectByRepository: jest.fn()
  },
  commits: {
    createCommit: jest.fn()
  },
  users: {
    getUserById: jest.fn()
  },
  backup: {
    createBackup: jest.fn()
  }
};

const mockWebhookParser = {
  validatePayload: jest.fn(),
  shouldProcessEvent: jest.fn(),
  parseWebhookPayload: jest.fn()
};

const mockWebhookService = {
  validateWebhookSignature: jest.fn()
};

describe('WebhookProcessingService', () => {
  let service: WebhookProcessingService;
  let dependencies: WebhookProcessingDependencies;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    dependencies = {
      supabaseServices: mockSupabaseServices as any,
      webhookParser: mockWebhookParser as any,
      webhookService: mockWebhookService as any
    };

    service = new WebhookProcessingService(dependencies);
  });

  describe('validateWebhookRequest', () => {
    it('should reject requests with invalid User-Agent', () => {
      const request: WebhookProcessingRequest = {
        event: 'push',
        signature: 'sha256=test',
        delivery: 'test-delivery',
        userAgent: 'Invalid-Agent',
        payload: pushEventPayload,
        rawBody: JSON.stringify(pushEventPayload)
      };

      const result = service.validateWebhookRequest(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('invalid user agent - expected GitHub-Hookshot');
      expect(result.statusCode).toBe(400);
    });

    it('should accept requests with valid GitHub User-Agent', () => {
      mockWebhookParser.validatePayload.mockReturnValue({ valid: true, errors: [] });

      const request: WebhookProcessingRequest = {
        event: 'push',
        signature: 'sha256=test',
        delivery: 'test-delivery',
        userAgent: 'GitHub-Hookshot/abc123',
        payload: pushEventPayload,
        rawBody: JSON.stringify(pushEventPayload)
      };

      const result = service.validateWebhookRequest(request);

      expect(result.success).toBe(true);
      expect(mockWebhookParser.validatePayload).toHaveBeenCalledWith('push', pushEventPayload);
    });

    it('should reject requests with invalid payload structure', () => {
      mockWebhookParser.validatePayload.mockReturnValue({ 
        valid: false, 
        errors: ['Missing repository field', 'Invalid event structure'] 
      });

      const request: WebhookProcessingRequest = {
        event: 'push',
        signature: 'sha256=test',
        delivery: 'test-delivery',
        userAgent: 'GitHub-Hookshot/abc123',
        payload: { invalid: 'payload' },
        rawBody: JSON.stringify({ invalid: 'payload' })
      };

      const result = service.validateWebhookRequest(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing repository field, Invalid event structure');
      expect(result.statusCode).toBe(400);
    });
  });

  describe('processWebhook', () => {
    const validRequest: WebhookProcessingRequest = {
      event: 'push',
      signature: 'sha256=valid-signature',
      delivery: 'test-delivery',
      userAgent: 'GitHub-Hookshot/abc123',
      payload: pushEventPayload,
      rawBody: JSON.stringify(pushEventPayload)
    };

    beforeEach(() => {
      // Setup default successful mocks
      mockWebhookParser.validatePayload.mockReturnValue({ valid: true, errors: [] });
      mockWebhookParser.shouldProcessEvent.mockReturnValue(true);
      mockWebhookParser.parseWebhookPayload.mockReturnValue({
        success: true,
        repository: { full_name: 'testuser/test-repo' },
        commits: [
          {
            sha: 'abc123',
            author_name: 'Test User',
            author_email: 'test@example.com',
            timestamp: '2024-01-01T00:00:00Z',
            message: 'Test commit'
          }
        ]
      });
      mockSupabaseServices.projects.getProjectByRepository.mockResolvedValue({
        data: { id: 'project-1', repository_name: 'testuser/test-repo', webhook_secret: 'secret' },
        error: null
      });
      mockWebhookService.validateWebhookSignature.mockReturnValue(true);
      mockSupabaseServices.commits.createCommit.mockResolvedValue({ data: { id: 'commit-1' }, error: null });
    });

    it('should successfully process a valid webhook', async () => {
      const result = await service.processWebhook(validRequest);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Successfully processed push event');
      expect(result.processed).toBe(1);
      expect(result.statusCode).toBe(200);
    });

    it('should return validation error for invalid request', async () => {
      const invalidRequest = {
        ...validRequest,
        userAgent: 'Invalid-Agent'
      };

      const result = await service.processWebhook(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid webhook request');
      expect(result.error).toBe('invalid user agent - expected GitHub-Hookshot');
      expect(result.statusCode).toBe(400);
    });

    it('should filter out unprocessable events', async () => {
      mockWebhookParser.shouldProcessEvent.mockReturnValue(false);

      const result = await service.processWebhook(validRequest);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Event type 'push' filtered out - not processed");
      expect(result.processed).toBe(0);
      expect(result.statusCode).toBe(200);
    });

    it('should return error for invalid signature', async () => {
      mockWebhookService.validateWebhookSignature.mockReturnValue(false);

      const result = await service.processWebhook(validRequest);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid webhook signature');
      expect(result.error).toBe('invalid signature verification failed');
      expect(result.statusCode).toBe(401);
    });
  });
}); 