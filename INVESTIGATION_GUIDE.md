# Investigation Guide: "No diff content available for summarization" Error

## Error Context
- **Job ID**: 9bff89b2-be1a-4e46-8853-f3872aa21507
- **User**: Theo Goodman (GitHub ID: 26825549, User ID: 30655c05-c384-456a-889d-fa46afcfea8b)
- **Error**: `No diff content available for summarization`
- **Error Location**: `src/lib/jobs/handlers/generate-summary-handler.ts:95`

---

## Understanding the Error

### Root Cause
The `generate_summary` job handler attempts to retrieve diff content from multiple sources:

1. **Direct job data**: `job.data.diff_content`
2. **Job context (direct)**: `job.context.result.diff_content`
3. **Job context (nested)**: `job.context.result.data.diff_content`
4. **Dependency job context**: Fetches dependencies and checks their context/result

When **none** of these sources contain diff content, the handler fails with the error.

### Why This Happens

The `generate_summary` job is typically **dependent on** a `fetch_diff` job that should populate the context with diff content. If:

- The `fetch_diff` job never ran
- The `fetch_diff` job failed
- The `fetch_diff` job succeeded but didn't store diff content in context
- The job dependency relationship is broken or missing
- The diff content was too large or invalid and rejected

Then the `generate_summary` job will have no diff to summarize.

---

## Investigation Steps

### Step 1: Check the Job Record

```sql
SELECT 
  j.id,
  j.type,
  j.status,
  j.attempts,
  j.max_attempts,
  j.data,
  j.context,
  j.error_message,
  j.error_details,
  j.started_at,
  j.completed_at,
  j.created_at,
  j.project_id,
  j.commit_id
FROM jobs j
WHERE j.id = '9bff89b2-be1a-4e46-8853-f3872aa21507';
```

**What to look for:**
- Job status (should be 'failed')
- `data` field: Does it have `diff_content`?
- `context` field: Does it have nested diff content?
- `error_message`: Should be the "No diff content available for summarization"
- Project and commit IDs for cross-referencing

---

### Step 2: Check for Job Dependencies

```sql
-- Find what job(s) the failing generate_summary job depends on
SELECT 
  jd.id,
  jd.job_id,
  jd.depends_on_job_id,
  j.type,
  j.status,
  j.error_message,
  j.created_at
FROM job_dependencies jd
JOIN jobs j ON jd.depends_on_job_id = j.id
WHERE jd.job_id = '9bff89b2-be1a-4e46-8853-f3872aa21507'
ORDER BY jd.created_at DESC;
```

**What to look for:**
- Is there a dependency? (If not, this is part of the problem)
- If yes, what job ID does it depend on?
- What is the status of the dependency job?
- Did the dependency job fail?

---

### Step 3: Examine the Dependency Job (if it exists)

```sql
-- Get details on the dependency job
SELECT 
  j.id,
  j.type,
  j.status,
  j.data,
  j.context,
  j.error_message,
  j.error_details,
  j.started_at,
  j.completed_at,
  j.attempts,
  j.max_attempts,
  j.created_at
FROM jobs j
WHERE j.id = (
  -- Replace with the depends_on_job_id from Step 2
  SELECT depends_on_job_id 
  FROM job_dependencies 
  WHERE job_id = '9bff89b2-be1a-4e46-8853-f3872aa21507'
  LIMIT 1
);
```

**What to look for:**
- Dependency job status (should be 'completed' for generate_summary to run)
- Does it have `context.result.diff_content`?
- If failed, what was the error?
- Check `context` field structure:
  ```json
  {
    "result": {
      "diff_content": "...",
      "file_changes": [...],
      "data": { "diff_content": "..." }
    }
  }
  ```

---

### Step 4: Examine the Commit Record

```sql
-- Get the commit that the generate_summary job was processing
SELECT 
  c.id,
  c.project_id,
  c.sha,
  c.author,
  c.timestamp,
  c.summary,
  c.type,
  c.email_sent,
  c.created_at
FROM commits c
WHERE c.id = (
  SELECT commit_id FROM jobs 
  WHERE id = '9bff89b2-be1a-4e46-8853-f3872aa21507'
);
```

**What to look for:**
- Does the commit exist?
- Is `summary` NULL? (It should be if job failed)
- Creation timestamp (compare with job timestamps)

---

### Step 5: Check Project and User Context

