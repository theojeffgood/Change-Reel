# Data Integrity Investigation: Invalid SHAs in Database

## The Problem

```
❌ Error: No common ancestor between:
   Base SHA:  c5c9ea85c587a25046f815cda8434e8fa00b536f
   Head SHA:  401951fd91a3e8d32dcaa63333133411c4dd7978
   
   Both SHAs do NOT exist in the GitHub repository
```

## Impact

- ❌ `fetch_diff` job fails
- ❌ Cascades to `generate_summary` job failure: "No diff content available"
- ❌ No commit summaries generated
- ❌ Invalid data pollutes the database
- ⚠️ Questions: How did invalid data get in?

---

## Root Cause: Where Did These SHAs Come From?

### Most Likely Sources (Priority Order)

**1. Webhook Payload Parsing Error (60% probability)**
- Webhook payload malformed or incomplete
- Parser extracted wrong fields
- Commit data truncated or corrupted

**2. GitHub API Response Issue (20% probability)**
- GitHub API returned incomplete commit data
- Rate limiting caused partial response
- Network error interrupted response

**3. Manual/Direct Database Insert (10% probability)**
- Someone inserted data manually without validation
- Migration script had a bug
- Backfill operation used wrong data

**4. Database Corruption (10% probability)**
- Data was corrupted in transit
- Character encoding issue
- Storage/retrieval mismatch

---

## Investigation Steps

### Step 1: Find All Jobs with These Invalid SHAs

```sql
-- Find jobs with the invalid SHAs
SELECT 
  j.id,
  j.type,
  j.status,
  j.error_message,
  j.data->>'base_sha' as base_sha,
  j.data->>'head_sha' as head_sha,
  j.data->>'commit_id' as commit_id,
  j.created_at,
  c.sha as stored_commit_sha
FROM jobs j
LEFT JOIN commits c ON j.data->>'commit_id' = c.id::text
WHERE (
  j.data->>'base_sha' = 'c5c9ea85c587a25046f815cda8434e8fa00b536f'
  OR j.data->>'head_sha' = 'c5c9ea85c587a25046f815cda8434e8fa00b536f'
  OR j.data->>'base_sha' = '401951fd91a3e8d32dcaa63333133411c4dd7978'
  OR j.data->>'head_sha' = '401951fd91a3e8d32dcaa63333133411c4dd7978'
);
```

**What to look for:**
- How many jobs have these SHAs?
- Are they from the same commit?
- Are they from the same project?
- When were they created?

---

### Step 2: Find All Invalid SHAs in the System

```sql
-- Find all commits with potentially invalid SHAs
-- (SHAs that are referenced but may not exist in GitHub)

SELECT 
  COUNT(*) as total_commits,
  COUNT(DISTINCT project_id) as affected_projects,
  MIN(created_at) as oldest_commit,
  MAX(created_at) as newest_commit
FROM commits
WHERE LENGTH(sha) != 40 AND LENGTH(sha) != 7
   OR sha IS NULL
   OR sha = ''
   OR sha ~ '[^a-f0-9]';

-- More detailed: get the actual invalid commits
SELECT 
  id,
  project_id,
  sha,
  author,
  created_at,
  LENGTH(sha) as sha_length,
  CASE 
    WHEN sha IS NULL THEN 'NULL'
    WHEN sha = '' THEN 'EMPTY'
    WHEN LENGTH(sha) != 40 AND LENGTH(sha) != 7 THEN 'WRONG_LENGTH'
    WHEN sha ~ '[^a-f0-9]' THEN 'INVALID_CHARS'
    ELSE 'UNKNOWN'
  END as issue_type
FROM commits
WHERE LENGTH(sha) != 40 AND LENGTH(sha) != 7
   OR sha IS NULL
   OR sha = ''
   OR sha ~ '[^a-f0-9]'
LIMIT 100;
```

**What to look for:**
- How many invalid SHAs exist?
- Are they pattern (e.g., all same format)?
- When were they created?
- What projects do they belong to?

---

### Step 3: Check Webhook Processing History

```sql
-- Find webhook processing jobs to see if payload parsing failed
SELECT 
  j.id,
  j.type,
  j.status,
  j.error_message,
  j.data->>'repository' as repository,
  j.data->>'branch' as branch,
  j.context->>'webhook_source' as webhook_source,
  j.created_at,
  CASE 
    WHEN j.status = 'failed' THEN 'FAILED'
    WHEN j.status = 'completed' THEN 'OK'
    ELSE j.status
  END as result
FROM jobs j
WHERE j.type = 'webhook_processing'::job_type
AND j.created_at > NOW() - INTERVAL '7 days'
ORDER BY j.created_at DESC
LIMIT 50;
```

