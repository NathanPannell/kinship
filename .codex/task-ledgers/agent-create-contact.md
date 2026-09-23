# Agent contact creation

## Goal

Add contact creation to the authenticated agent API with only `name` required, duplicate names allowed, and omitted priority and cadence defaulting to low and 60 days. Update the public API reference and playground, verify a deployed journey, and release to the stable app.

## Checkpoints

- [x] Inspect repository instructions, existing contact routes, schema, and deployment configuration.
- [x] Implement and test route, defaults, OpenAPI spec, and playground.
- [ ] Audit automatic deployment triggers and push a draft PR.
- [ ] Create and browser-test an isolated preview at the exact PR head.
- [ ] Merge, deploy production, and browser-test contact creation at the stable URL.
- [ ] Remove preview resources and verify stable absence.

## Notes

- No migration is needed: names already have no uniqueness constraint. LinkedIn URLs remain unique.
- Test with synthetic contacts in the isolated preview. In production, remove any synthetic contact after verification.
- Keep credentials out of the repository, logs, and PR evidence.
- Local checks: 40 tests passed, 3 skipped because integration database variables were unavailable; ESLint, TypeScript, and Next.js production build passed.
- Live GitHub audit found zero workflows and zero webhooks. Existing Vercel deployment inventory shows explicit production deploys and no feature/PR previews from the previous release.
