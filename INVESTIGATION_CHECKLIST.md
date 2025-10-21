# Quick Investigation Checklist

## Start Here 🔍

### Context Known:
- ✅ Job ID: `9bff89b2-be1a-4e46-8853-f3872aa21507`
- ✅ User: Theo Goodman (GitHub: 26825549)
- ✅ Error: "No diff content available for summarization"
- ✅ Error occurs in: `generate-summary-handler.ts` line 95

---

## Investigation Checklist (5 minutes to root cause)

### ☐ PHASE 1: Verify Job Status (1 minute)

```sql
-- Run this immediately
SELECT 
  id, type, status, attempts, max_attempts,
  error_message, created_at, started_at, completed_at
FROM jobs
WHERE id = '9bff89b2-be1a-4e46-8853-f3872aa21507';
```

**Expected result:** 
- Status should be `failed`
- Error message should contain "No diff content available for summarization"
- Check when it failed relative to creation

---

### ☐ PHASE 2: Check Dependencies (2 minutes)

```sql
-- Does this job have dependencies?
SELECT 
  jd.depends_on_job_id,
  j.type, j.status, j.error_message,
  j.created_at, j.completed_at
FROM job_dependencies jd
LEFT JOIN jobs j ON jd.depends_on_job_id = j.id
WHERE jd.job_id = '9bff89b2-be1a-4e46-8853-f3872aa21507';
```

**Decision Point:**
- ✅ **HAS dependency:** → Go to PHASE 3A
- ❌ **NO dependency:** → LIKELY PROBLEM: Missing fetch_diff job
  - Run this to find orphaned generate_summary jobs:
  ```sql
  SELECT COUNT(*) FROM jobs 
  WHERE type = 'generate_summary'::job_type 
  AND status = 'failed'
  AND error_message LIKE '%No diff content%'
  AND id NOT IN (SELECT job_id FROM job_dependencies);
  ```

---

### ☐ PHASE 3A: Check Dependency Job (1 minute)

```sql
-- Get the dependency job details
WITH dep_job_id AS (
  SELECT depends_on_job_id 
  FROM job_dependencies 
  WHERE job_id = '9bff89b2-be1a-4e46-8853-f3872aa21507'
  LIMIT 1
)
SELECT 
  id, type, status, 
  attempts, max_attempts,
  error_message,
  created_at, completed_at
FROM jobs j, dep_job_id
WHERE j.id = dep_job_id.depends_on_job_id;
```

**Decision Point:**
- ✅ **Status = completed:** → Go to PHASE 4
- ❌ **Status = failed:** → LIKELY PROBLEM: Dependency job failed
  - Ask: What's the error_message?
- ⏱️ **Status = pending:** → LIKELY PROBLEM: Dependency never ran
  - This is unexpected for a failed generate_summary job
  - Check job processor logs

---

### ☐ PHASE 4: Examine Context Content (1 minute)

```sql
-- Does the dependency job have diff_content in its context?
WITH dep_job_id AS (
  SELECT depends_on_job_id 
  FROM job_dependencies 
  WHERE job_id = '9bff89b2-be1a-4e46-8853-f3872aa21507'
  LIMIT 1
)
SELECT 
  id,
  context->>'result' != '' AS has_result,
  context->'result'->>'diff_content' != '' AS has_result_diff_content,
  context->'result'->'data'->>'diff_content' != '' AS has_result_data_diff_content,
  LENGTH(context->'result'->>'diff_content')::int AS diff_content_length
FROM jobs j, dep_job_id
WHERE j.id = dep_job_id.depends_on_job_id;
```

**Decision Point:**
- ✅ **One is TRUE:** → Good, diff_content exists somewhere
  - Check why generate_summary didn't find it (code logic issue)
- ❌ **All FALSE/NULL:** → CLEAR PROBLEM: Dependency produced no diff
  - Go to PHASE 5

---

### ☐ PHASE 5: Check Commit & Project (1 minute)

```sql
-- Get commit and project details
SELECT 
  c.id, c.sha, c.author, c.summary,
  p.id, p.name, p.repo_name,
  u.email, u.github_id
FROM commits c
LEFT JOIN projects p ON c.project_id = p.id
LEFT JOIN users u ON p.user_id = u.id
WHERE c.id = (SELECT commit_id FROM jobs WHERE id = '9bff89b2-be1a-4e46-8853-f3872aa21507');
```

**What to look for:**
- Does commit exist? → If NO: data integrity issue
- Is project linked to user? → If NO: project configuration issue
- Is github_id correct (26825549)? → If NO: wrong user linked

---

## Root Cause Decision Tree