**What to look for:**
- Are webhook_processing jobs failing?
- Are they completing with bad data?
- Pattern of errors?

---

### Step 4: Trace from Failed fetch_diff to Source

```sql
-- Trace back from the failed fetch_diff job to find its source
WITH failed_fetch_diff AS (
  SELECT 
    j.id,
    j.data,
    j.commit_id,
    j.project_id,
    j.created_at,
    j.error_message
  FROM jobs j
  WHERE j.type = 'fetch_diff'::job_type
  AND j.status = 'failed'
  AND j.error_message LIKE '%No common ancestor%'
  ORDER BY j.created_at DESC
  LIMIT 10
),
dependencies AS (
  SELECT 
    dj.job_id,
    dj.depends_on_job_id,
    j.type as dependency_type,
    j.status as dependency_status,
    j.data as dependency_data
  FROM job_dependencies dj
  JOIN jobs j ON dj.depends_on_job_id = j.id
  WHERE dj.job_id IN (SELECT id FROM failed_fetch_diff)
)
SELECT 
  ffd.id as fetch_diff_job_id,
  ffd.error_message,
  ffd.created_at,
  dep.dependency_type,
  dep.dependency_status,
  ffd.data->>'base_sha' as base_sha_stored,
  ffd.data->>'head_sha' as head_sha_stored,
  dep.dependency_data->>'branch' as webhook_branch,
  dep.dependency_data->>'repository' as webhook_repo
FROM failed_fetch_diff ffd
LEFT JOIN dependencies dep ON dep.job_id = ffd.id;
```

**What to look for:**
- Did webhook_processing create the jobs?
- What branch/repo info was in the webhook?
- When did the invalid data originate?

---

### Step 5: Check Commit Records

```sql
-- Get the commit records associated with these SHAs
SELECT 
  c.id,
  c.project_id,
  c.sha,
  c.author,
  c.timestamp,
  c.summary,
  c.created_at,
  p.repo_name,
  p.name as project_name
FROM commits c
JOIN projects p ON c.project_id = p.id
WHERE c.sha IN (
  'c5c9ea85c587a25046f815cda8434e8fa00b536f',
  '401951fd91a3e8d32dcaa63333133411c4dd7978'
);

-- Also check if these SHAs exist anywhere in the database
SELECT 
  'commits' as table_name,
  COUNT(*) as count
FROM commits
WHERE sha IN (
  'c5c9ea85c587a25046f815cda8434e8fa00b536f',
  '401951fd91a3e8d32dcaa63333133411c4dd7978'
)

UNION ALL

SELECT 
  'jobs' as table_name,
  COUNT(*) as count
FROM jobs
WHERE data->>'base_sha' IN (
  'c5c9ea85c587a25046f815cda8434e8fa00b536f',
  '401951fd91a3e8d32dcaa63333133411c4dd7978'
)
OR data->>'head_sha' IN (
  'c5c9ea85c587a25046f815cda8434e8fa00b536f',
  '401951fd91a3e8d32dcaa63333133411c4dd7978'
);
```

**What to look for:**
- Do these SHAs exist in the commits table?
- How many places reference them?
- What project do they belong to?

---

### Step 6: Validate Against GitHub

```bash
# Use GitHub API to check if these SHAs exist in the repo
# Replace OWNER/REPO and SHAs with actual values

# Check if base SHA exists
curl -s \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Authorization: token YOUR_GITHUB_TOKEN" \
  https://api.github.com/repos/OWNER/REPO/commits/c5c9ea85c587a25046f815cda8434e8fa00b536f | jq .

# Check if head SHA exists
curl -s \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Authorization: token YOUR_GITHUB_TOKEN" \
  https://api.github.com/repos/OWNER/REPO/commits/401951fd91a3e8d32dcaa63333133411c4dd7978 | jq .

# Both should return 200 with commit data, NOT 404
```

**What to look for:**
- HTTP 404 = SHA doesn't exist
- HTTP 200 = SHA exists in GitHub
- If 404, confirms data integrity issue

---

### Step 7: Check for Webhook Parsing Issues

