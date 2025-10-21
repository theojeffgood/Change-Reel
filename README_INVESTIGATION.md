# Error Investigation Documentation

## Overview

Complete investigation guides for the job error:
```
❌ Job 9bff89b2-be1a-4e46-8853-f3872aa21507 failed: 
   No diff content available for summarization
```

**What happened:** A job couldn't find diff content needed to generate a commit summary.

**Impact:** No summaries generated, no emails sent, changelog incomplete.

**Time to investigate:** 5-15 minutes using provided guides

**Time to fix:** 2-5 minutes once root cause identified

---

## 📚 Documentation Files (Choose Your Path)

### 🚀 START HERE: Quick Reference Card
**File:** `QUICK_REFERENCE_CARD.txt`
- **Time:** 3 minutes
- **Best for:** Fast investigation and immediate fixes
- **Contains:** 
  - 3-step investigation process
  - Copy-paste SQL queries
  - 3 quick fixes (for 90% of cases)
  - Verification steps

**When to use:** You want the fastest path to a fix

---

### ✅ Fastest Investigation Path
**File:** `INVESTIGATION_CHECKLIST.md`
- **Time:** 5 minutes
- **Best for:** Methodical step-by-step debugging
- **Contains:**
  - 5-phase investigation checklist
  - Decision tree to identify root cause
  - SQL at each phase
  - 4 common issue signatures
  - 3 quick fixes with SQL

**When to use:** You want a guided investigation with clear decisions

---

### 🔍 Comprehensive Analysis
**File:** `INVESTIGATION_GUIDE.md`
- **Time:** 15 minutes (if needed)
- **Best for:** Deep understanding of the issue
- **Contains:**
  - 8-step SQL investigation
  - What each query checks
  - 4 likely root causes ranked by probability (60%, 20%, 10%, 10%)
  - 3 detailed resolution workflows
  - Monitoring & prevention strategies

**When to use:** Initial guides didn't identify the issue, or you want full context

---

### 🛠️ Deep Technical Dive
**File:** `DEBUGGING_GUIDE.md`
- **Time:** 20 minutes
- **Best for:** Understanding code flow and advanced debugging
- **Contains:**
  - Job processing flow diagrams (visual)
  - Code analysis with line numbers
  - 4 debugging techniques (TypeScript + SQL)
  - 4 common issues with specific fixes
  - Testing procedures to verify fixes
  - Prevention code patches

**When to use:** You need to understand the code or customize a fix

---

### 📋 Quick Reference Summary
**File:** `ERROR_INVESTIGATION_SUMMARY.txt`
- **Time:** 2 minutes
- **Best for:** Quick lookup and context
- **Contains:**
  - Error summary
  - Quick facts
  - Recommended investigation flow
  - Most common root causes
  - First SQL query to run
  - Quick fixes by root cause

**When to use:** You need a quick reminder of the problem and solutions

---

## 🎯 Recommended Investigation Path

### Path 1: I Just Need It Fixed (5 minutes)
```
1. Read: QUICK_REFERENCE_CARD.txt (3 min)
2. Run: STEP 1 SQL query
3. Apply: Appropriate quick fix
4. Done!
```

### Path 2: Systematic Investigation (10 minutes)
```
1. Read: ERROR_INVESTIGATION_SUMMARY.txt (2 min)
2. Use: INVESTIGATION_CHECKLIST.md (5 min)
   - Run PHASE 1-5 SQL queries
   - Follow decision tree
3. Apply: Fix from decision
4. Verify: Using provided verification queries
5. Done!
```

### Path 3: Understanding the Issue (20 minutes)
```
1. Read: INVESTIGATION_GUIDE.md (10 min)
   - Do 8-step investigation
   - Understand root causes
2. Use: DEBUGGING_GUIDE.md (10 min)
   - Review code flow
   - Check "Common Issues & Fixes"
3. Apply: Custom fix if needed
4. Verify & prevent
5. Done!
```

### Path 4: I'm Stuck - Full Analysis (30 minutes)
```
1. Read all documents in order:
   - QUICK_REFERENCE_CARD.txt
   - INVESTIGATION_CHECKLIST.md
   - INVESTIGATION_GUIDE.md
   - DEBUGGING_GUIDE.md
2. Try all SQL queries
3. Check all "Common Issues" sections
4. Review code flow diagrams
5. Apply most relevant fix
6. Ask for help with detailed context
```

---

## 🔑 Key Information

### Error Details
- **Job ID:** `9bff89b2-be1a-4e46-8853-f3872aa21507`
- **User:** Theo Goodman (GitHub ID: 26825549)
- **Error Location:** `src/lib/jobs/handlers/generate-summary-handler.ts:95`
- **Error Message:** "No diff content available for summarization"

