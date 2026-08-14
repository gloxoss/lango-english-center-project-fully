# Section 09: Verification & Golden Dataset Tests

## Overview
This section executes end-to-end testing, golden-dataset formula validation, security entitlement audits, Docker image compilation, and full system regression checks.

## Risk: green - Test execution & Docker validation
Running verification tools and automated test suites. Low risk.

## Dependencies
- **Depends on:** all prior sections (01..08)
- **Blocks:** none (final section)
- **Parallel batch:** 5

## TDD Test Stubs
- Test: `npm test` runs with 0 failures across all reporting service unit tests.
- Test: `npx tsc --noEmit` returns 0 type compilation errors across the entire repository.
- Test: `docker compose build app` completes cleanly.
- Test: Golden-dataset formulas (receivables aging, class occupancy percentages, balance sheet balance equality, attendance rates) match exact manual calculations.

## Tasks

<task type="auto" id="09-01">
  <name>Run automated unit and integration test suite</name>
  <files>src/addons/advanced-reporting/tests/unit/catalog.test.ts, src/addons/advanced-reporting/tests/unit/run-engine.test.ts, src/addons/advanced-reporting/tests/unit/exporters.test.ts, src/addons/advanced-reporting/tests/integration/api-security.test.ts</files>
  <action>
    Create unit and security integration test suites for catalog, run engine, CSV/XLSX formula escaping, and entitlement check enforcement. Run test runner and verify 100% pass rate.
  </action>
  <verify>Run `npm test` and verify all tests pass with 0 errors.</verify>
  <done>Automated unit and integration tests passing cleanly.</done>
</task>

<task type="auto" id="09-02">
  <name>Perform Golden-Dataset formula & reconciliation audit</name>
  <files>src/addons/advanced-reporting/tests/golden-dataset.test.ts</files>
  <action>
    Author golden-dataset test verifying:
    1. Fee receivables aging totals match invoice balance totals.
    2. Balance sheet equation Assets = Liabilities + Equity holds.
    3. Attendance overview denominators account for un-marked registers.
    4. Credential status report contains 0 plain passwords or hashes.
    5. HR payroll summary suppresses small groups (< 3 staff).
  </action>
  <verify>Run `npx vitest run golden-dataset.test.ts` (or jest/npm test equivalent) and verify assertions.</verify>
  <done>Golden-dataset formulas and security rules verified.</done>
</task>

<task type="auto" id="09-03">
  <name>Run full TypeScript compilation check</name>
  <files>none</files>
  <action>
    Run `npx tsc --noEmit` across the entire codebase to verify zero syntax, type mismatch, or missing import errors.
  </action>
  <verify>Confirm `npx tsc --noEmit` finishes with 0 errors.</verify>
  <done>TypeScript typecheck clean across entire project.</done>
</task>

<task type="auto" id="09-04">
  <name>Rebuild Docker containers and verify container health</name>
  <files>none</files>
  <action>
    Run `docker compose build app` and bring up the container via `docker compose up -d --no-deps app`. Confirm application health and responsiveness.
  </action>
  <verify>Check container status (`docker ps`) and make an HTTP request to `/api/addons/reporting/catalog`.</verify>
  <done>Docker build successful and app container verified running.</done>
</task>
