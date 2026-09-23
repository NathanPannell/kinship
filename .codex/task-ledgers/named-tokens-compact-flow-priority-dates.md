# Named tokens and relationship flow refinement

## Goal

Ship named API tokens and self-serve agent setup, compact selection controls in People and onboarding, priority-led varied suggestions, and person photo uploads. Verify on an isolated deployed preview, then release to the stable app.

## Checkpoints

- [x] Read repository and delivery instructions, current code, and provider configuration.
- [x] Clarify the date distribution: a truncated bell curve inside ±33%, with 75% of draws in the central half.
- [x] Check current official WhatsApp profile-photo API support.
- [x] Review and integrate implementation from parallel work.
- [x] Run migration and focused local tests, lint, build, and visual QA.
- [x] Push a draft PR after auditing automatic deployment triggers.
- [x] Create and Chrome-test an isolated preview of the exact PR head.
- [x] Merge, migrate production, deploy to the stable URL, and Chrome-test affected journeys.
- [x] Remove preview resources and verify stable absence.

## Notes

- Production contact data must remain intact during tests; use synthetic contacts in the isolated preview.
- Screenshot comparisons are stored under `.codex/evidence/` and will be posted on the PR.
- The public OpenAPI JSON is the agent's machine-readable route reference. Raw named tokens are displayed once and stored only as hashes.

## Delivery

- PR: https://github.com/NathanPannell/networking-crm/pull/5
- Browser-tested PR head: `a48aee3a0abc8e48a0788daf4695c04d3b04bb3a`
- Production revision: `33ce0c328d676c9a68017d60ba8ebef64c6c89b6`
- Local checks: 37 tests passed with the development database, lint, TypeScript, production build, and UI detector.
- Preview Chrome: synthetic onboarding, scoped bulk settings, stable People bar, priority suggestions, five agent endpoints, public OpenAPI, token create/revoke, photo upload/remove, and mobile width passed with zero page errors.
- Production Chrome: named token and revoke, five agent endpoints, photo upload/remove, People bar, onboarding file flow, and mobile width passed. One synthetic contact and token were removed. The original 57 contacts remained unchanged.
- Isolated Vercel deployment and Neon branch removed, with three consecutive full provider inventory absence checks.
