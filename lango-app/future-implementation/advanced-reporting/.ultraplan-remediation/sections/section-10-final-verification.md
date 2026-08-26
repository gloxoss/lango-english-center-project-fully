# Section 10: Final Verification

## Overview
Closes out the remediation with the same independent, live re-verification discipline used throughout this session — never trusting a self-reported "done." Confirms all 9 prior sections genuinely work end to end against the real running app and real database, and that no cross-tenant leakage exists anywhere in the addon.

## Risk: green - verification only, no new production logic

## Dependencies
- Depends on: section-01 through section-09 (all)
- Blocks: none
- Parallel batch: 4

## TDD Test Stubs
- Test: A full real lifecycle works end to end for each role (admin, teacher, accountant): browse catalog → run a report → see real data → export CSV/XLSX/PDF, all genuinely valid files → save a view → favorite a report → create a schedule → the schedule actually fires and produces a real run.
- Test: Every reporting route rejects a cross-tenant reference with a 4xx, never a silent success or data leak, verified with a second real tenant the same way every other feature in this session has been tested.
- Test: Every pre-existing feature this addon sits alongside (student/staff data, finance, HR features it reads from) still works exactly as before - this addon only reads from those, so no regression should be possible, but confirm anyway.

## Tasks

<task type="auto" id="10-01">
  <name>Typecheck, tenant-isolation script, and full Docker rebuild</name>
  <files>none</files>
  <action>
    Run `npx tsc --noEmit` - 0 errors required. Run `npx tsx scripts/check-tenant-isolation.ts` and fix anything it flags in the reporting addon's files specifically (ignore pre-existing unrelated flags from other in-progress work, same discipline as every prior verification in this session). Run `docker compose build app` and `docker compose build migrate` in the foreground, confirming genuine success (not a pipe-masked false success - check the real build log, not just the shell exit code of a piped command).
  </action>
  <verify>tsc clean, isolation script clean for this addon's files, both Docker builds genuinely succeed, the app container starts and responds.</verify>
  <done>The full codebase, including the entire remediated reporting addon, typechecks, passes tenant-isolation checks, and builds cleanly in Docker.</done>
</task>

<task type="auto" id="10-02">
  <name>Grant a temporary test entitlement and run the live end-to-end lifecycle</name>
  <files>none</files>
  <action>
    Grant the advanced-reporting addon entitlement to the SchoolOS test tenant via the app's own real entitlement-granting mechanism (temporarily, for verification purposes only - per the PRD, actually turning this on for a real school long-term is a separate later decision). Log in as a real admin, teacher, and accountant test account in turn and exercise the full lifecycle from the TDD stub above for each role, confirming real database state via psql at each step (not just HTTP 200s) - a real run produces a real `report_runs` row with real data, a real export file exists on disk with a real checksum, a real schedule actually fires via the worker built in section-06.
  </action>
  <verify>Every step produces the expected real row/state change, confirmed via psql, not assumed from a 200 response.</verify>
  <done>The complete reporting lifecycle is confirmed live-working against the real database for every named role.</done>
</task>

<task type="auto" id="10-03">
  <name>Cross-tenant isolation sweep</name>
  <files>none</files>
  <action>
    Using a second real tenant's (Atlas) admin/staff accounts, probe every reporting route with the first tenant's (SchoolOS) real IDs (run IDs, schedule IDs, saved-view IDs, report keys where relevant) - confirm every one is rejected rather than leaking data, matching the sweep pattern already used successfully for the alumni-portal work earlier this session.
  </action>
  <verify>Every cross-tenant probe is rejected with a 4xx and no data leakage. Document and fix any that isn't before considering this section done.</verify>
  <done>Tenant isolation is confirmed live on every reporting route, not assumed from the route convention alone.</done>
</task>

<task type="auto" id="10-04">
  <name>Revoke the temporary test entitlement and present results</name>
  <files>none</files>
  <action>
    Revoke the temporary entitlement granted in task 10-02, restoring the addon to its pre-verification state (0 real tenant entitlements), per the PRD's decision that activation is a separate later choice, not part of this remediation. Present a summary of all verification results to the user.
  </action>
  <verify>Query `addon_entitlements` for the advanced-reporting addon and confirm it's back to its pre-verification state.</verify>
  <done>Verification is complete, documented, and the addon is left in its correct default (not-yet-activated) state, with no regressions found.</done>
</task>
