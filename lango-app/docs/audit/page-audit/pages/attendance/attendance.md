# `/dashboard/attendance`

**Status: PASS** · Module: `attendance` · Source: [`src/app/[locale]/(dashboard)/dashboard/attendance/page.tsx`](<../../../../../src/app/[locale]/(dashboard)/dashboard/attendance/page.tsx>)

Guard: `requireServerPage` · capability `attendance.read`

**Verdict:** No page-specific finding. 5 sweep run(s): 5 clean or expected, 0 flagged. 8 screenshot(s).

## Findings on this page

None specific to this page.

## Sweep results

| Pass | Role | URL tested | Result |
|---|---|---|---|
| Pass A | school_admin | `/dashboard/attendance` | ok |
| Pass A | school_admin (ar) | `/dashboard/attendance` | ok |
| Pass A | school_admin (phone) | `/dashboard/attendance` | ok |
| Pass A | teacher | `/dashboard/attendance` | ok |
| Pass B | teacher (prof.01) | `/dashboard/attendance` | ok |

## Screenshots

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · school_admin · ar · `/dashboard/attendance`

![school_admin ar](../../shots/A__school_admin-ar-attendance.jpg)

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · school_admin · fr · `/dashboard/attendance`

![school_admin fr](../../shots/A__school_admin-fr-attendance.jpg)

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · school_admin · fr phone · `/dashboard/attendance`

![school_admin fr phone](../../shots/A__school_admin-fr-phone-attendance.jpg)

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · teacher · fr · `/dashboard/attendance`

![teacher fr](../../shots/A__teacher-fr-attendance.jpg)

**Pass B · seeded audit DB, all add-ons, 2026-09-23** · teacher · fr · `/dashboard/attendance`

![teacher fr](../../shots/B__teacher-fr-attendance.jpg)

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · school_admin · desktop · `/dashboard/attendance`

![school_admin desktop](../../shots/A__capture-school_admin-attendance-desktop.jpg)

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · school_admin · phone · `/dashboard/attendance`

![school_admin phone](../../shots/A__capture-school_admin-attendance-phone.jpg)

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · school_admin · ar · `/dashboard/attendance`

![school_admin ar](../../shots/A__capture-school_admin-attendance-ar.jpg)

## Plan

- No action. Keep this page in the regression sweep.

## Cross-cutting findings that also show here

- [S-7](../../findings/S-7.md) (P1) ~1 375 hardcoded French UI strings bypass translation (Arabic UI stays French)
- [S-14](../../findings/S-14.md) (P2) Sidebar lists add-on modules the tenant has not enabled
- [S-18](../../findings/done/S-18.md) (P1) Header claims CNDP compliance on every page; the school has not filed
- [S-25](../../findings/done/S-25.md) (P2) Header shows a fake identity when the session call is slow
- [S-37](../../findings/S-37.md) (P2) Arabic: dashboard widgets stay French; brand renders "OSSchool" in RTL
- [S-41](../../findings/done/S-41.md) (P1) Auth rate limit counts every page's session check, per IP
