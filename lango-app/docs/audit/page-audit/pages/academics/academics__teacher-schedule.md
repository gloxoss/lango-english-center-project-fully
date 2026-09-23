# `/dashboard/academics/teacher-schedule`

**Status: PASS** · Module: `academics` · Source: [`src/app/[locale]/(dashboard)/dashboard/academics/teacher-schedule/page.tsx`](<../../../../../src/app/[locale]/(dashboard)/dashboard/academics/teacher-schedule/page.tsx>)

Guard: `requireServerPage` · capability `academics.read`

**Verdict:** No page-specific finding. 3 sweep run(s): 3 clean or expected, 0 flagged. 3 screenshot(s).

## Findings on this page

None specific to this page.

## Sweep results

| Pass | Role | URL tested | Result |
|---|---|---|---|
| Pass A | school_admin | `/dashboard/academics/teacher-schedule` | ok |
| Pass A | teacher | `/dashboard/academics/teacher-schedule` | ok |
| Pass B | teacher (prof.01) | `/dashboard/academics/teacher-schedule` | ok |

## Screenshots

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · school_admin · fr · `/dashboard/academics/teacher-schedule`

![school_admin fr](../../shots/A__school_admin-fr-academics__teacher-schedule.jpg)

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · teacher · fr · `/dashboard/academics/teacher-schedule`

![teacher fr](../../shots/A__teacher-fr-academics__teacher-schedule.jpg)

**Pass B · seeded audit DB, all add-ons, 2026-09-23** · teacher · fr · `/dashboard/academics/teacher-schedule`

![teacher fr](../../shots/B__teacher-fr-academics__teacher-schedule.jpg)

## Plan

- No action. Keep this page in the regression sweep.

## Cross-cutting findings that also show here

- [S-7](../../findings/S-7.md) (P1) ~1 375 hardcoded French UI strings bypass translation (Arabic UI stays French)
- [S-14](../../findings/S-14.md) (P2) Sidebar lists add-on modules the tenant has not enabled
- [S-18](../../findings/done/S-18.md) (P1) Header claims CNDP compliance on every page; the school has not filed
- [S-25](../../findings/done/S-25.md) (P2) Header shows a fake identity when the session call is slow
- [S-37](../../findings/S-37.md) (P2) Arabic: dashboard widgets stay French; brand renders "OSSchool" in RTL
- [S-41](../../findings/done/S-41.md) (P1) Auth rate limit counts every page's session check, per IP
