# Testing Strategy for Change Reel

## Overview

Change Reel follows a comprehensive testing strategy that emphasizes **modular, testable architecture** with **unit tests for all significant functionality**. This approach ensures code reliability, maintainability, and confidence in deployments.

## Testing Philosophy

### Core Principles
1. **Test-Driven Development (TDD)** where appropriate
2. **Unit tests for all business logic** modules
3. **Integration tests for API endpoints** and external service interactions
4. **Modular design** with clear interfaces and dependency injection
5. **Minimum 80% code coverage** for business logic
6. **Mock external dependencies** for isolated testing

### Testing Pyramid Strategy
```
    /\     E2E Tests (Few)
   /  \    
  /    \   Integration Tests (Some)
 /      \  
/__________\ Unit Tests (Many)
```

## Testing Framework Setup

### Core Testing Stack
- **Test Runner**: Jest with TypeScript support
- **Assertion Library**: Jest built-in matchers + custom matchers
- **Mocking**: Jest mocks + MSW (Mock Service Worker) for API mocking
- **Coverage**: Jest coverage reports
- **Component Testing**: React Testing Library (for UI components)

### Configuration Files
```bash
# Package dependencies for testing
npm install --save-dev jest @types/jest ts-jest
npm install --save-dev @testing-library/react @testing-library/jest-dom
npm install --save-dev msw whatwg-fetch
```

## Module Structure for Testability

### Dependency Injection Pattern
```typescript
// Example: Email service with dependency injection
interface EmailProvider {
  send(to: string, subject: string, body: string): Promise<boolean>;
}

class ChangelogEmailService {
  constructor(private emailProvider: EmailProvider) {}
  
  async sendChangelog(recipients: string[], commits: Commit[]): Promise<void> {
    // Business logic here - easily testable
  }
}

// In tests: inject mock email provider
// In production: inject real Resend provider
```

### Service Layer Architecture
```
src/
├── services/           # Business logic (heavily tested)
│   ├── github/        # GitHub API interactions
│   ├── openai/        # AI summarization logic
│   ├── email/         # Email dispatch services
│   └── database/      # Data access layer
├── lib/               # Utility functions (tested)
├── types/             # TypeScript definitions
├── __tests__/         # Test files
└── __mocks__/         # Mock implementations
```

## Testing Requirements by Module

### 1. GitHub Integration (`services/github/`)
**Must Include Tests For:**
- Webhook payload validation
- Commit diff retrieval
- API rate limiting handling
- Error scenarios (network failures, invalid responses)
- Authentication token validation

**Example Test Structure:**
```typescript
describe('GitHubService', () => {
  describe('fetchCommitDiff', () => {
    it('should return formatted diff for valid commit SHA')
    it('should handle API rate limiting with retry')
    it('should throw appropriate error for invalid SHA')
    it('should filter out noise files (package-lock.json)')
  })
})
```

### 2. OpenAI Integration (`services/openai/`)
**Must Include Tests For:**
- Prompt formatting and validation
- Response parsing and error handling
- Token usage optimization
- Fallback mechanisms for API failures
- Content filtering and validation

### 3. Email Services (`services/email/`)
**Must Include Tests For:**
- Template rendering with commit data
- Recipient list validation
- Retry logic for failed sends
- Unsubscribe handling
- Email formatting and HTML generation

### 4. Database Layer (`services/database/`)
**Must Include Tests For:**
- CRUD operations for all models
- Data validation and constraints
- Migration scripts
- Query optimization
- Error handling for database failures

### 5. Webhook Processing (`app/api/webhooks/`)
**Must Include Tests For:**
- Webhook signature verification
- Payload parsing and validation
- Event filtering (push vs other events)
- Asynchronous job queueing
- Error responses and logging

## Test File Organization

### Naming Convention
```
src/services/github/commit-service.ts
src/__tests__/services/github/commit-service.test.ts
```

