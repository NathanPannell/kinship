# People bulk actions, API docs, and final setup

## Goal

Ship selection-scoped bulk actions and a docs/playground screen. After deployed verification, replace the live contact list with the exact 57-person selection from the supplied onboarding text and LinkedIn export.

## Checkpoints

- [x] Read the supplied final selection and inspect the current app.
- [x] Audit the GitHub workflow inventory and local Vercel Git setting before feature push.
- [x] Validate the 57-person manifest against both exports, including dates and exact preferences.
- [x] Implement People selection actions, all-contact reset, and API docs/playground.
- [ ] Run local tests, build, and independent review.
- [ ] Create and browser-test an isolated deployed preview of the exact PR head.
- [ ] Merge and deploy the tested code to the stable production URL.
- [ ] Browser-test production, including selection-scoped updates, reset, and API playground.
- [ ] Delete all production contacts and import the exact final 57.
- [ ] Verify all names, profile links, priority, cadence, and imported last-contact dates.
- [ ] Remove owned preview resources and close test browser tabs.