```typescript
// Check the webhook payload parsing logic
// File: src/lib/github/webhook-parser.ts

// Look for:
// 1. Are SHAs being extracted correctly?
// 2. Is there validation before storing?
// 3. Are commits being created with truncated data?

// Common issues to look for:
// - commits[].id vs commits[].sha (which one is used?)
// - Substring operations that truncate SHAs
// - Missing null/undefined checks
// - Character encoding issues
```

---

## Root Cause Scenarios

### Scenario A: Webhook Payload Malformed

**Signs:**
- webhook_processing jobs completed but stored bad data
- SHAs are truncated or have strange patterns
- All bad SHAs from same project/time period

**Evidence SQL:**
```sql
SELECT * FROM jobs 
WHERE type = 'webhook_processing'::job_type
AND created_at > NOW() - INTERVAL '1 day'
AND status = 'completed'
AND (
  data->>'commits' IS NULL 
  OR data->>'commits' = '[]'
);
```

**Fix:**
1. Check webhook payload in GitHub repository settings
2. Verify webhook is sending correct headers
3. Test webhook with GitHub's test functionality
4. Check `webhook-parser.ts` for parsing bugs

---

### Scenario B: GitHub API Rate Limiting

**Signs:**
- webhook_processing jobs completed but with incomplete data
- SHAs appear truncated
- Happens during high-traffic times
- Error logs mention "rate limit"

**Evidence SQL:**
```sql
SELECT * FROM jobs 
WHERE type = 'webhook_processing'::job_type
AND error_message LIKE '%rate limit%'
AND created_at > NOW() - INTERVAL '1 day';
```

**Fix:**
1. Implement exponential backoff for GitHub API calls
2. Check rate limit headers before making requests
3. Use authenticated requests (higher limit)
4. Cache commit data to reduce API calls

---

### Scenario C: Database Migration Bug

**Signs:**
- All bad SHAs from same time period
- Pattern in the data (truncated, same format)
- Timestamp aligns with deployment/migration

**Evidence SQL:**
```sql
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total,
  COUNT(CASE WHEN sha ~ '[^a-f0-9]' THEN 1 END) as invalid
FROM commits
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

**Fix:**
1. Review recent migrations or deployments
2. Check SQL scripts for data transformation
3. Restore from backup if available
4. Re-import data from GitHub API

---

### Scenario D: Webhook Payload Has Wrong Repository

**Signs:**
- SHAs exist but in wrong repository
- webhook processing shows different repo name
- Webhook delivery went to wrong project

**Evidence SQL:**
```sql
SELECT 
  j.data->>'repository' as webhook_repo,
  p.repo_name as project_repo,
  COUNT(*) as count
FROM jobs j
LEFT JOIN projects p ON j.project_id = p.id
WHERE j.type = 'webhook_processing'::job_type
GROUP BY j.data->>'repository', p.repo_name
HAVING j.data->>'repository' != p.repo_name;
```

**Fix:**
1. Check GitHub webhook configuration
2. Verify webhook URL is correct
3. Check project-to-webhook mapping
4. May need to reconfigure webhook delivery

---

## Remediation Strategies

### Option 1: Delete Invalid Records

**If data is clearly bad and unrecoverable:**

```sql
-- Delete failed jobs with invalid SHAs
DELETE FROM jobs
WHERE type = 'fetch_diff'::job_type
AND error_message LIKE '%No common ancestor%'
AND created_at > NOW() - INTERVAL '7 days';

-- Delete invalid commits (if no summaries exist)
DELETE FROM commits
WHERE id IN (
  SELECT c.id FROM commits c
  WHERE (c.sha = 'c5c9ea85c587a25046f815cda8434e8fa00b536f'
     OR c.sha = '401951fd91a3e8d32dcaa63333133411c4dd7978')
  AND c.summary IS NULL
);
```

**⚠️ BE CAREFUL:** This is destructive. Only do if:
- Commits haven't been published
- No summaries generated
- Data confirmed invalid with GitHub API

---

### Option 2: Correct the SHAs

**If you know what the correct SHAs should be:**

```sql
UPDATE commits
SET sha = '0000000000000000000000000000000000000000'  -- Correct SHA
WHERE sha = 'c5c9ea85c587a25046f815cda8434e8fa00b536f'
AND summary IS NULL;