### Test Structure Template
```typescript
import { CommitService } from '@/services/github/commit-service';
import { MockGitHubAPI } from '@/__mocks__/github-api';

describe('CommitService', () => {
  let commitService: CommitService;
  let mockGitHubAPI: MockGitHubAPI;

  beforeEach(() => {
    mockGitHubAPI = new MockGitHubAPI();
    commitService = new CommitService(mockGitHubAPI);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchCommitDiff', () => {
    it('should successfully fetch and parse commit diff', async () => {
      // Arrange
      const sha = 'abc123';
      const expectedDiff = 'mock diff content';
      mockGitHubAPI.getCommitDiff.mockResolvedValue(expectedDiff);

      // Act
      const result = await commitService.fetchCommitDiff(sha);

      // Assert
      expect(result).toBe(expectedDiff);
      expect(mockGitHubAPI.getCommitDiff).toHaveBeenCalledWith(sha);
    });

    it('should handle network errors gracefully', async () => {
      // Test error scenarios
    });
  });
});
```

## Integration with Development Workflow

### Updated Git Workflow
```bash
# 1. Create feature branch
git checkout -b task/X-feature-name

# 2. Implement feature with tests
# - Write failing test first (TDD approach)
# - Implement minimum code to pass test
# - Refactor while keeping tests green

# 3. Run tests before committing
npm test
npm run test:coverage

# 4. Commit with test validation
git add .
git commit -m "feat: implement feature X with unit tests

- Add FeatureService with dependency injection
- Include comprehensive unit tests (95% coverage)
- Mock external dependencies properly"

# 5. Push branch
git push -u origin task/X-feature-name
```

### Test Commands
```bash
# Run all tests
npm test

# Run tests in watch mode during development
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run tests for specific file/pattern
npm test -- commit-service

# Run tests with verbose output
npm test -- --verbose
```

## Taskmaster Integration

### Updated Task Requirements
Each task involving business logic **must include**:
1. **Test file creation** alongside implementation
2. **Minimum coverage requirements** (80% for business logic)
3. **Mock setup** for external dependencies
4. **Test strategy documentation** in task details
5. **Coverage verification** before marking task complete

### Example Task Test Strategy
```
Task: Implement GitHub Webhook Processing

Test Strategy:
✅ Unit tests for webhook validation
✅ Integration tests for full webhook flow
✅ Mock GitHub API responses
✅ Test error scenarios and edge cases
✅ Verify minimum 85% code coverage
✅ Performance tests for high-volume webhooks
```

## Coverage Requirements

### Minimum Coverage Targets
- **Business Logic Services**: 90%+ coverage
- **API Routes**: 85%+ coverage
- **Utility Functions**: 95%+ coverage
- **Database Models**: 80%+ coverage
- **Overall Project**: 80%+ coverage

### Coverage Enforcement
```bash
# Add to package.json
"jest": {
  "coverageThreshold": {
    "global": {
      "branches": 80,
      "functions": 80,
      "lines": 80,
      "statements": 80
    },
    "./src/services/": {
      "branches": 90,
      "functions": 90,
      "lines": 90,
      "statements": 90
    }
  }
}
```

## Best Practices

### 1. Test Isolation
- Each test should be independent
- Use `beforeEach`/`afterEach` for setup/cleanup
- Mock external dependencies consistently

### 2. Descriptive Test Names
```typescript
// ✅ Good
it('should retry failed email sends up to 3 times before giving up')

// ❌ Bad
it('should handle email errors')
```

### 3. Arrange-Act-Assert Pattern
```typescript
it('should format commit summary correctly', () => {
  // Arrange
  const rawDiff = 'sample diff content';
  const expectedSummary = 'Added user authentication';
  
  // Act
  const result = formatCommitSummary(rawDiff);
  
  // Assert
  expect(result).toBe(expectedSummary);
});
```

### 4. Edge Case Testing
- Always test error conditions
- Test boundary values
- Test empty/null inputs
- Test network failures

This testing strategy ensures that Change Reel is built with **reliability, maintainability, and confidence** from day one. 