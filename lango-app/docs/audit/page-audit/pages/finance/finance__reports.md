# `/dashboard/finance/reports`

**Status: NEEDS FIX (P2)** · Module: `finance` · Source: [`src/app/[locale]/(dashboard)/dashboard/finance/reports/page.tsx`](<../../../../../src/app/[locale]/(dashboard)/dashboard/finance/reports/page.tsx>)

Guard: `requireServerPage` · capability `finance.read`

**Verdict:** 1 finding(s), worst P2. 2 sweep run(s): 2 clean or expected, 0 flagged. 2 screenshot(s).

## Findings on this page

| ID | Sev | Problem | Fix | Code now |
|---|---|---|---|---|
| [S-31](../../findings/S-31.md) | P2 | Developer copy on finance screens | User-facing wording; distinct titles. | Not re-checked since the sweep. |

## Sweep results

| Pass | Role | URL tested | Result |
|---|---|---|---|
| Pass A | accountant | `/dashboard/finance/reports` | ok |
| Pass A | school_admin | `/dashboard/finance/reports` | ok |

## Screenshots

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · accountant · fr · `/dashboard/finance/reports`

![accountant fr](../../shots/A__accountant-fr-finance__reports.jpg)

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · school_admin · fr · `/dashboard/finance/reports`

![school_admin fr](../../shots/A__school_admin-fr-finance__reports.jpg)

## Plan

- [ ] **S-31 (P2)** Developer copy on finance screens
  - [ ] Edit copy.
  - [ ] Accept: No developer wording.
- [ ] Re-run this page: `echo "/dashboard/finance/reports" > r.txt && AUDIT_BASE=http://localhost:3333 node scripts/visual-sweep.mjs accountant r.txt`

## Cross-cutting findings that also show here

- [S-7](../../findings/S-7.md) (P1) ~1 375 hardcoded French UI strings bypass translation (Arabic UI stays French)
- [S-14](../../findings/S-14.md) (P2) Sidebar lists add-on modules the tenant has not enabled
- [S-18](../../findings/S-18.md) (P1) Header claims CNDP compliance on every page; the school has not filed
- [S-25](../../findings/S-25.md) (P2) Header shows a fake identity when the session call is slow
- [S-37](../../findings/S-37.md) (P2) Arabic: dashboard widgets stay French; brand renders "OSSchool" in RTL
- [S-41](../../findings/S-41.md) (P1) Auth rate limit counts every page's session check, per IP
