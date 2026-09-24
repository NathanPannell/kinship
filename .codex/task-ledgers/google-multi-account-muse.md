# Google sign-in, account isolation, and Muse

- Google Cloud project `kinship-crm-509522` and production web OAuth client created.
- Google OAuth branding includes the deployed homepage, privacy policy, terms, and authorized `nathanpannell.com` domain.
- Search Console domain ownership verified with a Vercel DNS TXT record. Keep that record to retain verification.
- OAuth audience is external and **In production**. The owner completed a live Google sign-in.
- Vercel production uses `kinship.nathanpannell.com` and the OAuth credentials are in production environment variables.
- Neon migrations 001 through 007 applied. Existing 59 contacts belong to the owner account, and the owner Google identity claimed that account.
- Account ownership is enforced across contacts, interactions, imports, suggestions, photos, and API tokens. The temporary legacy owner defaults were removed after deployment.
- Public privacy, terms, data deletion, Muse connector, and OpenAPI pages return 200 in production.
- Local checks: 61 unit tests pass (3 database integration tests skipped without a DB), TypeScript, lint, and build passed. Isolated Neon branch integration and boundary tests passed, then the branch was deleted.
- PR #7 merged as commit `15795dec112473e2afb819e9858e7cb90628d849`. Production deployment is live and browser tested.
- Migration 007 and deployed screenshots merged in PR #8. Final public and authentication boundary review found no release blocker.