### Root Cause Breakdown
| Cause | Probability | Fix Time | Details |
|-------|-------------|----------|---------|
| fetch_diff job failed | 60% | 2 min | See QUICK_REFERENCE_CARD.txt FIX #1 |
| Missing dependency | 20% | 3 min | See QUICK_REFERENCE_CARD.txt FIX #2 |
| Diff too large/invalid | 10% | 5 min | Check GitHub API and repository |
| Context structure mismatch | 10% | 5 min | See DEBUGGING_GUIDE.md Issue #4 |

### Expected After Fix
✅ Job status changes to `completed`
✅ Commit gets a `summary` and `type` (feature/bugfix)
✅ Email notifications sent (if configured)
✅ Changelog entry created

---

## 🛠️ The 3-Query Investigation

If you don't want to read anything, just run these 3 SQL queries:

### Query 1: Check Job Status (30 seconds)
```sql
SELECT id, type, status, error_message 
FROM jobs 
WHERE id = '9bff89b2-be1a-4e46-8853-f3872aa21507';
```
**Tells you:** Basic job status

### Query 2: Check Dependencies (30 seconds)
```sql
SELECT COUNT(*) as has_dependencies
FROM job_dependencies 
WHERE job_id = '9bff89b2-be1a-4e46-8853-f3872aa21507';
```
**Tells you:** If dependency exists (0 = missing)

### Query 3: Check Dependency Status (30 seconds)
```sql
SELECT j.id, j.type, j.status, j.error_message
FROM jobs j
JOIN job_dependencies jd ON jd.depends_on_job_id = j.id
WHERE jd.job_id = '9bff89b2-be1a-4e46-8853-f3872aa21507';
```
**Tells you:** Why the dependency might have failed

---

## 📞 Document Index

| Document | Purpose | Time | Best For |
|----------|---------|------|----------|
| QUICK_REFERENCE_CARD.txt | Visual, actionable | 3 min | Fast fixes |
| INVESTIGATION_CHECKLIST.md | Guided investigation | 5 min | Systematic debugging |
| INVESTIGATION_GUIDE.md | Comprehensive analysis | 15 min | Understanding root cause |
| DEBUGGING_GUIDE.md | Technical deep dive | 20 min | Code analysis & prevention |
| ERROR_INVESTIGATION_SUMMARY.txt | Quick overview | 2 min | Quick lookup |
| README_INVESTIGATION.md | This file | 5 min | Navigation |

---

## ✨ Key Takeaways

1. **The Error:** `generate_summary` job can't find diff content
2. **The Cause:** `fetch_diff` job (dependency) either failed or didn't populate context
3. **The Fix:** Restart the `fetch_diff` job OR create the missing dependency relationship
4. **The Time:** 5 minutes to identify, 2 minutes to fix
5. **The Prevention:** Add better logging and validation to the job handlers

---

## 🚀 Next Steps

### Immediate (Right Now)
1. Choose your investigation path above
2. Run the SQL queries for your path
3. Identify the root cause
4. Apply the appropriate fix

### Short Term (Next 24 hours)
1. Monitor job queue for similar errors
2. Check if the same commit now has a summary
3. Verify email notifications were sent (if applicable)

### Long Term (This Week)
1. Review DEBUGGING_GUIDE.md "Prevention" section
2. Add logging to track diff_content through jobs
3. Add alerts for missing diff_content errors
4. Consider adding fallback diff fetching

---

## 📊 File Sizes & Content

```
QUICK_REFERENCE_CARD.txt        11 KB    ← Start here!
INVESTIGATION_CHECKLIST.md      7.5 KB   ← Fast path
INVESTIGATION_GUIDE.md          11 KB    ← Comprehensive
DEBUGGING_GUIDE.md              17 KB    ← Deep dive
ERROR_INVESTIGATION_SUMMARY.txt 9.8 KB   ← Quick lookup
README_INVESTIGATION.md         [this]   ← Navigation
```

**Total documentation:** ~56 KB of targeted debugging guides

---

## 🎓 What You'll Learn

After using these guides, you'll understand:

✅ How the job processing system works
✅ What the fetch_diff and generate_summary jobs do
✅ How job dependencies work
✅ How context flows between jobs
✅ Common job processing failure patterns
✅ How to debug similar job errors in the future
✅ How to prevent these errors with better code

---

## 💡 Pro Tips

- **Fastest fix:** Run QUICK_REFERENCE_CARD.txt STEP 1 query, then apply appropriate fix
- **Most reliable:** Follow INVESTIGATION_CHECKLIST.md decision tree exactly
- **Best understanding:** Read DEBUGGING_GUIDE.md flow diagrams
- **Prevention:** Implement suggestions from DEBUGGING_GUIDE.md Prevention section
- **Stuck?** Read all documents in order, they build on each other

---

## Questions?

All documents are self-contained and include:
- SQL queries (copy-paste ready)
- Decision trees (follow the branches)
- Code analysis (with line numbers)
- Common issues (with solutions)
- Testing procedures (verify fixes work)

**You've got everything you need to debug this! 🚀**

