# Debugging Guide: "No diff content available for summarization"

## Job Processing Flow Diagram

### Normal (Success Path)
```
┌─────────────────────────────────────────────────────────────────────┐
│                    WEBHOOK EVENT RECEIVED                            │
│                  (Push to GitHub repository)                         │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ JOB 1: webhook_processing                                           │
│ ├─ Parse webhook payload                                            │
│ ├─ Create commit record(s)                                          │
│ └─ Enqueue fetch_diff job                                           │
│    └─ Result Context: { repository, branch, commit info }           │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ JOB 2: fetch_diff (DEPENDS ON: webhook_processing)                 │
│ ├─ Fetch diff from GitHub API                                      │
│ ├─ Parse diff content                                              │
│ └─ Store in context.result.diff_content                            │
│    └─ Result Context:                                              │
│       {                                                             │
│         "diff_content": "diff --git a/file.ts b/file.ts...",       │
│         "file_changes": [...],                                      │
│         "repository": "owner/repo"                                  │
│       }                                                             │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ JOB 3: generate_summary (DEPENDS ON: fetch_diff)                   │
│ ├─ Retrieve diff_content from:                                      │
│ │  1. job.data.diff_content                                        │
│ │  2. job.context.result.diff_content ✓ (FOUND HERE)              │
│ │  3. job.context.result.data.diff_content                        │
│ │  4. dependency.context.result.diff_content                       │
│ ├─ Call OpenAI to summarize                                        │
│ └─ Store summary in commits table                                  │
│    └─ Result: Commit has summary + type (feature/fix)             │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ JOB 4: send_email (optional)                                        │
│ ├─ Fetch recipients from project.email_distribution_list           │
│ └─ Send summary email                                              │
└─────────────────────────────────────────────────────────────────────┘
```

### Error Path (What's Happening Now)
```
┌─────────────────────────────────────────────────────────────────────┐
│ JOB 2: fetch_diff                                                   │
│ Status: ? (need to check)                                           │
│ Context.result: ? (is diff_content here?)                           │
└────────────────────────────┬────────────────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
        SCENARIO A              SCENARIO B / C / D
    (fetch_diff failed)      (fetch_diff completed)
              │                   │
        Status: FAILED          Context is:
        Error: (GitHub API)    - Empty {}
              │                  - Missing diff_content
              ▼                  - Wrong structure
        ❌ CANNOT RETRY              │
                             ┌────┴────┐
                             │          │
                           YES         NO
                             │          │
                    ▼ (go fetch)   ▼ (MISSING)
┌─────────────────────────────────────────────────────────────────────┐
│ JOB 3: generate_summary                                             │
│ ├─ Looks for diff_content in 4 places:                             │
│ │  1. data.diff_content ❌                                         │
│ │  2. context.result.diff_content ❌                              │
│ │  3. context.result.data.diff_content ❌                         │
│ │  4. dependency.context... ❌ (same as above)                     │
│ │                                                                  │
│ ├─ Returns ERROR:                                                  │
│ │ "No diff content available for summarization"                   │
│ └─ Status: FAILED                                                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Code Flow Analysis

### Where the Error Occurs

**File:** `src/lib/jobs/handlers/generate-summary-handler.ts`

```typescript
async handle(job: Job, data: GenerateSummaryJobData): Promise<JobResult> {
  // Line 68: Start with direct diff_content from job data
  let diffContent = data.diff_content;
  
  // Lines 72-76: Try job.context.result (both direct and nested)
  if (!diffContent) {
    const fromContextDirect = job.context?.result?.diff_content
    const fromContextNested = job.context?.result?.data?.diff_content
    diffContent = fromContextDirect || fromContextNested
  }
  
  // Lines 79-90: Try fetching from dependency job's context
  if (!diffContent) {
    const deps = await this.jobQueueService.getJobDependencies(job.id)
    const depId = deps.data?.[0]?.depends_on_job_id
    if (depId) {
      const dep = await this.jobQueueService.getJob(depId)
      const depCtx = dep.data?.context?.result
      const fromDepDirect = depCtx?.diff_content
      const fromDepNested = depCtx?.data?.diff_content
      diffContent = fromDepDirect || fromDepNested
    }
  }
  
  // Lines 92-101: FAIL if still no diff_content
  if (!diffContent) {
    return {
      success: false,
      error: 'No diff content available for summarization',  // ← YOUR ERROR
      metadata: {
        reason: 'missing_diff_content',
        commitId: data.commit_id,
      },
    }
  }
  
  // ... rest of handler if diff_content is available
}
```

### Context Structure Expected by generate_summary

**Expected Shape:**
```json
{
  "result": {
    "diff_content": "diff --git a/file.ts b/file.ts\nindex abc...\n---...",
    "file_changes": [
      {
        "filename": "src/file.ts",
        "patch": "@@ -1,5 +1,10 @@\n..."
      }
    ],
    "repository": "owner/repo"
  }
}
```

OR (nested variant):
```json
{
  "result": {
    "data": {
      "diff_content": "diff --git a/file.ts b/file.ts\n..."
    }
  }
}
```

---

## Debugging Techniques

### 1. Inspect Job Context Directly

```typescript
// In your debugging session or directly in code:
const job = await jobQueueService.getJob('9bff89b2-be1a-4e46-8853-f3872aa21507');

