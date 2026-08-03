# UltraPlan Traceability Matrix — Data-Wiring Remediation

## Summary
- Total audit findings: 32 (1 broken + 9 mock/new-backend + 19 mock/existing-backend + 3 mock-adjacent)
- Total tasks in plan: 61
- Findings fully covered: 32 / 32
- Findings excluded (user choice): 0
- Scope explicitly excluded per PRD: ~45 NOT CHECKED pages (verification-only in Section 19, not rebuild), ~7 REAL-confirmed pages (no task needed)

## Finding-to-Task Mapping

| # | Finding | Section | Task IDs | Status |
|---|---|---|---|---|
| 1 | homework-submission-view broken + no backend | 01 | 01-01, 01-02, 01-03 | Covered |
| 2 | exam-planning-view mock, no backend | 02 | 02-01, 02-02, 02-03 | Covered |
| 3 | rooms-view mock, no backend | 03 | 03-01, 03-02, 03-03 | Covered |
| 4 | entitlements-catalog-view mock, no tenant-facing backend | 04 | 04-01, 04-02 | Covered |
| 5 | assessment-policies-view mock + dead save button | 05 | 05-01, 05-02, 05-03 | Covered |
| 6 | jobs-audit-client fake trigger | 06 | 06-03 | Covered |
| 7 | providers-client fake connection test | 06 | 06-02 | Covered |
| 8 | migration-readiness-client fake actions + hardcoded stats | 06 | 06-01 | Covered |
| 9 | header.tsx search decorative | 07 | 07-01, 07-02 | Covered |
| 10 | users-manage-view pagination dead | 08 | 08-01 | Covered |
| 11 | report-card-generator-view mock, no backend | 09 | 09-01, 09-02 | Covered |
| 12 | student-transfers-view fully static despite real backend | 10 | 10-01, 10-02 | Covered |
| 13 | classes-view mock | 11 | 11-01 | Covered |
| 14 | schedule-view mock | 11 | 11-02 | Covered |
| 15 | class-subjects-view mock | 11 | 11-03 | Covered |
| 16 | class-section-teachers-view mock | 11 | 11-04 | Covered |
| 17 | syllabus-view mock (no schema concept) | 11 | 11-05 | Covered (placeholder, not built) |
| 18 | attendance-view mock | 12 | 12-01 | Covered |
| 19 | attendance-excuses-view mock | 12 | 12-02 | Covered |
| 20 | bank-reconciliation-view mock | 13 | 13-01 | Covered |
| 21 | journal-explorer-view mock | 13 | 13-02 | Covered |
| 22 | chart-of-accounts-view mock | 13 | 13-03 | Covered |
| 23 | online-payments-view mock | 13 | 13-04 | Covered |
| 24 | pricing-structures-view mock | 13 | 13-05 | Covered |
| 25 | reminders-statements-view mock, no backend | 14 | 14-01 through 14-04 | Covered |
| 26 | fee-allocation-view mock, no backend | 14 | 14-01, 14-02 | Covered |
| 27 | financial-reports-view fake income statement/balance sheet | 15 | 15-01, 15-02 | Covered |
| 28 | parents-guardians-view mock | 16 | 16-01 | Covered |
| 29 | inquiries-kanban-view mock | 16 | 16-02 | Covered |
| 30 | admission-requests-view mock | 16 | 16-03 | Covered |
| 31 | homework-view mock | 17 | 17-01, 17-02 | Covered |
| 32 | policies-view fake save | 18 | 18-01, 18-02 | Covered |
| — | ~45 NOT CHECKED pages | 19 | 19-01, 19-02 | Verification only, not a fix |

## Scope Creep Check
No task in any section exists without a corresponding audit finding above — every task traces back to something the audit actually found, not something invented during planning.

## Gap Resolution Log
None — no gaps found during traceability review; all findings mapped cleanly on the first pass.
