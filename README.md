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
| `AGENT_API_TOKEN` | Random bearer token of at least 32 characters |
| `APP_REVISION` | Optional deployed Git commit SHA shown by `/api/ready` |

Configure at least one sign-in method: `APP_PASSWORD` or GitHub OAuth. The agent token is independent of browser sign-in.

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

## LinkedIn CSV import

Export your official Connections CSV from LinkedIn, then open **Import** in the app. Upload the CSV and review the counts before committing. The importer accepts common heading variants, normalizes LinkedIn profile URLs, and uses them as the preferred deduplication key. It fills missing company, role, email, or URL values on matches; it preserves notes, cadence, priority, and interaction history. The upload limit is 4 MB. No scraping or LinkedIn automation is used.

## Agent API

Send `Authorization: Bearer <AGENT_API_TOKEN>` to:

- `GET /api/agent/suggestions` for today's contacts and upcoming contacts
- `GET /api/agent/contacts?search=...` for search and filters
- `GET /api/agent/contacts/{id}` for a profile and recent interactions
- `POST /api/agent/interactions` with `contact_id`, `channel`, `note`, and optional ISO `occurred_at`

The machine-readable OpenAPI 3.1 document is at `/openapi.json`. The agent API cannot edit or delete contacts and cannot send messages.
