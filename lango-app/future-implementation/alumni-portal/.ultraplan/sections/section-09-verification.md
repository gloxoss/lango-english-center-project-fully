# Section 09: Final Verification

## Overview
Closes out the plan with the same independent, live re-verification discipline used throughout this session — never trusting a self-reported "done." Confirms all 8 sections work end to end and that no existing feature (student login, admissions, promotions, guardian features) broke.

## Risk: green - verification only, no new production logic

## Dependencies
- **Depends on:** section-01 through section-08 (all)
- **Blocks:** none
- **Parallel batch:** 5

## TDD Test Stubs
- Test: A full real lifecycle works end to end: transition a real student → they log in as alumni → see records → verify a document publicly → RSVP an event → set directory consent → appear correctly in directory → list themselves as a mentor → submit and get a request approved.
- Test: Every route added or changed rejects a cross-tenant reference with a 4xx, never a silent success.
- Test: Every pre-existing feature this plan builds alongside (student login for non-transitioned students, admission approval, promotions, guardian features) still works exactly as before.

## Tasks

<task type="auto" id="09-01">
  <name>Typecheck and full Docker rebuild</name>
  <files>none</files>
  <action>
    Run `npx tsc --noEmit` across the whole project — 0 errors required. Run `docker compose build app` and `docker compose build migrate` in the foreground. Confirm migration 0061 is applied.
  </action>
  <verify>tsc clean, both Docker builds succeed, app container starts and responds.</verify>
  <done>The full codebase, including the entire alumni portal, typechecks and builds cleanly in Docker.</done>
</task>

<task type="auto" id="09-02">
  <name>Live end-to-end lifecycle verification</name>
  <files>none</files>
  <action>
    Against the running container and a real tenant: create a real test student, transition them to alumni (section-02), log in as the new alumni account, exercise every route from sections 03-08 in sequence (profile, announcements, records, public verification, RSVP, directory consent + search with a second real alumni test account, mentoring listing + browse, submit + approve a request of each type). Confirm real database state at each step via psql, not just HTTP 200s.
  </action>
  <verify>Every step produces the expected real row/state change. Document any failure found and fix before proceeding.</verify>
  <done>The complete alumni lifecycle is confirmed live-working against a real database, not assumed from code review.</done>
</task>

<task type="auto" id="09-03">
  <name>Cross-tenant isolation sweep</name>
  <files>none</files>
  <action>
    Using a second real tenant's admin/alumni accounts, probe every new route from sections 02-08 with the first tenant's real IDs (documents, events, requests, alumnus IDs) — confirm every one is rejected (404/422) rather than leaking data.
  </action>
  <verify>Every cross-tenant probe is rejected. Document and fix any that isn't.</verify>
  <done>Tenant isolation is confirmed on every new route, not assumed from the route convention alone.</done>
</task>

<task type="checkpoint" id="09-04">
  <name>Confirm no regressions in prior real features</name>
  <files>none</files>
  <action>
    Re-run a smoke check on: a non-transitioned student's login and dashboard access, admission approval end to end, a real promotion "graduate" decision (confirm it still behaves as before — closes placement only, does NOT touch role, since this plan's alumni transition is deliberately a separate action), guardian household features from the prior plan. Present results to the user for confirmation.
  </action>
  <verify>User confirms every pre-existing feature still behaves exactly as before this plan.</verify>
  <done>No regressions found; user has confirmed the alumni portal build is complete.</done>
</task>
