# Kinship

**A small personal networking CRM and the single source of truth for your professional relationships.**

Kinship keeps the people, context, and follow-up history that matter to your professional life in one place, so you and your agents know who to reconnect with before a connection grows cold.

**Use Kinship:** [kinship.nathanpannell.com](https://kinship.nathanpannell.com)

## What you can do

- Keep a personal record of contacts, profile details, notes, and past interactions.
- Set a priority and a follow-up cadence for each person. Kinship surfaces up to three people due for a touchpoint, with a plain-language reason, and shows people coming up soon.
- Import your LinkedIn Connections and messages CSV exports. Kinship reads the files in your browser so you can choose which connections to keep and use message dates to establish contact history. Message text is not uploaded or saved.
- Give an AI agent access to the same relationship records through a named, account-scoped API token that you can revoke.
- Use the OpenAPI description to connect Meta Muse or another tool that supports custom OpenAPI connectors.

Kinship helps you remember and record conversations. It does not send messages to your contacts.

## Get started

1. [Sign in with Google](https://kinship.nathanpannell.com/login). Each Google account has its own contacts, interactions, and API tokens.
2. Follow the three-step introduction, then use the Import button on your empty Today page to bring in your LinkedIn Connections CSV. You can also provide your messages CSV to match last-contact dates. Review the people, choose who to track, and set a starting priority and cadence.
3. Use **Today** to see who is due, **People** to search and manage your contacts, and a person's profile to review notes or log an interaction.
4. To connect an agent, open **API**, create and copy a named token, then provide the agent with the app URL and the [OpenAPI description](https://kinship.nathanpannell.com/openapi.json). The token secret is shown once. Revoke it from the API page whenever you want to end access.

For step-by-step instructions, see the [Meta Muse connector guide](https://kinship.nathanpannell.com/connect/muse). The guide also explains which actions the API allows.

## Agent API

Kinship's API lets an agent, acting with your permission, read and update the relationship context in the account that created the token. It can:

- Get today's follow-up suggestions and upcoming contacts.
- Search contacts and read a contact's profile and recent interactions.
- Create or update a contact.
- Record an interaction when you ask it to.

The API cannot delete contacts or send email, LinkedIn messages, WhatsApp messages, or other communications. Every data request requires a bearer token. The OpenAPI document is public and contains endpoint documentation, not account data.

Useful links:

- [API reference and request playground](https://kinship.nathanpannell.com/api-docs) (sign-in required)
- [Public OpenAPI 3.1 JSON](https://kinship.nathanpannell.com/openapi.json)
- [Meta Muse setup guide](https://kinship.nathanpannell.com/connect/muse)
- [Privacy](https://kinship.nathanpannell.com/privacy)
- [Terms](https://kinship.nathanpannell.com/terms)
- [Data deletion](https://kinship.nathanpannell.com/data-deletion)

## Privacy by design

- Google sign-in creates a separate Kinship account. Contacts, interactions, photos, imports, and API tokens are scoped to that account.
- Guided LinkedIn import parses CSV files in your browser. Only the contacts you select, their imported last-contact dates, and your preferences are saved to Kinship.
- API token secrets are shown once and stored as hashes. Tokens can be revoked from the API page.
- Connected agents receive the access granted by their token. Review write actions and only share a token with services you trust.

Read the [privacy policy](https://kinship.nathanpannell.com/privacy) for details about data storage, providers, and deletion.

## Run locally

Kinship is a Next.js application backed by PostgreSQL through Neon. SQL migrations are in `database/migrations`.

You will need Node.js and npm, a PostgreSQL database, and a Google OAuth web client for local sign-in.

1. Install dependencies:

   ```sh
   npm ci
   ```

2. Copy `.env.example` to `.env.local` and set the values below. Register `http://localhost:3000/api/auth/google/callback` as an authorized redirect URI for your Google OAuth client.

   | Variable | Purpose |
   | --- | --- |
   | `DATABASE_URL` | Pooled Neon connection URL used by the app |
   | `DATABASE_URL_UNPOOLED` | Direct Neon connection URL used by migrations |
   | `SESSION_SECRET` | Random secret with at least 32 characters |
   | `GOOGLE_CLIENT_ID` | Google OAuth web client ID |
   | `GOOGLE_CLIENT_SECRET` | Google OAuth web client secret |
   | `GOOGLE_REDIRECT_URI` | Callback URL registered with Google |
   | `DEVELOPMENT_DATABASE_URL` | Optional separate development database for fictional seed contacts |

3. Apply database migrations:

   ```sh
   npm run migrate
   ```

4. Start the app:

   ```sh
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

To add fictional contacts for local development, set `DEVELOPMENT_DATABASE_URL` to a separate development database and run `npm run seed`. The seed script refuses to run when `NODE_ENV=production` and never writes to `DATABASE_URL`.

Available project checks are `npm test`, `npm run lint`, and `npm run build`.
