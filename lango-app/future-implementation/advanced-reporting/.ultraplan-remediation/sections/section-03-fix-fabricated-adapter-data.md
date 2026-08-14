# Section 03: Fix Fabricated Adapter Data

## Overview
Replaces every hardcoded/fake return value found by the audit with a real, tenant-scoped Drizzle query, so the adapters this addon already has can be trusted before section-04 wires them into the run engine. Directly closes the audit's most reputationally damaging finding: the "verified" Balance Sheet equation and HR payroll masking claims were fabricated constants, not real calculations.

## Risk: yellow - moderate query complexity across several domains, but no novel patterns; every fix is "replace a literal with a real query" against tables already used correctly elsewhere in this app

## Dependencies
- Depends on: none
- Blocks: section-04, section-09
- Parallel batch: 1

## TDD Test Stubs
- Test: `FinancialAdapter.getBalanceSheetReport()` returns numbers computed from real chart-of-accounts/journal-entry rows for a tenant (grouped by `accountType`), and Assets = Liabilities + Equity holds because the underlying double-entry data is balanced, not because the numbers are hardcoded.
- Test: `HRAdapter.getPayrollSummaryReport()` returns real payroll rows (grouped by role, the real available grouping dimension - no "department" column exists in this schema) from the latest `payrollPeriods` row, and the "<3 staff masking" rule actually suppresses a real small-group row's salary figures.
- Test: `FeesAdapter.getFinesReport()`, `AttendanceAdapter.getEmployeeAttendanceSummaryReport()`, and `AttendanceAdapter.getExamSessionAttendanceReport()` all throw `ReportNotReadyError` - confirmed during execution that none of the three has any real backing data model in this schema (no fines table, no staff-attendance table, and `examSeats` is a seating chart with no check-in/incident columns).
- Test: `ExaminationAdapter.getTabulationSheetReport()` and `getProgressReport()` return real assessment/exam data computed from `assessmentOutcomes` (the shared, genuinely-graded ledger).
- Test: `ExaminationAdapter.getReportCardSnapshotReport()` throws `ReportNotReadyError` when no snapshot has been generated for the requested period, instead of the previous hardcoded fallback grades.
- Test: `StudentAdapter.getClassSectionOccupancyReport()`'s `enrolled` count matches the real number of students in each class section (`user.classSectionId`), not a hardcoded 22.
- Test: `StudentAdapter.getCredentialStatusReport()`'s `isProvisioned` reflects a real row in the `account` table, not a hardcoded `true`.
- Test: Every fixed method returns different, tenant-specific data for two different tenants (Lango vs Atlas), proving it's a real query and not a shared fake constant.

## Tasks

<task type="auto" id="03-01">
  <name>Fix FinancialAdapter's fabricated Balance Sheet and Income/Expense methods</name>
  <files>src/addons/advanced-reporting/adapters/financial-adapter.ts</files>
  <action>
    Read the file in full to see the 3 already-real methods' query style (`getAccountStatementReport`/`getIncomeExpenseReport`/`getTransactionsReport`) and copy that exact style. Replace `getBalanceSheetReport()`'s hardcoded `450000/120000/330000` with a real tenant-scoped aggregation: Assets from summed real invoice/receivable balances, Liabilities from summed real payable/refund-approval balances, Equity computed as the real difference (or from a real equity-tracking source if one exists in the schema - check `financeMoney`/ledger tables used by the other 3 methods first). Replace `getIncomeVsExpenseReport()`'s hardcoded fictional months with a real monthly aggregation of `payments`/`expenses` tables, matching the date-range pattern already used in `getIncomeExpenseReport`. Also fix `getTransactionsReport` to filter `status = 'posted'`, matching the invariant the original plan specified but which the audit found missing.
  </action>
  <verify>Call both fixed methods for Lango and Atlas tenants and confirm different real numbers are returned for each, and Assets = Liabilities + Equity holds from real underlying data.</verify>
  <done>Both fabricated FinancialAdapter methods now compute from real tenant data, and the posted-status filter is applied.</done>
