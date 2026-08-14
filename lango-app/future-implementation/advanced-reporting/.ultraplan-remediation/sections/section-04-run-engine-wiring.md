# Section 04: Run Engine Real-Data Wiring

## Overview
Fixes `RunEngine.fetchReportData()` so all real reports route to their (now-fixed, per section-03) adapters instead of the hardcoded 2-row mock, corrects the 2 mismatched report-key strings, and implements the PRD's "not available yet" honest state for the genuinely-unbuildable Inventory reports (module disabled) instead of ever returning fake data.

## Risk: yellow - moderate wiring complexity across 27 report keys; the key-matching must be done carefully against the real catalog, not guessed

## Dependencies
- Depends on: section-01 (seeded report_definitions), section-03 (real adapters to route to)
- Blocks: section-06, section-08, section-09
- Parallel batch: 2

## TDD Test Stubs
- Test: Running `student.credentials` returns real data from `StudentAdapter.getCredentialStatusReport`, not the mock (the key mismatch is fixed).
- Test: Running `student.class_section_occupancy` (previously mismatched as `student.occupancy`) returns real data.
- Test: All 23 previously-mock-fallback report keys with a real adapter method now return real data instead of the 2-row mock.
- Test: Running any Inventory report (module disabled, no real adapter possible) returns a clear "not available yet" response, never fake data and never a raw crash.
- Test: If a report's real query genuinely throws (e.g. a bad parameter), the run is marked `failed` with the real error message, and no fallback mock data is substituted.

## Tasks

<task type="auto" id="04-01">
  <name>Build the real key-to-adapter routing table</name>
  <files>src/addons/advanced-reporting/services/run-engine.ts</files>
  <action>
    Read `catalog-definitions.ts` in full to get the authoritative list of all 27 report keys and their `executionAdapter` field. Rewrite `fetchReportData()`'s routing so every key with a real, now-correct adapter method (from section-03, spanning Student/Attendance/Fees/Financial/HR/Examination) calls that method directly, fixing the 2 previously-mismatched keys (`student.credential_status` → `student.credentials`, `student.occupancy` → `student.class_section_occupancy` - confirm exact correct key strings against the catalog file, not from memory). Remove the 2-row hardcoded mock object entirely - it must not exist as a fallback path anymore.
  </action>
  <verify>Call `fetchReportData` for each of the 23 previously-mock keys and confirm each returns adapter-shaped real data, not the old mock's `col1`/`col2` shape.</verify>
  <done>Every report key with a real adapter method is correctly routed to it, and the 2 key mismatches are fixed.</done>
</task>

<task type="auto" id="04-02">
  <name>Implement explicit "not available yet" for genuinely unbuildable reports</name>
  <files>src/addons/advanced-reporting/services/run-engine.ts, src/addons/advanced-reporting/services/readiness-checker.ts</files>
  <action>
    For the Inventory-domain report keys (whose adapter is 100% fake because the Inventory module itself is disabled per `registry.ts`), use the existing `readiness-checker.ts` (which the audit confirmed correctly reflects real addon registry state) to detect this case in `fetchReportData` and throw the same `ReportNotReadyError` used elsewhere (section-03), mapped to `ApiError(409, 'REPORT_NOT_READY', 'Ce rapport n'est pas encore disponible.')`. Additionally, catch `ReportNotReadyError` generically around every adapter call in `fetchReportData` and map it to that same 409 response - this single catch covers Inventory, `fees.fines`, `attendance.employee_summary`, and `attendance.exam_session` (all four confirmed during section-03 execution to have no real backing data model) with one honest code path, rather than a special case per report. Ensure no other code path can reach the old mock or a fake response for these keys.
  </action>
  <verify>Attempt to run an Inventory report and confirm a clear 409 "not ready" response, not a crash and not fake data.</verify>
  <done>Genuinely unbuildable reports fail honestly and distinguishably from a real error.</done>
</task>

<task type="auto" id="04-03">
  <name>Enforce real-error-only behavior on query failure and add the result-size cap</name>
  <files>src/addons/advanced-reporting/services/run-engine.ts</files>
  <action>
    Ensure the adapter-calling code in `fetchReportData` does NOT catch adapter errors and substitute any fallback data - let real errors propagate up so the run is marked `failed` with the real error message (per the PRD's no-silent-fallback decision). Add a row-count cap (50,000 rows) to the query results before returning them for on-screen preview, with the full uncapped result still used for the export-file generation path (per the PRD's "capped preview, full export" decision) - implement this as a `previewLimit` parameter distinct from the export code path added in section-05. A report that legitimately returns zero rows (e.g. no attendance records yet for a brand-new tenant) is not an error - it must still produce a valid, correctly-headered empty result (and a valid empty CSV/XLSX/PDF in section-05), never treated as a failure.
  </action>
  <verify>Force a real adapter query to throw (e.g. an invalid parameter) and confirm the run is marked `failed` with the real error surfaced, not silently replaced with mock data. Confirm a report with a very large result set is capped in preview but not in the full export.</verify>
  <done>Query failures are never silently masked, and result size is capped for preview without limiting the real export.</done>
</task>
