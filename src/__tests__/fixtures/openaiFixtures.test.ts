/**
 * OpenAI Fixtures Test
 * 
 * This test file demonstrates how to use the OpenAI fixtures
 * for testing our OpenAI integration services.
 */

import {
  successfulSummaryResponse,
  bugFixSummaryResponse,
  nullContentResponse,
  emptyContentResponse,
  createMockChatCompletion,
  createRateLimitError,
  createAuthenticationError,
  diffScenarios,
  errorScenarios,
  successfulResponses,
  edgeCaseResponses,
} from './openaiFixtures';

function extractFirstContent(response: any): string | null {
  if (!Array.isArray(response?.output)) {
    return null;
  }
  const firstContent = response.output[0]?.content?.[0];
  if (!firstContent) {
    return null;
  }

  if (firstContent.type === 'json_schema') {
    const payload = firstContent.json_schema?.output;
    if (payload && typeof payload === 'object') {
      const summary = (payload as any).summary;
      const changeType = (payload as any).change_type ?? (payload as any).changeType;
      if (typeof summary === 'string') {
        return summary;
      }
      if (typeof changeType === 'string') {
        return changeType;
      }
    }
    return null;
  }

  const text = firstContent.text;
  if (text === null || typeof text !== 'string') {
    return text === null ? null : typeof text === 'string' ? text : null;
  }

  const trimmed = text.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed?.summary === 'string') {
        return parsed.summary;
      }
      if (typeof parsed?.change_type === 'string') {
        return parsed.change_type;
      }
    } catch {}
  }
  return trimmed;
}

describe('OpenAI Fixtures', () => {
  describe('Successful Response Fixtures', () => {
    it('should have valid response structure for summary response', () => {
      expect(successfulSummaryResponse).toHaveProperty('id');
      expect(successfulSummaryResponse).toHaveProperty('object', 'response');
      expect(successfulSummaryResponse).toHaveProperty('output');
      expect(Array.isArray(successfulSummaryResponse.output)).toBe(true);
      const firstText = extractFirstContent(successfulSummaryResponse);
      expect(firstText).toBe(
        'Add user authentication with JWT token validation and secure middleware'
      );
      expect(successfulSummaryResponse).toHaveProperty('output_text');
      expect(successfulSummaryResponse.output_text).toContain('Add user authentication');
    });

    it('should have bug fix response', () => {
      expect(extractFirstContent(bugFixSummaryResponse)).toBe(
        'Fix null pointer exception in user profile validation'
      );
    });

    it('should have usage information', () => {
      expect(successfulSummaryResponse.usage).toHaveProperty('input_tokens');
      expect(successfulSummaryResponse.usage).toHaveProperty('output_tokens');
      expect(successfulSummaryResponse.usage).toHaveProperty('total_tokens');
      expect(successfulSummaryResponse.usage.total_tokens).toBeGreaterThan(0);
    });
  });

  describe('Edge Case Fixtures', () => {
    it('should have null content response', () => {
      expect(extractFirstContent(nullContentResponse)).toBeNull();
    });

    it('should have empty content response', () => {
      expect(extractFirstContent(emptyContentResponse)).toBe('');
    });
  });

  describe('Utility Functions', () => {
    it('should create custom chat completion with overrides', () => {
      const customResponse = createMockChatCompletion({
        content: 'Custom test content',
        model: 'gpt-4.1-mini',
        usage: {
          input_tokens: 100,
          output_tokens: 20,
          total_tokens: 120,
        },
      });

      expect(extractFirstContent(customResponse)).toBe('Custom test content');
      expect(customResponse.model).toBe('gpt-4.1-mini');
      expect(customResponse.usage.input_tokens).toBe(100);
      expect(customResponse.usage.output_tokens).toBe(20);
      expect(customResponse.usage.total_tokens).toBe(120);
    });

    it('should create rate limit error', () => {
      const error = createRateLimitError(30000);
      
      expect(error.status).toBe(429);
      expect(error.message).toContain('Rate limit exceeded');
      expect((error as any).headers?.['retry-after']).toBe('30');
    });

    it('should create authentication error', () => {
      const error = createAuthenticationError();
      
      expect(error.status).toBe(401);
      expect(error.message).toContain('Incorrect API key');
    });
  });

  describe('Scenario-Based Fixtures', () => {
    it('should have diff scenarios with expected responses', () => {
      expect(diffScenarios.newFeature).toHaveProperty('diff');
      expect(diffScenarios.newFeature).toHaveProperty('expectedSummary');
      expect(diffScenarios.newFeature).toHaveProperty('expectedChangeType');
      expect(diffScenarios.newFeature).toHaveProperty('response');
      
      expect(diffScenarios.newFeature.expectedChangeType).toBe('feature');
      expect(diffScenarios.newFeature.diff).toContain('validateUser');
    });

    it('should have bug fix scenario', () => {
      expect(diffScenarios.bugFix.expectedChangeType).toBe('fix');
      expect(diffScenarios.bugFix.diff).toContain('validateUser');
    });

  });

  describe('Error Scenarios', () => {
    it('should have rate limit error scenario', () => {
      expect(errorScenarios.rateLimitExceeded).toHaveProperty('error');
      expect(errorScenarios.rateLimitExceeded).toHaveProperty('expectedBehavior');
      expect(errorScenarios.rateLimitExceeded.error.status).toBe(429);
    });

    it('should have authentication error scenario', () => {
      expect(errorScenarios.authenticationFailed.error.status).toBe(401);
    });

    it('should have token limit error scenario', () => {
      expect(errorScenarios.tokenLimitExceeded.error.status).toBe(400);
      expect(errorScenarios.tokenLimitExceeded.error.message).toContain('context length');
    });
  });

  describe('Organized Exports', () => {
    it('should have successful responses collection', () => {
      expect(successfulResponses).toHaveProperty('summary');
      expect(successfulResponses).toHaveProperty('bugFix');
      expect(successfulResponses).toHaveProperty('complex');
    });

    it('should have edge case responses collection', () => {
      expect(edgeCaseResponses).toHaveProperty('nullContent');
      expect(edgeCaseResponses).toHaveProperty('emptyContent');
      expect(edgeCaseResponses).toHaveProperty('whitespaceContent');
    });
  });

  describe('Real Usage Examples', () => {
    it('should support mocking successful summarization', () => {
      // Example: Mock OpenAI client to return successful summary
      const mockResponse = successfulSummaryResponse;
      
      // Simulate processing the response
      const content = extractFirstContent(mockResponse);
      expect(content).toBeDefined();
      expect(typeof content).toBe('string');
      expect((content as string).length).toBeGreaterThan(0);
    });

    it('should support error handling scenarios', () => {
      // Example: Simulate rate limit error
      const rateLimitError = createRateLimitError(60000);
      
      expect(rateLimitError.status).toBe(429);
      expect((rateLimitError as any).headers?.['retry-after']).toBe('60');
      
      // This is how the error handler would use this information
      const retryAfterSeconds = parseInt((rateLimitError as any).headers?.['retry-after'] || '0');
      expect(retryAfterSeconds).toBe(60);
    });
  });
}); 