```
┌─ START: "No diff content available for summarization"
│
├─ No job dependency exists?
│  └─ ROOT CAUSE: fetch_diff job never created or orphaned
│     ACTION: Create fetch_diff job or link existing one
│
├─ Dependency job status = FAILED?
│  └─ ROOT CAUSE: fetch_diff failed (GitHub API, invalid repo, etc)
│     ACTION: Check fetch_diff error_message → fix underlying issue
│
├─ Dependency job status = PENDING?
│  └─ ROOT CAUSE: Job processor didn't run dependency (timing?)
│     ACTION: Check job processor logs → may be scheduling issue
│
├─ Dependency job has NO diff_content in context?
│  └─ ROOT CAUSE: fetch_diff succeeded but didn't populate context
│     ACTION: Check fetch_diff handler code → context save logic
│
└─ Dependency has diff_content but generate_summary didn't find it?
   └─ ROOT CAUSE: Context structure mismatch
      ACTION: Check context structure → may need to adjust lookup logic
```

---

## Quick Fixes (if you know the root cause)

### Fix #1: Missing/Broken Dependency
```sql
-- Re-create the dependency relationship
WITH gen_sum AS (
  SELECT commit_id, project_id
  FROM jobs 
  WHERE id = '9bff89b2-be1a-4e46-8853-f3872aa21507'
),
fetch_diff AS (
  SELECT id 
  FROM jobs j
  WHERE j.type = 'fetch_diff'::job_type
  AND j.commit_id = (SELECT commit_id FROM gen_sum)
  AND j.status IN ('completed', 'failed')  -- Most recent
  ORDER BY j.created_at DESC
  LIMIT 1
)
INSERT INTO job_dependencies (job_id, depends_on_job_id)
SELECT '9bff89b2-be1a-4e46-8853-f3872aa21507', fd.id
FROM fetch_diff fd
ON CONFLICT DO NOTHING;

-- Then retry generate_summary
UPDATE jobs 
SET status = 'pending', attempts = 0, error_message = NULL
WHERE id = '9bff89b2-be1a-4e46-8853-f3872aa21507';
```

### Fix #2: Dependency Failed (GitHub API)
```sql
-- Reset the fetch_diff job to retry
UPDATE jobs 
SET status = 'pending', attempts = 0, error_message = NULL
WHERE id = (
  SELECT depends_on_job_id 
  FROM job_dependencies 
  WHERE job_id = '9bff89b2-be1a-4e46-8853-f3872aa21507'
  LIMIT 1
)
AND type = 'fetch_diff'::job_type;

-- generate_summary will automatically retry once dependency completes
```

### Fix #3: Manually Inject Diff Content
```sql
-- If you have the diff content available:
UPDATE jobs 
SET data = jsonb_set(
  data, 
  '{diff_content}', 
  to_jsonb('PASTE_DIFF_HERE'::text)
)
WHERE id = '9bff89b2-be1a-4e46-8853-f3872aa21507';

-- Then retry
UPDATE jobs 
SET status = 'pending', attempts = 0, error_message = NULL
WHERE id = '9bff89b2-be1a-4e46-8853-f3872aa21507';
```

---

## Investigation Output Template

When you're done investigating, fill this out:

```
Investigation Summary for Job 9bff89b2-be1a-4e46-8853-f3872aa21507
================================================================

Root Cause Identified: [ Your finding here ]

Evidence:
- [ Finding 1 ]
- [ Finding 2 ]
- [ Finding 3 ]

Related Jobs:
- Dependency Job: [ ID or "NONE" ]
- Commit ID: [ ID ]
- Project ID: [ ID ]

Likely Fix:
[ Describe the fix or action needed ]

Prevention:
[ What should be fixed in code to prevent this ]
```

---

## Still Stuck?

### Enable Debug Logging
```sql
-- Check full error details
SELECT 
  id, type, status,
  data::text,
  context::text,
  error_message,
  error_details::text
FROM jobs
WHERE id = '9bff89b2-be1a-4e46-8853-f3872aa21507';
```

### Search Historical Pattern
```sql
-- Is this error happening to other commits?
SELECT 
  COUNT(*) as total_failures,
  project_id,
  DATE(created_at) as failure_date
FROM jobs
WHERE status = 'failed'
AND error_message LIKE '%No diff content%'
AND created_at > NOW() - INTERVAL '7 days'
GROUP BY project_id, DATE(created_at)
ORDER BY total_failures DESC;
```

### Check Job Processor Health
```sql
-- Are other jobs being processed?
SELECT 
  type,
  status,
  COUNT(*) as count,
  MAX(completed_at) as last_completed
FROM jobs
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY type, status;
```

