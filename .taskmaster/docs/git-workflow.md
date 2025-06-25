# Git Branching Workflow for Change Reel

## Overview

Each Taskmaster task should be developed on its own feature branch, following a structured branching strategy that keeps work isolated and maintains a clean project history.

## Branch Naming Convention

Use the following pattern for branch names:
```
task/<task-id>-<short-description>
```

**Examples:**
- `task/1-setup-nextjs-tailwind`
- `task/2-configure-supabase`
- `task/4-database-models`
- `task/5-github-webhooks`

## Workflow Steps

### 1. Before Starting a Task

```bash
# Ensure you're on main branch
git checkout main

# Pull latest changes
git pull origin main

# Create and checkout new feature branch
git checkout -b task/<task-id>-<description>

# Mark task as in-progress in Taskmaster
tm set-status <task-id> in-progress
```

### 2. During Development

```bash
# Follow Test-Driven Development approach:
# 1. Write failing test first (where appropriate)
# 2. Implement minimum code to pass test  
# 3. Refactor while keeping tests green

# Run tests in watch mode during development
npm test -- --watch

# Create test files alongside implementation
# Example: src/services/github.ts → src/__tests__/services/github.test.ts

# Make regular commits as you work
git add .
git commit -m "feat: implement X for task <task-id>

- Add specific feature details
- Include unit tests with Y% coverage
- Mock external dependencies properly
- Include any important notes"

# Run full test suite before pushing
npm test
npm run test:coverage

# Verify coverage requirements are met:
# - Business logic services: 90%+ coverage
# - API routes: 85%+ coverage  
# - Overall project: 80%+ coverage

# Push branch to remote (first time)
git push -u origin task/<task-id>-<description>

# Subsequent pushes
git push

# Update taskmaster subtasks as you progress
tm update-subtask <task-id>.<subtask-id> --prompt="Progress update with test results..."
```

### 3. Upon Task Completion

```bash
# Run comprehensive testing before marking complete
npm test
npm run test:coverage

# Verify all tests pass and coverage requirements met
# - No failing tests
# - Coverage thresholds satisfied
# - All business logic properly tested

# Final commit with task completion
git add .
git commit -m "feat: complete task <task-id> - <task-title>

- Implemented all requirements  
- Added comprehensive unit tests (X% coverage)
- All tests passing
- Mocked external dependencies
- Ready for review"

# Push final changes
git push

# Mark task as done in Taskmaster
tm set-status <task-id> done

# Create pull request with testing details
gh pr create --title "Task <task-id>: <task-title>" --body "Completes task <task-id> as defined in Taskmaster

## Testing
- ✅ Unit tests included for all business logic
- ✅ Coverage: X% (meets/exceeds requirements)
- ✅ External dependencies properly mocked
- ✅ All tests passing

## Implementation
- Brief description of key changes
- Any architectural decisions made"
```

### 4. After Review/Approval

```bash
# Switch back to main
git checkout main

# Pull latest (includes merged changes)
git pull origin main

# Delete local feature branch
git branch -d task/<task-id>-<description>

# Delete remote branch (if not auto-deleted by PR merge)
git push origin --delete task/<task-id>-<description>
```

## Quick Reference Commands

```bash
# Start new task
git checkout main && git pull origin main
git checkout -b task/<id>-<desc>
tm set-status <id> in-progress

# Finish task
git add . && git commit -m "feat: complete task <id>"
git push
tm set-status <id> done

# Cleanup after merge
git checkout main && git pull origin main
git branch -d task/<id>-<desc>
```

## Integration with Taskmaster

### Suggested Workflow Enhancement

1. **Use `tm next`** to identify next task
2. **Create branch** following naming convention
3. **Use `tm show <id>`** to get task details
4. **Work on task** with regular commits
5. **Use `tm update-subtask`** to log progress
6. **Push and create PR** when complete
7. **Mark `tm set-status <id> done`** after merge

### Task-Specific Branch Examples

Based on current tasks:
- `task/2-configure-supabase` - Supabase integration setup
- `task/4-database-models` - Database schema and migrations
- `task/5-github-webhooks` - Webhook endpoint implementation
- `task/6-github-api-integration` - Diff retrieval system
- `task/7-openai-integration` - AI summarization features

## Benefits

- **Isolation**: Each task developed independently
- **Review**: Easy code review per feature
- **Rollback**: Simple to revert specific features
- **Collaboration**: Multiple developers can work simultaneously
- **History**: Clean, traceable development history
- **CI/CD**: Each branch can be tested independently

## Best Practices

1. **Keep branches focused** - One task per branch
2. **Regular commits** - Don't wait until task completion
3. **Descriptive messages** - Include task ID and clear description
4. **Update Taskmaster** - Log progress in subtasks
5. **Test before pushing** - Ensure code works before push
6. **Clean up** - Delete merged branches promptly 