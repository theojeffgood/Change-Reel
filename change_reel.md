**Product Requirements Document (PRD)**

**Product Name**: Change Reel **Prepared By**: [Theo Goodman] **Last Updated**: [June 24, 2025]

---

## **1. Overview**

**Goal**: Change Reel is a SaaS tool that automatically generates and publishes plain-English summaries of Git commit diffs. These summaries are then distributed either via email or posted to a publicly accessible changelog webpage.

**Target Audience**: Engineering teams, product managers, and stakeholders who want visibility into ongoing development without reading raw commit messages or diffs.

---

## **2. Key Features**

### 2.1 Git Integration

- Support for GitHub (MVP), with extensibility for GitLab and Bitbucket.
- Webhook-based triggers on \`\` events.
- Ability to fetch commit details and diffs using Git provider APIs.

### 2.2 Commit Analysis

- Process raw diffs and pass through OpenAI API to generate natural-language summaries.
- Detects types of changes: feature, fix, refactor, chore.
- Allow for filtering out noise (e.g., `package-lock.json`, generated files).

### 2.3 Changelog Publishing

- Option 1: Templated HTML email sent via Resend.
- Option 2: Auto-published changelog web page per project.

### 2.4 User Management

- GitHub OAuth for signup/login.
- Dashboard for managing connected repositories and changelog settings.
- Manage recipients for email notifications.

### 2.5 Admin Panel

- View generated summaries.
- Manual publishing option.

---

## **3. Technical Architecture**

### 3.1 Frontend

- **Framework**: React (with Next.js for SSR)
- **Styling**: Tailwind CSS
- **Pages**:
  - Login / Signup
  - Dashboard (list of repos & changelogs)
  - Project Detail View (commits, summaries)
  - Settings (email, domains)
  - Public Changelog Page (e.g., `changlog.company.com`)

### 3.2 Backend

- **Platform**: Next.js API Routes
- **Auth**: GitHub OAuth via `@supabase/auth-helpers/nextjs`
- **Database**: Supabase (PostgreSQL)
- **Background Jobs**:
  - Commit ingestion and diff fetching
  - LLM summarization (OpenAI API)
  - Email dispatch (Resend)
- **Deployment**:
  - Containerized via Docker
  - Hosted on AWS EC2 instance

### 3.3 External Services

- **OpenAI API**: GPT-4 Turbo for diff summarization
- **Resend**: Email delivery (with templated layout)
- **Supabase**: Auth, database, and storage

---

## **4. Data Models**

### 4.1 User

- `id`
- `email`
- `github_id`
- `access_token`
- `created_at`

### 4.2 Project

- `id`
- `user_id`
- `repo_name`
- `provider` (e.g., GitHub)
- `webhook_url`
- `email_distribution_list`
- `public_slug`
- `created_at`

### 4.3 Commit

- `id`
- `project_id`
- `sha`
- `author`
- `timestamp`
- `summary`
- `type` (feature/fix/refactor/chore)
- `is_published`
- `email_sent`
- `created_at`

## **5. Milestones / MVP Scope**

### Milestones / MVP Scope

- GitHub integration (OAuth + webhooks)
- Commit diff retrieval
- OpenAI-powered summaries
- Email delivery via Resend
- Public changelog web page
- Manual editing UI
- Admin dashboard

---

## **6. Non-Functional Requirements**

- **Performance**: Webhook-to-summary latency < 10s.
- **Security**:
  - OAuth tokens encrypted at rest.
  - Diff data is processed in-memory and never stored.
- **Scalability**: Able to support 100k+ commits/month with queued background jobs.
- **Reliability**: Email and webhook failures must retry with exponential backoff.

---

## **7. Appendix**

- Sample Prompt for OpenAI:

```
You are a changelog assistant. Summarize the following code diff into a 1–2 sentence plain English description of what changed. Be concise and skip minor edits. Input:
[DIFF GOES HERE]
```

- Sample Email Template:

```html
<h1>Weekly Changelog</h1>
<ul>
  <li><b>[commit sha]</b>: Add password reset functionality (by Jane)</li>
  <li><b>[commit sha]</b>: Fix bug in user onboarding (by Theo)</li>
</ul>
```

---

End of PRD.

