# Section 06: Final Verification

## Overview
Closes out the remediation with the same independent, live re-verification discipline used throughout this session.

## Risk: green - verification only

## Dependencies
- Depends on: section-01 through section-05 (all)
- Blocks: none
- Parallel batch: 3

## TDD Test Stubs
- Test: A full real Exam Master lifecycle works end to end: create term → create hall → allocate seats → schedule an exam (confirm a deliberate double-booking is rejected) → enter marks → see real rankings.
- Test: The online-exam answer-forgery and deadline bugs are confirmed fixed via real HTTP requests, not just code review.
- Test: A student's homework list is confirmed correctly scoped via two real, different student accounts.
- Test: Every route rejects a cross-tenant reference with a 4xx.

## Tasks

<task type="auto" id="06-01">
  <name>Typecheck, tenant-isolation script, Docker rebuild</name>
  <files>none</files>
  <action>
    Run `npx tsc --noEmit` with a real captured exit code (not through a masking pipe). Run `npx tsx scripts/check-tenant-isolation.ts` and fix anything newly flagged in this remediation's files. Rebuild the app Docker image (and migrate, if any new migration was needed) sequentially, not in parallel, with real exit codes captured.
  </action>
  <verify>tsc clean, isolation script clean for this remediation's files, both Docker builds genuinely succeed.</verify>
  <done>The full codebase typechecks, passes tenant isolation, and builds cleanly.</done>
</task>

<task type="auto" id="06-02">
  <name>Live end-to-end lifecycle and cross-tenant sweep</name>
  <files>none</files>
  <action>
    Deploy the rebuilt image. Exercise the full Exam Master lifecycle for real against the SchoolOS tenant, confirming real database state via psql at each step. Reproduce the original answer-forgery and no-deadline bugs against the live app to confirm both are now genuinely rejected. Confirm homework audience scoping with two real distinct student accounts. Then sweep every new/changed route with Atlas tenant credentials against SchoolOS's real IDs, confirming rejection.
  </action>
  <verify>Every step produces the expected real state change or rejection, confirmed via psql/HTTP, not assumed.</verify>
  <done>The complete remediation is confirmed live-working and tenant-isolated, not assumed from code review.</done>
</task>
