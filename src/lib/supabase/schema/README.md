# Change Reel Database Schema

This document describes the database schema for the Change Reel application, which automatically generates and publishes plain-English summaries of Git commit diffs.

## Overview

The schema is designed to support the MVP requirements while being extensible for post-MVP features like authentication and multi-user support.

## Tables

### Users Table
```sql
users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    github_id VARCHAR(255),
    access_token TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
)
```

**Purpose**: User accounts for post-MVP authentication features.
**MVP Status**: Prepared but not actively used in MVP.
**Relationships**: One-to-many with projects.

### Projects Table
```sql
projects (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    repo_name VARCHAR(255),
    provider VARCHAR(50) NOT NULL DEFAULT 'github',
    webhook_url TEXT,
    email_distribution_list JSONB DEFAULT '[]',
    public_slug VARCHAR(255) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
)
```

**Purpose**: Configuration for each repository/project being tracked.
**MVP Status**: Active - single project configuration.
**Key Fields**:
- `repo_name`: GitHub repository in "owner/repo" format
- `provider`: Support for GitHub, GitLab, Bitbucket (MVP: GitHub only)
- `email_distribution_list`: JSONB array of email addresses for notifications
- `public_slug`: Unique identifier for public changelog URLs

### Commits Table
```sql
commits (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id),
    sha VARCHAR(40) NOT NULL,
    author VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    summary TEXT,
    type VARCHAR(20),
    is_published BOOLEAN DEFAULT FALSE,
    email_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
)
```

**Purpose**: Store commit information and AI-generated summaries.
**MVP Status**: Active - core functionality.
**Key Fields**:
- `sha`: Git commit SHA (supports both short and full hashes)
- `summary`: AI-generated natural language description
- `type`: Categorization (feature, fix, refactor, chore)
- `is_published`: Controls visibility in public changelog
- `email_sent`: Tracks notification status

## Relationships

```
users (1) -----> (*) projects
projects (1) --> (*) commits
```

- Users can have multiple projects (post-MVP)
- Projects can have multiple commits
- MVP uses single project configuration (user_id may be NULL)

## Constraints and Validation

### Projects Table
- `provider` must be one of: 'github', 'gitlab', 'bitbucket'
- `name` cannot be empty or whitespace only
- `public_slug` must be lowercase alphanumeric with hyphens only

### Commits Table
- `type` must be one of: 'feature', 'fix', 'refactor', 'chore' (or NULL)
- `sha` must be valid Git SHA format (7-40 hexadecimal characters)
- `author` cannot be empty
- Unique constraint on (project_id, sha) prevents duplicate commits

## Indexes

### Performance Indexes
- `idx_commits_project_id`: Fast commit lookups by project
- `idx_commits_timestamp`: Chronological ordering
- `idx_commits_published`: Quick filtering of published commits
- `idx_commits_project_published`: Combined project + published + time ordering

### Search Indexes
- `idx_commits_author`: Author-based filtering
- `idx_commits_type`: Type-based filtering
- `idx_projects_public_slug`: Public URL lookups

## Security Features

### Row Level Security (RLS)
- Enabled on all tables for future user-based access control
- MVP uses service role key for full access
- Prepared for post-MVP user-specific policies

### Data Protection
- `access_token` field for encrypted GitHub tokens (post-MVP)
- Automatic `updated_at` timestamp triggers
- Cascade deletes to maintain referential integrity

## Usage Patterns

### MVP Workflows
1. **Webhook Processing**: Insert new commits via project_id
2. **Summary Generation**: Update commit.summary after AI processing
3. **Publishing**: Set is_published = true for changelog visibility
4. **Email Notifications**: Set email_sent = true after successful delivery

### Common Queries
```sql
-- Get published commits for public changelog
SELECT * FROM commits 
WHERE project_id = ? AND is_published = true 
ORDER BY timestamp DESC;

-- Get unprocessed commits for AI summarization
SELECT * FROM commits 
WHERE project_id = ? AND summary IS NULL 
ORDER BY timestamp ASC;

-- Get commits for email digest
SELECT * FROM commits 
WHERE project_id = ? AND is_published = true AND email_sent = false 
ORDER BY timestamp DESC;
```

## Migration Strategy

### Current Version: 001_initial_schema
- Creates all base tables with constraints
- Sets up indexes for performance
- Implements automatic timestamp triggers
- Enables RLS for security

### Future Migrations
- Authentication policies (post-MVP)
- Additional fields based on feature requirements
- Performance optimizations based on usage patterns

## Data Types and Considerations

### UUIDs vs Integers
- Using UUIDs for better scalability and security
- Prevents ID enumeration attacks
- Better for distributed systems

### JSONB for Email Lists
- Flexible storage for variable number of email addresses
- Supports efficient querying and indexing
- Easy to validate and manipulate in application code

### Timestamp Handling
- All timestamps stored with timezone information
- Automatic `updated_at` triggers for audit trails
- `timestamp` field for commit represents Git commit time

## Performance Considerations

### Expected Load (MVP)
- Single project configuration
- Up to 100k commits/month (per PRD)
- Batch processing for email notifications

### Optimization Features
- Composite indexes for common query patterns
- Partial indexes for boolean fields
- Proper foreign key relationships for query optimization

This schema provides a solid foundation for the MVP while being extensible for future features like multi-user support, advanced analytics, and additional Git providers. 