console.log('=== JOB CONTEXT DEBUG ===');
console.log('Job ID:', job.id);
console.log('Job Type:', job.type);
console.log('Job Status:', job.status);

console.log('\n--- Checking data.diff_content ---');
console.log('Has it?', !!job.data?.diff_content);
console.log('Length:', job.data?.diff_content?.length || 0);

console.log('\n--- Checking context.result.diff_content ---');
console.log('Has it?', !!job.context?.result?.diff_content);
console.log('Length:', job.context?.result?.diff_content?.length || 0);

console.log('\n--- Checking context.result.data.diff_content ---');
console.log('Has it?', !!job.context?.result?.data?.diff_content);
console.log('Length:', job.context?.result?.data?.diff_content?.length || 0);

console.log('\n--- Checking dependency ---');
const deps = await jobQueueService.getJobDependencies(job.id);
console.log('Dependencies:', deps.data);

if (deps.data?.[0]) {
  const depJob = await jobQueueService.getJob(deps.data[0].depends_on_job_id);
  console.log('Dep Job Status:', depJob.status);
  console.log('Dep Job Type:', depJob.type);
  console.log('Dep Job Error:', depJob.error_message);
  console.log('Dep Context Structure:', Object.keys(depJob.context || {}));
  console.log('Dep Result Structure:', Object.keys(depJob.context?.result || {}));
}
```

### 2. SQL Debug Query (Complete Picture)

```sql
-- Get everything you need to debug
WITH target_job AS (
  SELECT * FROM jobs 
  WHERE id = '9bff89b2-be1a-4e46-8853-f3872aa21507'
),
dependency_job AS (
  SELECT j.* 
  FROM jobs j
  JOIN job_dependencies jd ON jd.depends_on_job_id = j.id
  WHERE jd.job_id = '9bff89b2-be1a-4e46-8853-f3872aa21507'
  LIMIT 1
)
SELECT
  '=== TARGET JOB ===' as section,
  tj.id,
  tj.type,
  tj.status,
  tj.error_message,
  'data' as field,
  tj.data::text
FROM target_job tj

UNION ALL

SELECT
  '=== TARGET JOB CONTEXT ===',
  tj.id,
  tj.type,
  tj.status,
  tj.error_message,
  'context',
  tj.context::text
FROM target_job tj

UNION ALL

SELECT
  '=== DEPENDENCY JOB ===',
  dj.id,
  dj.type,
  dj.status,
  dj.error_message,
  'id',
  NULL::text
FROM dependency_job dj

UNION ALL

SELECT
  '=== DEPENDENCY CONTEXT ===',
  dj.id,
  dj.type,
  dj.status,
  dj.error_message,
  'context',
  dj.context::text
FROM dependency_job dj;
```

### 3. Check Context Paths

```sql
-- Test all possible context paths
SELECT
  'Path' as path,
  'Value' as value,
  'Status' as status
FROM (
  SELECT
    'data.diff_content' as path,
    data->>'diff_content' as value,
    CASE WHEN data->>'diff_content' IS NOT NULL THEN '✓ FOUND' ELSE '✗ NULL' END as status
  FROM jobs WHERE id = '9bff89b2-be1a-4e46-8853-f3872aa21507'
  
  UNION ALL
  
  SELECT
    'context.result.diff_content',
    context->'result'->>'diff_content',
    CASE WHEN context->'result'->>'diff_content' IS NOT NULL THEN '✓ FOUND' ELSE '✗ NULL' END
  FROM jobs WHERE id = '9bff89b2-be1a-4e46-8853-f3872aa21507'
  
  UNION ALL
  
  SELECT
    'context.result.data.diff_content',
    context->'result'->'data'->>'diff_content',
    CASE WHEN context->'result'->'data'->>'diff_content' IS NOT NULL THEN '✓ FOUND' ELSE '✗ NULL' END
  FROM jobs WHERE id = '9bff89b2-be1a-4e46-8853-f3872aa21507'
) as paths;
```

### 4. Extract Diff Content (If It Exists)

```sql
-- Find diff_content anywhere in the job's data/context
SELECT
  COALESCE(
    data->>'diff_content',
    context->'result'->>'diff_content',
    context->'result'->'data'->>'diff_content'
  ) as found_diff
FROM jobs 
WHERE id = '9bff89b2-be1a-4e46-8853-f3872aa21507';

