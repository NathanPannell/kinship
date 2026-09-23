# People bulk actions, API docs, and final setup

## Goal

Ship selection-scoped bulk actions and a docs/playground screen. After deployed verification, replace the live contact list with the exact 57-person selection from the supplied onboarding text and LinkedIn export.

## Checkpoints

- [x] Read the supplied final selection and inspect the current app.
- [x] Audit the GitHub workflow inventory and local Vercel Git setting before feature push.
- [x] Validate the 57-person manifest against both exports, including dates and exact preferences.
- [x] Implement People selection actions, all-contact reset, and API docs/playground.
- [x] Run local tests, build, and independent review.
- [x] Create and browser-test an isolated deployed preview of the exact PR head.
- [x] Merge and deploy the tested code to the stable production URL.
- [x] Browser-test production selection-scoped updates and API playground; test the all-contact reset in the isolated preview.
- [x] Delete all production contacts and import the exact final 57.
- [x] Verify all names, profile links, priority, cadence, and imported last-contact dates.
- [x] Remove owned preview resources and close test browser tabs.

## Delivery

- PR: https://github.com/NathanPannell/networking-crm/pull/3
- Production revision: `2f8db8f558cbf52bd7df301261598031e7cc5e1a`
- Final import: 177 prior contacts snapshotted and deleted; 57 selected contacts imported and verified.
- Database check: 57 unique profiles, 20 imported last-contact dates, priority counts 12 high / 15 normal / 30 low, cadence counts 9 at 7 days / 4 at 15 / 21 at 30 / 23 at 60.
- Recovery checkpoint: `.codex/private-data/final-setup-recovery-2026-09-23T13-17-00-305Z.json` (local, ignored by Git).
