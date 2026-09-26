# `/dashboard/attendance/scanner`

**Status: FIXED, pending re-sweep** · Module: `attendance` · Source: [`src/app/[locale]/(dashboard)/dashboard/attendance/scanner/page.tsx`](<../../../../../src/app/[locale]/(dashboard)/dashboard/attendance/scanner/page.tsx>)

**Progress (2026-09-26):** S-20 DONE























































































































































































Guard: `requireServerPage` · capability `attendance.manage`

**Verdict:** 1 finding(s), worst P1. 1 sweep run(s): 1 clean or expected, 0 flagged. 1 screenshot(s).

## Findings on this page

| ID | Sev | Problem | Fix | Code now |
|---|---|---|---|---|
| [S-20](../../findings/done/S-20.md) | P1 | Emergency headcount ignores manual attendance | On-site = manual present + scans − exits for today. Show camera errors honestly. | Not re-checked since the sweep. |

## Sweep results

| Pass | Role | URL tested | Result |
|---|---|---|---|
| Pass A | school_admin | `/dashboard/attendance/scanner` | ok |

## Screenshots

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · school_admin · fr · `/dashboard/attendance/scanner`

![school_admin fr](../../shots/A__school_admin-fr-attendance__scanner.jpg)

## Plan

- [ ] **S-20 (P1)** Emergency headcount ignores manual attendance
  - [ ] Combine sources in the headcount query.
  - [ ] Fix the camera status badge.
  - [ ] Test with manual attendance only.
  - [ ] Accept: Headcount equals present students after manual roll call.
- [ ] Re-run this page: `echo "/dashboard/attendance/scanner" > r.txt && AUDIT_BASE=http://localhost:3333 node scripts/visual-sweep.mjs school_admin r.txt`

## Cross-cutting findings that also show here

- [S-7](../../findings/S-7.md) (P1) ~1 375 hardcoded French UI strings bypass translation (Arabic UI stays French)
- [S-14](../../findings/done/S-14.md) (P2) Sidebar lists add-on modules the tenant has not enabled
- [S-18](../../findings/done/S-18.md) (P1) Header claims CNDP compliance on every page; the school has not filed
- [S-25](../../findings/done/S-25.md) (P2) Header shows a fake identity when the session call is slow
- [S-37](../../findings/S-37.md) (P2) Arabic: dashboard widgets stay French; brand renders "OSSchool" in RTL
- [S-41](../../findings/done/S-41.md) (P1) Auth rate limit counts every page's session check, per IP
