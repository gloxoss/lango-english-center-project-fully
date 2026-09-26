# `/dashboard/settings/attendance`
<!-- swept: 2026-09-26 claude-scf-3 | school_admin on :3537: real 6-key form, save disabled while unchanged, FR/390/AR, round-trip test 2 passed -->

**Status: PASS** · Module: `settings` · Source: [`src/app/[locale]/(dashboard)/dashboard/settings/attendance/page.tsx`](<../../../../../src/app/[locale]/(dashboard)/dashboard/settings/attendance/page.tsx>)

Guard: `requireServerPage` · capability `settings.attendance.manage`

**Verdict:** No page-specific finding. 1 sweep run(s): 1 clean or expected, 0 flagged. 1 screenshot(s).

## Findings on this page

None specific to this page.

## Sweep results

| Pass | Role | URL tested | Result |
|---|---|---|---|
| Pass A | school_admin | `/dashboard/settings/attendance` | ok |

## Screenshots

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · school_admin · fr · `/dashboard/settings/attendance`

![school_admin fr](../../shots/A__school_admin-fr-settings__attendance.jpg)

## Plan

- No action. Keep this page in the regression sweep.

## Cross-cutting findings that also show here

- [S-7](../../findings/S-7.md) (P1) ~1 375 hardcoded French UI strings bypass translation (Arabic UI stays French)
- [S-14](../../findings/done/S-14.md) (P2) Sidebar lists add-on modules the tenant has not enabled
- [S-18](../../findings/done/S-18.md) (P1) Header claims CNDP compliance on every page; the school has not filed
- [S-25](../../findings/done/S-25.md) (P2) Header shows a fake identity when the session call is slow
- [S-37](../../findings/S-37.md) (P2) Arabic: dashboard widgets stay French; brand renders "OSSchool" in RTL
- [S-41](../../findings/done/S-41.md) (P1) Auth rate limit counts every page's session check, per IP