```sql
-- Get project and user details
SELECT 
  p.id,
  p.user_id,
  p.name,
  p.repo_name,
  u.id,
  u.email,
  u.name,
  u.github_id
FROM projects p
LEFT JOIN users u ON p.user_id = u.id
WHERE p.id = (
  SELECT project_id FROM jobs 
  WHERE id = '9bff89b2-be1a-4e46-8853-f3872aa21507'
);
```

**What to look for:**
- Does the project exist?
- Is it linked to the user?
- Are user credentials valid?

---

### Step 6: Look at All Jobs for This Commit

```sql
-- Get all jobs related to this commit to see the workflow
SELECT 
  j.id,
  j.type,
  j.status,
  j.attempts,
  j.error_message,
  j.created_at,
  j.started_at,
  j.completed_at,
  CASE 
    WHEN j.status = 'completed' THEN 'SUCCESS'
    WHEN j.status = 'failed' THEN 'FAILED'
    WHEN j.status = 'pending' THEN 'PENDING'
    ELSE j.status
  END as job_state
FROM jobs j
WHERE j.commit_id = (
  SELECT commit_id FROM jobs 
  WHERE id = '9bff89b2-be1a-4e46-8853-f3872aa21507'
)
ORDER BY j.created_at;
```

**What to look for:**
- The complete workflow for this commit
- Did `fetch_diff` job run before `generate_summary`?
- Did `fetch_diff` succeed?
- Timing: Which job ran when?

---

### Step 7: Deep Dive - Job Data Analysis

```sql
-- Extract and examine the job data and context more clearly
SELECT 
  j.id,
  j.type,
  j.status,
  j.data::text as job_data,
  j.context::text as job_context,
  j.error_details::text as error_details
FROM jobs j
WHERE j.commit_id = (
  SELECT commit_id FROM jobs 
  WHERE id = '9bff89b2-be1a-4e46-8853-f3872aa21507'
)
ORDER BY j.created_at;
```

**What to look for:**
- For `fetch_diff`: Does it have `diff_content` in its result?
- For `generate_summary`: Where is it looking for diff content?
- Are there error_details that explain failures?

---

### Step 8: Check Job Queue Processing History

```sql
-- Get recent jobs for this user/project to spot patterns
SELECT 
  j.id,
  j.type,
  j.status,
  j.attempts,
  j.max_attempts,
  j.error_message,
  j.created_at,
  COUNT(CASE WHEN j.status = 'failed' THEN 1 END) OVER (
    PARTITION BY j.project_id, j.type
  ) as failures_of_this_type
FROM jobs j
WHERE j.project_id = (
  SELECT project_id FROM jobs 
  WHERE id = '9bff89b2-be1a-4e46-8853-f3872aa21507'
)
ORDER BY j.created_at DESC
LIMIT 20;
```

**What to look for:**
- Is this a pattern? Multiple failures?
- Are all `fetch_diff` jobs failing?
- Are dependencies being set up correctly?

---

## Likely Root Causes (in order of probability)

### 1. **Missing or Failed `fetch_diff` Job** (60% probability)
The `generate_summary` job depends on `fetch_diff`, but:
- The dependency job is missing
- The dependency job failed before completing
- The dependency job completed but didn't produce diff content

**Fix:**
```sql
-- Re-trigger the fetch_diff job manually
INSERT INTO jobs (type, status, priority, data, context, commit_id, project_id, scheduled_for, max_attempts)
SELECT 
  'fetch_diff'::job_type,
  'pending',
  50,
  data,  -- Use original job data
  '{}',
  commit_id,
  project_id,
  NOW(),
  3
FROM jobs
WHERE id = '9bff89b2-be1a-4e46-8853-f3872aa21507';
```

### 2. **Broken Dependency Chain** (20% probability)
The job dependency relationship is missing or incorrect.

**Fix:**
```sql
-- If fetch_diff job exists, link it as a dependency
INSERT INTO job_dependencies (job_id, depends_on_job_id)
SELECT 
  '9bff89b2-be1a-4e46-8853-f3872aa21507',  -- generate_summary job
  (SELECT id FROM jobs 
   WHERE type = 'fetch_diff'::job_type 
   AND commit_id = (SELECT commit_id FROM jobs WHERE id = '9bff89b2-be1a-4e46-8853-f3872aa21507')
   ORDER BY created_at DESC LIMIT 1)
ON CONFLICT DO NOTHING;
```

