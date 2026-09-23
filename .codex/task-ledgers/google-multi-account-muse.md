# Google sign-in and account isolation`n`n- Dedicated Google Cloud project and OAuth client`n- Per-account data ownership for all routes and tokens`n- Public privacy, terms, and data deletion pages`n- Meta Muse custom connector compatibility`n- Verify locally and on deployed URL`n
- Google Cloud project created: Kinship CRM (kinship-crm-509522), project number 956079943627
- OAuth branding setup awaiting user confirmation of Google API Services User Data Policy
- Existing owner account identified in Cloud Console; migration claim will require verified email matching LEGACY_OWNER_EMAIL
- Implemented self-service account deletion endpoint and Settings UI; focused test passes (2 cases)
- Attached verified kinship.nathanpannell.com domain to existing Vercel networking-crm project; HTTPS /login returned 200
- Local checks: 61 unit tests pass (3 DB integration skipped), TypeScript and production build pass; independent security review identified issues addressed in auth claim
- Production Vercel env set: LEGACY_OWNER_EMAIL and GOOGLE_REDIRECT_URI; Google client credentials still pending Cloud consent setup
- Isolated Neon schema-only branch br-green-cake-akxjzvuy: migrations 001-006 applied; 11 integration/boundary tests passed; branch deleted and GET returned 404