</task>

<task type="auto" id="03-02">
  <name>Fix HRAdapter's fully fabricated methods</name>
  <files>src/addons/advanced-reporting/adapters/hr-adapter.ts</files>
  <action>
    Replace the hardcoded 3-row department array in `getPayrollSummaryReport()` with a real tenant-scoped query against the HR/payroll tables (check `src/models/Schema.ts` for the real payroll table names, likely used by the existing HR module elsewhere in this codebase - reuse those exact table/column references, do not guess). Keep the existing `<3 staff masking` logic exactly as-is (the audit confirmed this logic itself is correct, only its input data is fake) - just point it at real query results instead of the fake array. Fix the second method the same way.
  </action>
  <verify>Call `getPayrollSummaryReport` for a tenant with a real small department (&lt;3 staff) and confirm salary figures are actually suppressed on real data, not just theoretically capable of it.</verify>
  <done>HRAdapter returns real payroll data with genuine small-group masking applied to real rows.</done>
</task>

<task type="auto" id="03-03">
  <name>Fix FeesAdapter.getFinesReport and remaining fake AttendanceAdapter methods</name>
  <files>src/addons/advanced-reporting/adapters/fees-adapter.ts, src/addons/advanced-reporting/adapters/attendance-adapter.ts</files>
  <action>
    In `fees-adapter.ts`, investigate whether a real fines/penalty/waiver data model exists anywhere in `src/models/Schema.ts` before writing a query. [Execution finding: it does not - no fines, penalty, or waiver table or column exists anywhere in this schema, unlike the other reports in this section which all have real backing tables.] Given that, `getFinesReport()` must throw the same "not ready" signal `checkDomainReadiness`-based adapters throw (see `hr-adapter.ts`'s pattern) rather than querying nonexistent tables - this report joins section-04's honest "not available yet" handling, not the "fix the query" path the other tasks in this section use. In `attendance-adapter.ts`, investigate the real schema before writing queries for `getEmployeeAttendanceSummaryReport()` and `getExamSessionAttendanceReport()`. [Execution finding: neither has a real backing data model. `attendance` table is hard-scoped to `studentId` (not null) with no staff/employee attendance table anywhere in the schema. `examSeats` exists (seat assignment: examTermId, examHallId, studentId, seatNumber, candidateNumber) but has no check-in/incident-tracking columns at all - it's a seating chart, not an attendance record, and the catalog's promised `checkInStatus`/`incidentNote` columns cannot be honestly populated from it.] Both methods must throw `ReportNotReadyError` (the same new error class used for `fees.fines`) instead of querying nonexistent data or fabricating values - these join the "not available yet" path in section-04, not the "fix the query" path.
  </action>
  <verify>Call all 3 fixed methods for two different tenants and confirm distinct, real results for each.</verify>
  <done>FeesAdapter and AttendanceAdapter no longer contain any hardcoded report data.</done>
</task>

<task type="auto" id="03-04">
  <name>Fix ExaminationAdapter's fabricated methods and StudentAdapter's hardcoded enrollment count</name>
  <files>src/addons/advanced-reporting/adapters/examination-adapter.ts, src/addons/advanced-reporting/adapters/student-adapter.ts</files>
  <action>
    In `examination-adapter.ts`, replace `getTabulationSheetReport()` and `getProgressReport()`'s hardcoded data with real queries against the assessment/exam tables (reuse the same tables the real assessment/grading engine already uses elsewhere in this codebase). Keep `getReportCardSnapshotReport`'s existing correct `SnapshotService`-first logic unchanged. In `student-adapter.ts`, fix `getClassSectionOccupancyReport()`'s hardcoded `enrolled = 22` to a real `count(*)` of students in each class section.
  </action>
  <verify>Call the two fixed ExaminationAdapter methods and confirm real exam/assessment data. Call the fixed StudentAdapter method for a class section with a known real student count and confirm the returned `enrolled` value matches exactly.</verify>
  <done>ExaminationAdapter's remaining fake methods and StudentAdapter's hardcoded count are now real.</done>
</task>