-- If you got a result (diff is somewhere), manually restore:
UPDATE jobs 
SET data = jsonb_set(
  data,
  '{diff_content}',
  to_jsonb(
    COALESCE(
      data->>'diff_content',
      context->'result'->>'diff_content',
      context->'result'->'data'->>'diff_content'
    )::text
  )
)
WHERE id = '9bff89b2-be1a-4e46-8853-f3872aa21507';
```

---

## Common Issues & Fixes

### Issue #1: fetch_diff Job Exists but Has No Context

**Symptoms:**
```sql
SELECT status, context FROM jobs 
WHERE type = 'fetch_diff'::job_type 
AND commit_id = (SELECT commit_id FROM jobs WHERE id = '9bff89b2-be1a-4e46-8853-f3872aa21507');

-- Returns: status='completed', context='{}'  ← PROBLEM!
```

**Root Cause:** fetch_diff handler didn't set context.result

**Fix:** Check `src/lib/jobs/handlers/fetch-diff-handler.ts` to see if it's populating context.result with diff_content

### Issue #2: Context Structure is Non-Standard

**Symptoms:**
```sql
-- What if context looks like this?
{
  "diff": "...",           ← NOT result.diff_content
  "diffContent": "...",    ← NOT diff_content
  "patch": "..."           ← NOT what we're looking for
}
```

**Root Cause:** fetch_diff is storing diff under a different key name

**Fix:** 
1. Trace what fetch_diff handler actually returns
2. Either fix fetch_diff to use standard keys
3. Or update generate_summary to look in additional locations

### Issue #3: Dependency Never Completed

**Symptoms:**
```sql
SELECT dj.status FROM job_dependencies jd
JOIN jobs dj ON jd.depends_on_job_id = dj.id
WHERE jd.job_id = '9bff89b2-be1a-4e46-8853-f3872aa21507';

-- Returns: status='pending' or 'failed'  ← PROBLEM!
```

**Root Cause:** Job processor never ran fetch_diff job

**Fix:**
```sql
-- Force the dependency job to run
UPDATE jobs 
SET status = 'pending', scheduled_for = NOW()
WHERE id = (
  SELECT depends_on_job_id FROM job_dependencies
  WHERE job_id = '9bff89b2-be1a-4e46-8853-f3872aa21507'
)
AND type = 'fetch_diff'::job_type;
```

### Issue #4: No Dependency Relationship

**Symptoms:**
```sql
SELECT COUNT(*) FROM job_dependencies 
WHERE job_id = '9bff89b2-be1a-4e46-8853-f3872aa21507';

-- Returns: 0  ← PROBLEM: No dependencies!
```

**Root Cause:** Job creation code didn't create the dependency

**Fix:**
```sql
-- Find the fetch_diff job for this commit
WITH target AS (
  SELECT commit_id FROM jobs 
  WHERE id = '9bff89b2-be1a-4e46-8853-f3872aa21507'
),
fetch_job AS (
  SELECT id FROM jobs 
  WHERE type = 'fetch_diff'::job_type
  AND commit_id = (SELECT commit_id FROM target)
  ORDER BY created_at DESC
  LIMIT 1
)
INSERT INTO job_dependencies (job_id, depends_on_job_id)
SELECT '9bff89b2-be1a-4e46-8853-f3872aa21507', fetch_job.id
FROM fetch_job
ON CONFLICT DO NOTHING;

-- Then retry
UPDATE jobs SET status = 'pending', attempts = 0
WHERE id = '9bff89b2-be1a-4e46-8853-f3872aa21507';
```

---

## Testing Your Fix

After applying a fix, verify it works:

```sql
-- 1. Verify job is pending again
SELECT status, attempts, error_message 
FROM jobs WHERE id = '9bff89b2-be1a-4e46-8853-f3872aa21507';
-- Expected: status='pending', attempts=0, error_message=NULL

-- 2. Wait a few seconds (processor checks every 2 seconds)
WAIT 5 SECONDS

-- 3. Check if job completed
SELECT status, error_message 
FROM jobs WHERE id = '9bff89b2-be1a-4e46-8853-f3872aa21507';
-- Expected: status='completed' (or 'failed' with different error if different issue)

-- 4. Check if commit has summary now
SELECT id, summary, type 
FROM commits WHERE id = (
  SELECT commit_id FROM jobs 
  WHERE id = '9bff89b2-be1a-4e46-8853-f3872aa21507'
);
-- Expected: summary IS NOT NULL
```

---

## Prevention: Add Better Validation

Add this to the generate_summary handler to provide better error messages:

```typescript
// Add detailed logging to show what was checked
const debugInfo = {
  dataHasDiffContent: !!data.diff_content,
  contextHasResult: !!(job.context as any)?.result,
  contextResultHasDiffContent: !!((job.context as any)?.result?.diff_content),
  contextResultDataHasDiffContent: !!((job.context as any)?.result?.data?.diff_content),
  hasDependency: false,
  dependencyStatus: null,
  dependencyHasDiffContent: false,
};

// ... after checking dependencies ...

console.warn('[GenerateSummary] Missing diff_content debug info:', debugInfo);

return {
  success: false,
  error: 'No diff content available for summarization',
  metadata: {
    reason: 'missing_diff_content',
    commitId: data.commit_id,
    debugInfo,  // Include this for future debugging
  },
};
```

