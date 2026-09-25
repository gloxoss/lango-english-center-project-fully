# Section 12: End-to-end smoke tests

## Overview
`@playwright/test` and `playwright.config.ts` are already installed (`npm run test:e2e`), but there are 0 specs. Add a handful of smoke specs for the flows where a silent break costs the most. No new dependencies.

## Risk: [yellow] Needs a running app + seeded schoolos_audit. Never point it at production.

## Dependencies
- Depends on: 01 · Blocks: 14 · Batch 2 · Hub item: `task:up-12-e2e`

## Tasks

<task type="auto" id="12-01">
  <name>Five smoke specs</name>
  <files>lango-app/e2e (or the testDir in playwright.config.ts): 5 spec files max, one small login helper</files>
  <action>
    Read playwright.config.ts for testDir/baseURL. Specs (each: log in as the role, do one real action, assert the visible result):
    1 accountant records a cash payment on the collection desk → receipt appears.
    2 teacher enters a mark on their class marksheet → saved; a mark above the maximum is refused with a message.
    3 parent opens their child's attendance → sees records; opening another child's URL is refused.
    4 admin opens "Fiche élève · PDF" → a PDF renders (this broke on 2026-09-25).
    5 admin switches language to العربية → the dashboard has no raw keys and is RTL.
    Use seeded accounts from the seed script; do not create users in production-like DBs.
  </action>
  <verify>npm run test:e2e green locally against schoolos_audit; paste the summary line.</verify>
  <done>The 5 most expensive silent breaks are caught automatically.</done>
</task>
