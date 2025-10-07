# Option B Implementation: Installation ID Filtering

## Overview

This implementation uses **installation_id** for Supabase Realtime filtering instead of project_id. This eliminates all race conditions because installation IDs are created during OAuth (before any commits or async processing).

## Why This Works

### Timeline Comparison

**Previous (project_id filtering - broken):**
```
T+0ms:   User installs app
T+100ms: Webhook queued (async)
T+500ms: User lands on /admin
T+600ms: Client fetches projects → Returns [] (backfill hasn't run)
T+700ms: No subscriptions created ❌
T+2000ms: Backfill creates projects & commits (too late!)
```

**New (installation_id filtering - robust):**
```
T+0ms:   User installs app via GitHub
T+50ms:  GitHub creates installation_id = 12345
T+100ms: OAuth callback creates installations record
T+500ms: User lands on /admin
T+550ms: Server fetches installation IDs → Returns [12345] ✅
T+600ms: Subscription created: installation_id=eq.12345
T+2000ms: Backfill creates commits with installation_id = 12345
T+2010ms: Realtime fires → Subscription receives UPDATE ✅
T+2020ms: UI updates automatically ✅
```

### Key Insight

**Installation IDs exist BEFORE commits** because they're created during the OAuth flow, not during webhook processing. This makes the timing completely independent.

## Changes Made

### 1. Database Migration

**File:** `src/lib/supabase/migrations/015_add_installation_id_to_commits.sql`

- Added `installation_id` column to `commits` table
- Backfilled existing commits from `projects.installation_id`
- Created indexes for performance
- Made column NOT NULL after backfill

### 2. Type Definitions

**File:** `src/lib/types/supabase.ts`

- Added `installation_id: number` to `Commit` interface
- Added `installation_id: number` to `CreateCommitData` interface (required)

### 3. Commit Creation (3 places)

All commit creation now includes `installation_id`:

**Files:**
- `src/lib/github/installation-backfill.ts` - Line 130
- `src/lib/jobs/handlers/webhook-processing-handler.ts` - Line 135
- `src/app/api/jobs/process/route.ts` - Line 282

```typescript
const created = await deps.commits.createCommit({
  project_id: project.id,
  sha: c.sha,
  author: '...',
  timestamp: c.date,
  installation_id: installationId, // ← Added
  is_published: false,
  email_sent: false,
})
```

### 4. Realtime Hook

**File:** `src/lib/hooks/useCommitHistory.ts`

**Changed:**
- Accepts `initialInstallationIds: number[]` prop (from server)
- Removed `fetchUserProjects()` function (obsolete)
- Removed client-side project fetching (obsolete)
- Changed filter from `project_id=eq.X` to `installation_id=eq.X`
- Changed channel names to `commit-updates-install-${installationId}`

**Key changes:**
```typescript
// OLD (broken):
export function useCommitHistory(pageSize: number = 10) {
  const [userProjectIds, setUserProjectIds] = useState<string[]>([]);
  
  useEffect(() => {
    fetchUserProjects().then(setUserProjectIds); // Client-side fetch
  }, []);
  
  useEffect(() => {
    if (userProjectIds.length === 0) return; // Race condition!
    // Subscribe to project_id=eq.X
  }, [userProjectIds]);
}

// NEW (robust):
export function useCommitHistory(
  pageSize: number = 10, 
  initialInstallationIds: number[] = [] // From server
) {
  // No client-side fetching!
  
  useEffect(() => {
    if (initialInstallationIds.length === 0) return;
    // Subscribe to installation_id=eq.X
  }, [initialInstallationIds]); // Stable, immediate
}
```

### 5. Server-Side Fetching

**File:** `src/app/admin/page.tsx`

Server component now fetches installation IDs and passes as props:

