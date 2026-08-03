# Section Index — Data-Wiring Remediation

## Overview
Total sections: 19
Total tasks: 61
Parallel batches: 3

## Batch Execution Order

### Batch 1 — newest pages, highest priority (parallel, no file overlap)
- Section 01: Homework Submissions [red]
- Section 02: Exam Planning [yellow]
- Section 03: Rooms Management [green]
- Section 04: Tenant Entitlements Catalog [yellow]
- Section 05: Grading/Assessment Policies [yellow]
- Section 06: Settings Fake-Action Trio [yellow]

### Batch 2 — long-standing known gaps (parallel, no file overlap)
- Section 07: Global Header Search [yellow]
- Section 08: Users List Pagination [green]
- Section 09: Report Card Generator [yellow]
- Section 10: Student Transfers Wiring [green]

### Batch 3 — broad sweep, mostly existing-backend wiring (parallel, no file overlap)
- Section 11: Academics Reference Views [green]
- Section 12: Attendance Views [green]
- Section 13: Finance Views — Existing Backends [green]
- Section 14: Finance — New Backends (Reminders, Fee Allocation) [yellow]
- Section 15: Financial Reports Aggregate [yellow]
- Section 16: Students/CRM Views [green]
- Section 17: Homework View (list) [yellow]
- Section 18: Settings Policies Persistence [green]
- Section 19: NOT CHECKED Verification Sweep [green]

## Section Manifest

| # | Section | Risk | Batch | Depends On | Blocks |
|---|---------|------|-------|------------|--------|
| 01 | Homework Submissions | red | 1 | none | none |
| 02 | Exam Planning | yellow | 1 | none | none |
| 03 | Rooms Management | green | 1 | none | none |
| 04 | Tenant Entitlements Catalog | yellow | 1 | none | none |
| 05 | Grading/Assessment Policies | yellow | 1 | none | none |
| 06 | Settings Fake-Action Trio | yellow | 1 | none | none |
| 07 | Global Header Search | yellow | 2 | none | none |
| 08 | Users List Pagination | green | 2 | none | none |
| 09 | Report Card Generator | yellow | 2 | none | none |
| 10 | Student Transfers Wiring | green | 2 | none | none |
| 11 | Academics Reference Views | green | 3 | none | none |
| 12 | Attendance Views | green | 3 | none | none |
| 13 | Finance Views — Existing Backends | green | 3 | none | none |
| 14 | Finance — New Backends | yellow | 3 | none | none |
| 15 | Financial Reports Aggregate | yellow | 3 | none | none |
| 16 | Students/CRM Views | green | 3 | none | none |
| 17 | Homework View (list) | yellow | 3 | none | none |
| 18 | Settings Policies Persistence | green | 3 | none | none |
| 19 | NOT CHECKED Verification Sweep | green | 3 | none | none |

Every section is file-independent from every other section — no section edits a file another section touches, so all 19 can run in any order or fully in parallel. Batches reflect the user's stated *priority* (newest pages first), not a technical dependency.

## Before Executing Any Section
Re-check `git status` on that section's target files. If your other agent session has them open/modified, hold that section until they're stable — do not execute against files mid-edit by someone else.
