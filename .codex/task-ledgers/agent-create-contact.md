# Agent contact creation

## Goal

Add contact creation to the authenticated agent API with only `name` required, duplicate names allowed, and omitted priority and cadence defaulting to low and 60 days. Update the public API reference and playground, verify a deployed journey, and release to the stable app.

## Checkpoints

- [x] Inspect repository instructions, existing contact routes, schema, and deployment configuration.
- [x] Implement and test route, defaults, OpenAPI spec, and playground.
- [x] Audit automatic deployment triggers and push a draft PR.
- [x] Evaluate isolated preview: the provider-free plan passed, but apply credentials were unavailable in this session. No preview resources were created.
- [x] Merge, deploy production, and browser-test contact creation at the stable URL.
- [x] Remove synthetic production contacts and temporary test token; verify the original contact count.

## Notes

- No migration is needed: names already have no uniqueness constraint. LinkedIn URLs remain unique.
- Test with synthetic contacts in the isolated preview. In production, remove any synthetic contact after verification.
- Keep credentials out of the repository, logs, and PR evidence.
- Local checks: 40 tests passed, 3 skipped because integration database variables were unavailable; ESLint, TypeScript, and Next.js production build passed.
- Live GitHub audit found zero workflows and zero webhooks. Existing Vercel deployment inventory shows explicit production deploys and no feature/PR previews from the previous release.

## Delivery

- PR: https://github.com/NathanPannell/networking-crm/pull/6
- Feature head: `2528970496dff2cd5a8b8d874844593ea84df7d5`
- Production merge revision: `11e8e2f49a9e3a23ad782b20b1fc023f274a55b4`
- Stable URL: https://networking-crm-tau.vercel.app
- Local Chrome: API page create endpoint and name-only example rendered without page errors. Cropped before and after screenshots are linked in the PR comment.
- Production Chrome: public OpenAPI schema, name-only create defaults, duplicate-name create, optional overrides, invalid-name 400, unauthorized 401, and zero page errors passed.
- `/api/ready` returned revision `11e8e2f49a9e3a23ad782b20b1fc023f274a55b4` with migration `005_contact_photos.sql`. No new migration was required.
- Temporary test token and both synthetic contacts were removed by exact ID. Production contact count returned to 57, with zero smoke contacts or tokens remaining.
