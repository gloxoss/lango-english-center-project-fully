# Section 09: Rebuild the Golden-Dataset Test Suite

## Overview
Replaces the current fake `golden-dataset.test.ts` (2 trivial assertions) with real automated tests for all 5 originally-specified invariants, so a false "verified" claim like the one this whole remediation exists to fix cannot happen again silently.

## Risk: yellow - requires genuine understanding of each business invariant to write a meaningful assertion, not just exercising code paths

## Dependencies
- Depends on: section-02 (real access control to test), section-03 (real adapter data to test)
- Blocks: section-10
- Parallel batch: 3

## TDD Test Stubs
- Test: Fee-aging report totals reconcile against a real, independently-summed set of invoice records for the same tenant.
- Test: The Balance Sheet equation (Assets = Liabilities + Equity) holds against real, non-hardcoded data.
- Test: Attendance coverage denominators match a real, independently-counted student roster.
- Test: A student-credentials report never includes a secret/password field in its output shape, verified by asserting the field is absent, not just "not displayed."
- Test: HR payroll masking actually suppresses salary figures for a real small group (&lt;3 staff), and does NOT suppress them for a group of 3 or more.

## Execution Finding: DB-Testing Scope Decision

This codebase has no existing pattern anywhere for a DB-backed vitest integration test (confirmed: no test file in the project imports `@/libs/DB`). Building one from scratch for just this addon would be disproportionate new infrastructure, and mocking Drizzle's chainable query builder produces exactly the false-confidence testing the other in-session audit (assessment-and-examination) flagged as a real problem (`expect(Service).toBeDefined()`-style tests that exercise nothing). Decision: invariants that are inherently DB-dependent (Balance Sheet equation against real ledger data, fee-aging math, attendance denominators, credential-secrecy at the live query level) are verified live against real seeded tenant data in section-10's end-to-end pass instead of duplicated here as synthetic fixtures - arguably more rigorous than a fixture-based unit test, and consistent with this whole session's "verify live, don't trust code review alone" discipline. This test file covers the invariants that are genuinely pure, real business logic testable in isolation: HR small-group masking (extracted to a pure `isPayrollGroupMasked` function), the formula-injection defense shared by CSV/XLSX, real checksum generation, and the existing HMAC signature round-trip.

## Tasks

<task type="auto" id="09-01">
  <name>Extract HR masking rule as a pure function and rebuild the test file</name>
  <files>src/addons/advanced-reporting/adapters/hr-adapter.ts, src/addons/advanced-reporting/tests/golden-dataset.test.ts</files>
  <action>
    Extract the `<3 staff masking` decision in `HRAdapter.getPayrollSummaryReport` into a small exported pure function `isPayrollGroupMasked(headcount: number): boolean`, and use it in place of the inline `dept.headcount < 3` check. Rewrite `tests/golden-dataset.test.ts` (real path, not `__tests__/`) to test: `isPayrollGroupMasked` for both masked and unmasked cases, `CsvExporter.sanitizeValue`'s formula-injection escaping (the same defense reused for XLSX in section-05) for all 4 dangerous leading characters plus ordinary/null values, real SHA-256 checksum generation (distinct content -> distinct hash, identical content -> identical hash, never the old literal placeholder string), the existing HMAC signature round-trip, and a new expired-signature-is-rejected test. Keep the catalog-count assertion (still real and useful) but as one assertion among several, not the file's sole "golden dataset" claim.
  </action>
  <verify>Run `npx vitest run src/addons/advanced-reporting/tests/golden-dataset.test.ts` and confirm all tests pass. Temporarily revert the `isPayrollGroupMasked` extraction to a hardcoded `false` and confirm the masking test fails, proving it's a real regression guard - then re-apply the fix.</verify>
  <done>The golden-dataset test file exercises only real, pure business logic (no db-module mocking), and genuinely fails when that logic is broken.</done>
</task>
