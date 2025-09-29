### GitHub App setup (read-only, least privilege)

Follow these steps to migrate from classic OAuth to a GitHub App. This App will provide read‑only access and deliver webhooks without requiring repo‑hook write scopes.

1) Create the GitHub App
- Go to `[Settings → Developer settings → GitHub Apps → New GitHub App]` (`https://github.com/settings/apps/new`).
- App name: Change Reel (or your preferred name)
- Homepage URL: your production URL (use `http://localhost:3000` for development)
- Callback URL (for OAuth with NextAuth): `${NEXTAUTH_URL}/api/auth/callback/github`
- Webhook URL: `${NEXTAUTH_URL}/api/webhooks/github`
- Webhook secret: generate a strong secret and save it for the app and env var `GITHUB_APP_WEBHOOK_SECRET`.

2) Permissions (Repository)
- Metadata: Read-only
- Contents: Read-only
- Pull requests: Read-only (enable if you summarize PRs)
- Issues: Read-only (enable only if needed)
Do not grant any write permissions.

3) Subscribe to events
- push
- pull_request
- release
- create
- delete

4) Generate credentials
- Click “Generate a private key” and store the file securely. This becomes `GITHUB_APP_PRIVATE_KEY`.
- Note the App ID → `GITHUB_APP_ID`.
- Enable “OAuth credentials” (if not already) and note `Client ID` and create a `Client secret` → use as `OAUTH_CLIENT_ID` and `OAUTH_CLIENT_SECRET` (these will power NextAuth identity-only sign-in).

OAuth options in the GitHub App UI (what to choose and why)

- Expire user authorization tokens: Recommended ON for security. When enabled, GitHub issues short‑lived user tokens and supports refresh tokens. Our app does not use user access tokens for repository operations (identity-only sign‑in via NextAuth), so token expiration has no impact on functionality. We do not request `offline_access`, so we do not rely on refresh tokens.
- Request user authorization (OAuth) during installation: Optional but Recommended ON. This lets the installer grant identity access in the same flow. We still keep NextAuth for sessions, but this option makes the initial install + identity handoff smoother. If you prefer, you can leave it OFF and rely solely on the existing NextAuth sign‑in (`/config`).

5) Install the app
- Click “Install App” from the App page.
- Choose user or organization.
- Select “Only select repositories” and pick the repos you want the app to access.

6) Add environment variables
- Copy `./env.example` to `.env.local` (or `.env`) and fill in:
  - `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
  - `OAUTH_CLIENT_ID` and `OAUTH_CLIENT_SECRET` (reuses your existing values; they now come from the GitHub App “OAuth credentials”)
  - `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_WEBHOOK_SECRET`

Webhook secret: reuse vs. new

- Current state: The app stores a per‑project `webhook_secret` in the database and previously created repo‑level hooks programmatically. With a GitHub App, webhooks are delivered at the App level, so we use a single app‑level secret (`GITHUB_APP_WEBHOOK_SECRET`).
- Can you reuse an existing secret? Yes—if you already have a strong random string you trust, you can reuse it for `GITHUB_APP_WEBHOOK_SECRET`. Otherwise, generate a new one and enter the same value in both the GitHub App settings and your environment variable.
- Why not DB per‑project secrets anymore? App‑level webhooks cover all selected repositories. During the migration we will deprecate the per‑project secrets and switch verification to the app‑level secret.

Mapping from your current setup

- Keep: `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY`
- Add: `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_WEBHOOK_SECRET`
- Remove over time: any code/env relying on repo‑level webhook creation or per‑project webhook secrets (the migration tasks will handle this cleanup).

Notes
- Private key format: store as a single line with literal `\n` line breaks, or configure your deployment to preserve multiline secrets.
- With the App installed, do not create repository webhooks programmatically; GitHub delivers events to your Webhook URL for all selected repositories.
- Keep repo permissions read-only. If you later need write actions, update the App’s permissions deliberately.

### End-to-end walkthrough (tailored to current setup)

1) Create the App
- Use the settings above. Turn ON:
  - Expire user authorization tokens
  - Request user authorization (OAuth) during installation (recommended)
- Set the Webhook URL to `${NEXTAUTH_URL}/api/webhooks/github` and set the same value for `GITHUB_APP_WEBHOOK_SECRET` in both GitHub and your env.

2) Generate credentials
- Click “Generate a private key” → store as `GITHUB_APP_PRIVATE_KEY` (escape newlines if needed).
- Copy the App ID → `GITHUB_APP_ID`.
- From “OAuth credentials”, copy Client ID/Secret → `OAUTH_CLIENT_ID` / `OAUTH_CLIENT_SECRET` (we use these for identity-only via NextAuth).

3) Install the App
- Click “Install App” on the App page.
- Choose your user or org account, select “Only selected repositories” (recommended) and pick the repo(s).

4) Environment variables
- Update your env using `assets/env.example` as a guide. Keep your existing `NEXTAUTH_*`, `OAUTH_*`, and `TOKEN_ENCRYPTION_KEY`. Add `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_WEBHOOK_SECRET`.

5) Configure in the app UI
- Go to `/config` and sign in if prompted.
- The app fetches your installations:
  - If you have exactly one installation, it’s auto-selected and the repo list loads automatically.
  - If you have multiple, pick the account installation you want to use; then pick a repository.
- Click “Test Connection” to verify access (uses an installation token; no repo-hook checks are needed under the App model).
- Click Save; we store `installation_id` alongside the selected repository.

6) Verify webhooks
- In the GitHub App settings, ensure `push`, `pull_request`, `release`, `create`, `delete` events are enabled.
- Trigger a commit or test delivery; events should POST to `/api/webhooks/github`. We validate with `GITHUB_APP_WEBHOOK_SECRET`.

Troubleshooting
- “Invalid signature”: ensure the Webhook secret in GitHub matches `GITHUB_APP_WEBHOOK_SECRET` exactly.
- “No installations found”: ensure the App was installed and that you granted access to the intended repositories.
- Private key format errors: ensure newlines are preserved or escaped as `\n` in the env.