```typescript
export default async function AdminPage() {
  let userInstallationIds: number[] = [];
  
  // Fetch installation IDs server-side (guaranteed to exist)
  const { data: installations } = await supaService.getClient()
    .from('installations')
    .select('installation_id')
    .eq('user_id', user.id);
  
  if (installations) {
    userInstallationIds = installations
      .map((i: any) => i.installation_id)
      .filter(Boolean);
  }
  
  return (
    <CommitHistoryPanel 
      initialInstallationIds={userInstallationIds} // Pass as prop
    />
  );
}
```

### 6. Client Component Props

**File:** `src/app/admin/components/CommitHistoryPanel.tsx`

```typescript
interface CommitHistoryPanelProps {
  repositoryName?: string;
  initialInstallationIds?: number[]; // New prop
}

export default function CommitHistoryPanel({ 
  repositoryName, 
  initialInstallationIds = [] 
}: CommitHistoryPanelProps) {
  const { commits, ... } = useCommitHistory(10, initialInstallationIds);
  // ...
}
```

## Code Removed (Obsolete)

1. **`fetchUserProjects()` function** - No longer needed, installation IDs come from server
2. **Client-side project fetching logic** - Replaced with server-side installation ID fetching
3. **`userProjectIds` state** - Replaced with `initialInstallationIds` prop

## Why This is Timing-Independent

### The Guarantee

**Installation records are created during OAuth, which happens BEFORE:**
- Webhook processing
- Commit backfilling
- Project creation
- User landing on /admin

### The Flow

1. **User clicks "Install App" on GitHub**
   - GitHub generates `installation_id = 12345`
   
2. **OAuth callback** (`/api/auth/github/callback`)
   - Creates `installations` record with `installation_id = 12345`
   - Links to `user_id`
   
3. **User lands on `/admin`**
   - Server fetches installations: `[12345]`
   - Props embedded in HTML
   
4. **Client hydrates**
   - Hook receives `initialInstallationIds = [12345]`
   - Creates subscription: `installation_id=eq.12345`
   
5. **Webhook processes** (async, could be seconds later)
   - Creates commits with `installation_id = 12345`
   - Realtime fires → subscription receives it ✅

## Testing Steps

1. **Run migration:**
   ```sql
   -- Apply: src/lib/supabase/migrations/015_add_installation_id_to_commits.sql
   ```

2. **Fresh install test:**
   - Uninstall GitHub App
   - Delete user/projects/commits from DB
   - Reinstall app
   - Should see:
     - ✅ Placeholder cards immediately
     - ✅ Summaries appear within seconds
     - ✅ No page refresh needed
   - Check console:
     - ✅ "Subscribed to installation: 12345"
     - ✅ "Realtime event received: INSERT commit: xyz installation: 12345"

3. **Verify subscriptions:**
   - Open browser console
   - Should see: `✅ Subscribed to installation: <id>`
   - When commits update: `🔔 Realtime event received: UPDATE commit: <id> installation: <id>`

## Performance Considerations

**Indexes created:**
- `idx_commits_installation_id` - Single column index
- `idx_commits_installation_timestamp` - Composite for sorting

**Subscription efficiency:**
- One channel per installation (most users have 1 installation)
- Filter at Postgres level before network transmission
- No polling, no unnecessary API calls

## Benefits Over Previous Approaches

| Approach | Race Condition? | Complexity | Performance |
|----------|----------------|------------|-------------|
| Client-side project fetching | ❌ Yes | Low | Poor (polling fallback) |
| Server-side project props | ⚠️ Possible | Medium | Good |
| **Installation ID filtering** | ✅ No | Low | Excellent |

## Summary

This implementation is **timing-independent** because:
1. Installation IDs are created during OAuth (synchronous)
2. Commits reference installation_id (denormalized)
3. Server fetches installation IDs (guaranteed to exist)
4. Client subscribes immediately (no waiting)
5. Realtime updates work regardless of webhook timing

**Result:** First-time users see placeholder cards that auto-update without refresh, with zero race conditions.