### 3. **Diff Content Too Large or Invalid** (10% probability)
The `fetch_diff` job may have rejected the diff as too large.

**Check:**
```sql
-- Find jobs with errors about diff size
SELECT * FROM jobs 
WHERE type = 'fetch_diff'::job_type
AND commit_id = (
  SELECT commit_id FROM jobs 
  WHERE id = '9bff89b2-be1a-4e46-8853-f3872aa21507'
)
AND error_message LIKE '%size%' OR error_message LIKE '%limit%';
```

### 4. **Context Structure Mismatch** (10% probability)
The diff content is stored in `context` but under an unexpected structure.

**Check:**
```sql
-- Search for diff content in various context structures
SELECT 
  j.id,
  j.type,
  CASE 
    WHEN j.context->>'result' IS NOT NULL THEN 'has_result'
    WHEN j.context->'result'->>'diff_content' IS NOT NULL THEN 'has_result_diff_content'
    WHEN j.context->'result'->'data'->>'diff_content' IS NOT NULL THEN 'has_result_data_diff_content'
    ELSE 'no_diff_found'
  END as context_structure
FROM jobs j
WHERE j.commit_id = (
  SELECT commit_id FROM jobs 
  WHERE id = '9bff89b2-be1a-4e46-8853-f3872aa21507'
);
```

---

## Resolution Workflow

### Option A: If `fetch_diff` Job Failed

1. Investigate why `fetch_diff` failed:
   - GitHub API issues?
   - Invalid repository/branch?
   - Rate limiting?
   - Network timeout?

2. Fix the root cause
3. Manually retry `fetch_diff`:
   ```sql
   UPDATE jobs 
   SET status = 'pending', attempts = 0, error_message = NULL
   WHERE type = 'fetch_diff'::job_type
   AND commit_id = (SELECT commit_id FROM jobs WHERE id = '9bff89b2-be1a-4e46-8853-f3872aa21507')
   ORDER BY created_at DESC LIMIT 1;
   ```

4. Wait for job to complete, then automatically `generate_summary` will retry

### Option B: If Dependency is Missing

1. Find the `fetch_diff` job ID
2. Create the dependency relationship (see SQL above)
3. Reset `generate_summary` to pending:
   ```sql
   UPDATE jobs 
   SET status = 'pending', attempts = 0, error_message = NULL
   WHERE id = '9bff89b2-be1a-4e46-8853-f3872aa21507';
   ```

### Option C: If Diff Content Exists but in Wrong Structure

1. Extract the diff content:
   ```sql
   SELECT j.context->>'...' as diff_content
   FROM jobs j
   WHERE type = 'fetch_diff'::job_type
   AND commit_id = (SELECT commit_id FROM jobs WHERE id = '9bff89b2-be1a-4e46-8853-f3872aa21507');
   ```

2. Manually populate the generate_summary job's data:
   ```sql
   UPDATE jobs 
   SET data = jsonb_set(data, '{diff_content}', to_jsonb('...'::text))
   WHERE id = '9bff89b2-be1a-4e46-8853-f3872aa21507';
   ```

3. Reset job status:
   ```sql
   UPDATE jobs 
   SET status = 'pending', attempts = 0, error_message = NULL
   WHERE id = '9bff89b2-be1a-4e46-8853-f3872aa21507';
   ```

---

## Monitoring & Prevention

### Add Monitoring Query
```sql
-- Monitor for missing diff content issues
SELECT 
  j.id,
  j.type,
  j.commit_id,
  j.error_message,
  COUNT(*) as occurrence_count,
  MAX(j.created_at) as latest_occurrence
FROM jobs j
WHERE j.status = 'failed'
AND j.error_message LIKE '%No diff content%'
AND j.created_at > NOW() - INTERVAL '7 days'
GROUP BY j.commit_id
HAVING COUNT(*) > 3;
```

### Add Preventive Checks in Code
- Ensure dependencies are created BEFORE generate_summary job is created
- Add fallback: if diff_content missing after X retries, manually fetch and inject
- Add logging to track diff_content movement through job context

---

## Useful Log Commands

```bash
# Check recent logs for this job
tail -f logs/job-processing.log | grep "9bff89b2-be1a-4e46-8853-f3872aa21507"

# Check for similar errors (last 7 days)
grep "No diff content available" logs/*.log | head -20

# Check fetch_diff failures
grep "fetch_diff.*failed\|fetch_diff.*error" logs/*.log | head -20
```