-- Then retry the jobs
UPDATE jobs
SET status = 'pending', attempts = 0, error_message = NULL
WHERE type = 'fetch_diff'::job_type
AND (
  data->>'base_sha' = 'c5c9ea85c587a25046f815cda8434e8fa00b536f'
  OR data->>'head_sha' = 'c5c9ea85c587a25046f815cda8434e8fa00b536f'
);
```

---

### Option 3: Re-fetch from GitHub

**If you have commit metadata but not SHAs:**

```typescript
// In your job handler or migration:
// 1. Get the commit from GitHub using author + timestamp
// 2. Extract correct SHA
// 3. Update database record

const commits = await githubClient.getCommits({
  owner, repo,
  since: timestamp.toISOString(),
  until: new Date(timestamp.getTime() + 3600000).toISOString(),
  author
});

const correctSha = commits.find(c => c.author.name === authorName)?.sha;

if (correctSha) {
  // Update database
  await db.updateCommit(commitId, { sha: correctSha });
}
```

---

### Option 4: Add Validation Layer

**Prevent this from happening again:**

```typescript
// Add to webhook-parser.ts before creating commits

function validateCommitSha(sha: string): boolean {
  // Must be 40 hex characters (full SHA)
  // or 7+ hex characters (short SHA)
  return /^[a-f0-9]{7,40}$/.test(sha);
}

function validateCommit(commit: any): CommitData | null {
  // Check SHA
  if (!validateCommitSha(commit.id) && !validateCommitSha(commit.sha)) {
    console.error('Invalid SHA in webhook payload:', {
      id: commit.id,
      sha: commit.sha,
      timestamp: new Date().toISOString(),
    });
    return null;
  }
  
  // Check author
  if (!commit.author || !commit.author.name) {
    console.error('Missing author in webhook payload');
    return null;
  }
  
  return {
    sha: commit.sha || commit.id,
    author: commit.author.name,
    message: commit.message,
    timestamp: commit.timestamp,
  };
}

// Use in webhook handler:
const validCommits = webhookCommits
  .map(c => validateCommit(c))
  .filter(c => c !== null);

if (validCommits.length === 0) {
  return {
    success: false,
    error: 'No valid commits in webhook payload',
    metadata: { reason: 'invalid_payload' },
  };
}
```

---

## Prevention Checklist

- [ ] Add SHA format validation before database insert
- [ ] Add webhook payload logging (for debugging)
- [ ] Add unit tests for webhook parsing
- [ ] Add GitHub API validation (confirm SHAs exist)
- [ ] Add database integrity checks (periodic validation)
- [ ] Add alerts for invalid data
- [ ] Document expected webhook payload format
- [ ] Add developer documentation for common issues
- [ ] Review GitHub webhook configuration

---

## Testing the Fix

After remediation:

```sql
-- 1. Verify invalid data is gone
SELECT COUNT(*) as invalid_count
FROM commits
WHERE sha ~ '[^a-f0-9]' OR LENGTH(sha) NOT IN (7, 40);

-- Expected: 0

-- 2. Check if any jobs are still failing
SELECT COUNT(*) as failing_jobs
FROM jobs
WHERE type = 'fetch_diff'::job_type
AND status = 'failed'
AND error_message LIKE '%No common ancestor%';

-- Expected: 0 (or decreasing)

-- 3. Monitor for new invalid data
SELECT * FROM commits
WHERE created_at > NOW() - INTERVAL '1 hour'
AND (sha ~ '[^a-f0-9]' OR LENGTH(sha) NOT IN (7, 40));

-- Expected: empty result
```

---

## Quick Decision Tree

```
START: Invalid SHAs found
│
├─ Did they come from webhook? (check job timestamps)
│  ├─ YES → Check webhook-parser.ts logic
│  │   ├─ SHA extraction correct? NO → Fix parsing logic
│  │   ├─ Validation present? NO → Add validation
│  │   └─ Test with sample payload
│  │
│  └─ Possibly GitHub API rate limit
│      └─ Implement exponential backoff
│
├─ Are they completely invalid? (verify with GitHub API)
│  ├─ YES → Delete or correct
│  │   ├─ If no summaries: DELETE records
│  │   └─ If has data: Correct SHA if known
│  │
│  └─ NO → They exist somewhere
│      └─ Might be wrong repository
│          └─ Check webhook delivery target
│
└─ Implement prevention
    ├─ Add validation layer
    ├─ Add webhook logging
    ├─ Add monitoring alerts
    └─ Document expected format
```

