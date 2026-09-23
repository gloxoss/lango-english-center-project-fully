# `/dashboard/academics/exams`

**Status: NEEDS FIX (P2)** · Module: `academics` · Source: [`src/app/[locale]/(dashboard)/dashboard/academics/exams/page.tsx`](<../../../../../src/app/[locale]/(dashboard)/dashboard/academics/exams/page.tsx>)

Guard: `requireServerPage` · capability `academics.manage`

**Verdict:** 1 finding(s), worst P2. 1 sweep run(s): 1 clean or expected, 0 flagged. 1 screenshot(s).

## Findings on this page

| ID | Sev | Problem | Fix | Code now |
|---|---|---|---|---|
| [S-13](../../findings/S-13.md) | P2 | Exam planning exists twice | Keep one, redirect the other. | Not re-checked since the sweep. |

## Sweep results

| Pass | Role | URL tested | Result |
|---|---|---|---|
| Pass A | school_admin | `/dashboard/academics/exams` | expected: harness: warm-up request aborted by the measured reload (page renders its data) |

## Screenshots

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · school_admin · fr · `/dashboard/academics/exams`

![school_admin fr](../../shots/A__school_admin-fr-academics__exams.jpg)

## Plan

- [ ] **S-13 (P2)** Exam planning exists twice
  - [ ] Decide the survivor.
  - [ ] Redirect and remove the nav entry.
  - [ ] Accept: One exam planning screen.
- [ ] Re-run this page: `echo "/dashboard/academics/exams" > r.txt && AUDIT_BASE=http://localhost:3333 node scripts/visual-sweep.mjs school_admin r.txt`

## Cross-cutting findings that also show here

- [S-7](../../findings/S-7.md) (P1) ~1 375 hardcoded French UI strings bypass translation (Arabic UI stays French)
- [S-14](../../findings/S-14.md) (P2) Sidebar lists add-on modules the tenant has not enabled
- [S-18](../../findings/S-18.md) (P1) Header claims CNDP compliance on every page; the school has not filed
- [S-25](../../findings/S-25.md) (P2) Header shows a fake identity when the session call is slow
- [S-37](../../findings/S-37.md) (P2) Arabic: dashboard widgets stay French; brand renders "OSSchool" in RTL
- [S-41](../../findings/S-41.md) (P1) Auth rate limit counts every page's session check, per IP
