# Email Notifications

This document explains how to configure and send email digests using Resend.

## Prerequisites

- `RESEND_API_KEY` in your environment
- `RESEND_FROM_EMAIL` (displayed as the sender address)

## Scheduling Daily Digests

POST `/api/emails/schedule/daily`

Body (JSON):

```
{
  "projectId": "<uuid>",
  "recipients": ["a@example.com", "b@example.com"],
  "when": "<ISO timestamp optional>"
}
```

- If `recipients` is omitted, the server uses `DAILY_DIGEST_RECIPIENTS` env (comma-separated).
- If `when` is omitted, it schedules for the next 09:00 local time.

## Processing Jobs

Use the existing job processor:

- POST `/api/jobs/process`

You should run this on a schedule (e.g., cron/Cloud Scheduler/GitHub Actions) or via a long-running worker in your environment. The system enqueues jobs (including `send_email`) and the processor dequeues and executes them.

## Configure Recipients (UI)

On `/config`, add comma-separated emails in the "Email Recipients" field. These are persisted to your project’s `email_distribution_list`.

## Implementation Notes

- HTML rendering: `src/lib/email/templates/digest.ts`
- Resend client: `src/lib/email/resend-client.ts`
- Tracking table: `email_sends` (migration `src/lib/supabase/migrations/016_email_sends.sql`)

## How emails are triggered

- Daily digests are triggered by calling the scheduling endpoint (`POST /api/emails/schedule/daily`). This creates a `send_email` job with the selected recipients and commits to include.
- When the job processor runs (`POST /api/jobs/process`), it picks up pending jobs and sends emails via the Resend client.
- The digest pulls from commits that are published and not yet emailed. See `CommitService.getCommitsForEmail` (filters `is_published=true` and `email_sent=false`).

### Immediate send on summary

- When a summary is generated, the system enqueues a `send_email` job immediately if the project has recipients configured.
- Location: `src/lib/jobs/handlers/generate-summary-handler.ts` (after commit update it checks `projects.email_distribution_list` and inserts a `send_email` job with `template_type: 'single_commit'`).
- If no recipients are configured, no email job is enqueued.

## How often emails are sent

- By default, the scheduling endpoint schedules the digest for the next 09:00 local time if `when` is not provided.
- You control frequency by how often an external scheduler calls `POST /api/emails/schedule/daily` and by the `when` value you pass.
- Recommended: run your scheduler once per day, shortly after your typical commit window, or pass an explicit `when` to control timing.

## Where to view and edit the email template

- HTML template renderer is here:
  - `src/lib/email/templates/digest.ts` (function `renderDailyDigestHtml`)
- Subject/body (plain text) are composed inside the send email handler:
  - `src/lib/jobs/handlers/send-email-handler.ts` (method `formatEmailContent`)

## Is the template configurable?

- Code-level: yes. You can directly modify `renderDailyDigestHtml` to change layout/styles and extend fields displayed.
- Content-level:
  - The `template_type` supports `'single_commit' | 'digest' | 'weekly_summary'`. All currently render with the digest HTML renderer by default. You can specialize per type in `renderHtml` inside the handler.
  - Sender address via `RESEND_FROM_EMAIL`.
  - Recipients via `/config` UI (`email_distribution_list`) or by passing `recipients` to the scheduling API.

## End-to-end UX (concise)

1. GitHub push received → webhook route enqueues a `fetch_diff` job for each commit (and sets up dependencies).
2. `fetch_diff` completes → `generate_summary` runs and stores the AI summary on the commit.
3. Immediate send (if configured): the summary handler enqueues `send_email` for that commit when `email_distribution_list` is non-empty.
4. Processor picks up `send_email` → builds subject/body + HTML, calls Resend, records to `email_sends`, and marks commit `email_sent=true`.
5. Optional daily/weekly digests: an external scheduler calls `/api/emails/schedule/daily`, creating digest jobs for un-emailed, published commits.

## Known limitations (MVP)

- Batching and advanced retry/backoff logic are deferred. Current send flow records the attempt and marks commits as emailed when successful.
- A preview endpoint for templates is deferred.
- Automatic internal cron is not provided; use your platform’s scheduler to call the endpoints.

## Future improvements

- Idempotency keys for jobs (e.g., `send_commit:<commit_id>`, `digest:<date>:<project_id>`) to prevent duplicates.
- Project-level delivery preferences: toggle immediate vs digest, quiet hours, per-branch filters.
- Timezone-aware scheduling fields per project (`timezone`, `daily_send_hour`) with server-side next-run computation.
- Batched immediate sends (group several commits within a small window).
- Retry/backoff policies tuned per provider error class + dead-letter queue view.
- Preview endpoint for template rendering (auth-only, no outbound email).
- Template variants/overrides (per-project theme, optional markdown-to-HTML pipeline).
