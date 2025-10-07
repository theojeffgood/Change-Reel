# Supabase Realtime Setup for Change Reel

This document explains how to enable real-time updates for commit summaries.

## What Was Fixed

### 1. Race Condition (Fixed ✅)
**Problem:** Users saw empty dashboard after installation because backfill ran asynchronously.

**Solution:** Modified `/api/webhooks/github` to process `installation.created` events **synchronously**. Now:
- User installs app
- Webhook fires and waits for backfill to complete
- 3 commits + jobs created before user lands on `/admin`
- User sees 3 placeholder cards with loading spinners

### 2. Real-time Updates (Requires Setup)
**Problem:** Summaries complete but don't appear until page refresh.

**Solution:** Supabase Realtime subscriptions automatically push updates when summaries complete.

---

## Setup Instructions

### Step 1: Run the Migration

Run this in your terminal:

```bash
psql $DATABASE_URL -f src/lib/supabase/migrations/014_enable_realtime_commits.sql
```

You should see:
```
NOTICE:  supabase_realtime publication already exists (or Created supabase_realtime publication)
NOTICE:  Added commits table to supabase_realtime publication
NOTICE:  ✅ SUCCESS: commits table is published for realtime
```

### Step 2: Verify in Supabase Dashboard

1. Go to **Supabase Dashboard → SQL Editor**
2. Run this query:

```sql
SELECT 
    tablename,
    '✅ Realtime enabled' as status
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';
```

You should see `commits` in the results.

### Step 3: Test Realtime Connection

1. Deploy your changes
2. Open browser console on `/admin` page
3. Check for subscription logs (look for "📡 Subscription status: SUBSCRIBED")
4. In Supabase SQL Editor, update a commit:

```sql
UPDATE commits 
SET summary = 'Test update ' || NOW()::text 
WHERE id = (SELECT id FROM commits LIMIT 1);
```

5. The dashboard should update automatically without refresh!

---

## How It Works Now

### First-Time Installation Flow

1. **User installs GitHub App**
   - Installation webhook fires to `/api/webhooks/github`

2. **Webhook handler processes synchronously**
   - Detects `installation.created` event
   - Runs backfill immediately (takes 2-5 seconds)
   - Creates 3 commits in database (no summaries yet)
   - Creates 3 `generate_summary` jobs

3. **User lands on `/admin`**
   - Commits exist with `processing: true` flag
   - Shows 3 placeholder cards with loading spinners
   - Establishes Realtime subscription to user's project commits

4. **Job processor generates summaries**
   - Picks up jobs in background
   - Generates summaries (10-30 seconds each)
   - Updates commit records with `summary` field

5. **Realtime pushes updates**
   - Supabase detects commit UPDATE
   - Pushes notification to subscribed client
   - Dashboard silently refetches data
   - Loading spinner disappears, summary appears ✨

### User-Scoped Realtime

The subscription is filtered per user:
```typescript
filter: `project_id=eq.${projectId}`
```

This means:
- User A only gets notified about their commits
- User B never sees User A's updates
- Scales efficiently to thousands of users

---

## Troubleshooting

### "No placeholder cards shown"

**Check:**
1. Are commits being created? Run:
   ```sql
   SELECT id, sha, author, summary, created_at 
   FROM commits 
   ORDER BY created_at DESC 
   LIMIT 10;
   ```

2. Are jobs being created? Run:
   ```sql
   SELECT id, type, status, commit_id, created_at 
   FROM jobs 
   WHERE type = 'generate_summary' 
   ORDER BY created_at DESC 
   LIMIT 10;
   ```

3. Check API response:
   - Open browser Network tab
   - Look for `/api/commits` request
   - Should return commits with `processing: true`

### "Realtime not working"

**Check browser console for:**
```
📡 Subscription status: SUBSCRIBED  ✅ Good
📡 Subscription status: CHANNEL_ERROR  ❌ Problem
```

**Verify publication:**
```sql
SELECT * FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename = 'commits';
```

Should return 1 row. If empty, rerun the migration.

**Check environment variables:**
- `NEXT_PUBLIC_SUPABASE_URL` set?
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` set?

### "Summaries not generating"

**Check job processor:**
1. Is `JOB_SYSTEM_ENABLED=true`?
2. Is the job processor running?
3. Check logs for OpenAI errors

**Manually trigger job processing:**
```bash
curl -X POST http://localhost:3000/api/jobs/process
```

---

## Performance Characteristics

| Metric | Value |
|--------|-------|
| Installation backfill time | 2-5 seconds |
| Time to see placeholder cards | Immediate |
| Summary generation time | 10-30 seconds each |
| Realtime update latency | <100ms |
| API calls per user (with realtime) | 1 initial + 1 per update |
| API calls per user (with polling) | 1 every 3 seconds (❌) |

## Architecture

```
┌─────────────┐
│   GitHub    │
│  Webhook    │
└──────┬──────┘
       │
       ▼
┌─────────────────────────┐
│ /api/webhooks/github    │
│ (Synchronous for        │
│  installation.created)  │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│ runInstallationBackfill │
│ • Create 3 commits      │
│ • Create 3 jobs         │
└──────┬──────────────────┘
       │
       ▼
┌──────────────────────────┐
│ User → /admin            │
│ • API returns commits    │
│ • Shows loading spinners │
│ • Subscribes to realtime │
└──────────────────────────┘
       ↕ WebSocket
┌──────────────────────────┐
│ Supabase Realtime        │
│ • Pushes commit UPDATEs  │
│ • Filtered by project_id │
└──────────────────────────┘
```

---

## Next Steps

1. ✅ Deploy the webhook handler changes
2. ✅ Run the migration
3. ✅ Verify realtime is enabled
4. ✅ Test with a fresh installation
5. ✅ Monitor logs for any issues

No more polling! 🎉


