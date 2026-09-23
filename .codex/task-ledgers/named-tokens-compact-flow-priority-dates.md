# Named tokens and relationship flow refinement

## Goal

Ship named API tokens and self-serve agent setup, compact selection controls in People and onboarding, priority-led varied suggestions, and person photo uploads. Verify on an isolated deployed preview, then release to the stable app.

## Checkpoints

- [x] Read repository and delivery instructions, current code, and provider configuration.
- [x] Clarify the date distribution: a truncated bell curve inside ±33%, with 75% of draws in the central half.
- [x] Check current official WhatsApp profile-photo API support.
- [ ] Review and integrate implementation from parallel work.
- [ ] Run migration and focused local tests, lint, build, and visual QA.
- [ ] Push a draft PR after auditing automatic deployment triggers.
- [ ] Create and Chrome-test an isolated preview of the exact PR head.
- [ ] Merge, migrate production, deploy to the stable URL, and Chrome-test affected journeys.
- [ ] Remove preview resources and verify stable absence.

## Notes

- Production contact data must remain intact during tests; use synthetic contacts in the isolated preview.
- Screenshot comparisons are stored under `.codex/evidence/` and will be posted on the PR.
- The public OpenAPI JSON is the agent's machine-readable route reference. Raw named tokens are displayed once and stored only as hashes.
