# Networking CRM

A small personal networking inbox. The home page shows up to three contacts due for outreach, with their last interaction and a plain-language reason. People and profile screens cover search, editing, fast interaction logging, snoozing, and LinkedIn CSV import. Nothing sends messages automatically.

## Architecture

One Next.js App Router application runs on Vercel. Server route handlers use the Neon serverless Postgres driver over HTTP. SQL lives in `src/lib/data.ts`; ordered migrations live in `database/migrations`. Recommendation ranking is isolated in `src/lib/recommendations.ts`. There is no ORM, worker, cron, or background polling. Neon can suspend between requests.

## Environment variables

Copy `.env.example` to `.env.local` for local development. Do not commit real values.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon pooled connection URL for the web app |
| `DATABASE_URL_UNPOOLED` | Direct Neon URL for migrations |
| `DEVELOPMENT_DATABASE_URL` | Separate development branch URL, used only by the fictional seed script |
| `SESSION_SECRET` | Random secret of at least 32 characters for signed login cookies |
| `APP_PASSWORD` | Optional private password of at least 16 characters |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | GitHub OAuth app credentials |
| `ALLOWED_GITHUB_ID` | Numeric GitHub user ID allowed to sign in, recommended |
| `ALLOWED_GITHUB_LOGIN` | Optional login-name allowlist fallback |
| `AGENT_API_TOKEN` | Optional legacy bearer token of at least 32 characters |
| `APP_REVISION` | Optional deployed Git commit SHA shown by `/api/ready` |

Configure at least one sign-in method: `APP_PASSWORD` or GitHub OAuth. Sign in to create named agent tokens on the API page. `AGENT_API_TOKEN` remains available for existing integrations.

## Local setup

1. `npm install`
2. Create a Neon project and copy its pooled and direct URLs into `.env.local`.
3. Load the environment variables in your shell, then run `npm run migrate`.
4. For a separate development branch, set `DEVELOPMENT_DATABASE_URL` and run `npm run seed` to add fictional contacts. The seed script refuses to run when `NODE_ENV=production` and never uses `DATABASE_URL`.
5. `npm run dev`, then open `http://localhost:3000`.

Run `npm test`, `npm run lint`, and `npm run build` before deploying. Migrations are safe to rerun. Use a separate Neon development branch if you want fake contacts without putting them in your personal production data.

## GitHub sign-in

Create an OAuth app in GitHub Developer settings. Set the homepage to your Vercel production URL and the callback to `<production-url>/api/auth/github/callback`. Set its client ID and secret in Vercel, and set `ALLOWED_GITHUB_ID` to your numeric GitHub user ID. The login flow requests no additional GitHub scopes and stores only a signed local session cookie. No GitHub token is persisted.

The private password can be used before an OAuth app is configured. The GitHub sign-in button is available only when its credentials are configured.

## Vercel deployment

Create a Vercel project for this repository, set the production environment variables, and deploy the `main` branch. Run `npm run migrate` against the production Neon branch before first use. Keep `AGENT_API_TOKEN`, `SESSION_SECRET`, OAuth secret, password, and database URLs server-only. Do not add them with a `NEXT_PUBLIC_` prefix. `/api/ready` checks the latest applied migration when called; no automated health polling is configured.

## Draft PR preview lifecycle

This repository has one Vercel app and one Neon database. It has no Railway service, worker, staging branch, or staging database. The preview wrapper validates a draft PR against the current `main` commit and creates a schema-only Neon branch from the recorded **development** branch. It then creates a fresh database, applies migrations, and explicitly deploys the PR head to Vercel Preview. It never copies development contacts or persistent application secrets. GitHub OAuth is disabled in previews; a unique password and agent token are generated for each preview.

Run these commands from a clean canonical repository checkout at the current `origin/main` commit. The default invocation is a provider-free plan:

```powershell
pwsh -File scripts/preview-pr.ps1 -PullRequest 123
pwsh -File scripts/preview-pr.ps1 -PullRequest 123 -Apply
pwsh -File scripts/teardown-preview-pr.ps1 -PullRequest 123
pwsh -File scripts/teardown-preview-pr.ps1 -PullRequest 123 -Apply
```

Before pushing a preview branch, audit live GitHub workflow triggers and Vercel Git integration settings. Feature pushes and PR creation must create no automatic deployment. Also review Vercel system variables for external cloud trust and protection bypasses. Set `NEON_API_KEY` and `VERCEL_TOKEN` in the trusted local PowerShell process before `-Apply`; do not place them in the repository. The wrappers use the checked-in IDs in `scripts/preview-config.psd1`. Review those IDs if provider projects or the development parent change. The same Windows host and user profile owns create and teardown.

The journal, lock, and encrypted preview login values live in `../preview-lifecycle/pr-<number>/`, outside the Git repository. The password and agent token in `preview-credentials.dpapi.json` can be decrypted only by the creating Windows user profile; load them directly into browser or API testing tools without printing them. The journal has IDs and checkpoints only. Do not run another create while its active record exists. If create stops after a provider call, inspect the journal and run the exact teardown command; the teardown resolves uncertain responses by unique release metadata and records three consecutive complete inventory observations before marking cleanup complete. Keep the preview until its browser journey and any intended persistent release have been verified. A successful `/api/ready` check alone does not complete browser verification.

## LinkedIn CSV import

Export your official Connections and messages CSV files from LinkedIn, then open **Import** in the app. Each file is parsed in the browser. Review the matched dates, choose the people to track, set priority and cadence, and save only the selected contact metadata. The files and message text are not uploaded. No scraping or LinkedIn automation is used.

## Agent API

Open **API**, enter a name, and select **Create token**. Copy the token when it appears; only its hash is stored and the secret is not shown again. The same page lists tokens and lets you revoke them immediately. Send `Authorization: Bearer <token>` to:

- `GET /api/agent/suggestions` for today's contacts and upcoming contacts
- `GET /api/agent/contacts?search=...` for search and filters
- `POST /api/agent/contacts` to create a contact with only `name` required; names may repeat, and omitted priority and cadence default to `low` and `60` days
- `GET /api/agent/contacts/{id}` for a profile and recent interactions
- `PATCH /api/agent/contacts/{id}` to update a profile or its follow-up settings
- `POST /api/agent/interactions` with `contact_id`, `channel`, `note`, and optional ISO `occurred_at`

The interactive API documentation and playground are at `/api-docs`; the public machine-readable OpenAPI 3.1 document is at `/openapi.json`. Give your agent the app base URL, the OpenAPI URL, and a token. The API page has a **Copy agent setup** action for the endpoint instructions. The agent API cannot delete contacts or send messages.
