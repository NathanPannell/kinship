# Browser onboarding v2

## Goal

Build and ship a browser-only LinkedIn CSV onboarding flow that imports selected contacts with message-derived last-contact dates, priority, and cadence.

## Requirements

- Two separate drop zones for Connections.csv and messages.csv.
- Parse both files in the browser. Save only selected contact metadata and preferences.
- Match message dates by normalized LinkedIn profile URL, including multi-recipient rows.
- Review all contacts with select-all and individual selection.
- Configure low/normal/high priority and 7/15/30/60 day cadence in bulk or per contact.
- Continue to the existing People page after commit.
- Preserve LinkedIn links and allow manual photo/location data where supported.
- Do not scrape LinkedIn or automate profile visits. Official APIs cannot populate arbitrary connections and LinkedIn terms prohibit scraping.

## Delivery checklist

- [x] Frontend onboarding implementation
- [x] Server commit endpoint and durable imported last-contact baseline
- [x] Schema migration and shared contact model updates
- [x] Local lint, typecheck, focused tests, integration tests, and production build
- [x] Manual UI detector
- [x] Local desktop and mobile browser journey
- [x] Preview deployment and deployed browser journey
- [ ] Merge and production deployment
- [ ] Production smoke test
- [ ] Close browser tabs and report URLs/revision/limitations
