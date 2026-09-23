# `/dashboard/receptionist/appointments`

**Status: PASS** · Module: `receptionist` · Source: [`src/app/[locale]/(dashboard)/dashboard/receptionist/appointments/page.tsx`](<../../../../../src/app/[locale]/(dashboard)/dashboard/receptionist/appointments/page.tsx>)

Guard: `requireServerPage` · capability `reception.appointment.manage`

**Verdict:** No page-specific finding. 1 sweep run(s): 1 clean or expected, 0 flagged. 1 screenshot(s).

## Findings on this page

None specific to this page.

## Sweep results

| Pass | Role | URL tested | Result |
|---|---|---|---|
| Pass B | receptionist | `/dashboard/receptionist/appointments` | ok |

## Screenshots

**Pass B · seeded audit DB, all add-ons, 2026-09-23** · receptionist · fr · `/dashboard/receptionist/appointments`

![receptionist fr](../../shots/B__receptionist-fr-receptionist__appointments.jpg)

## Plan

- No action. Keep this page in the regression sweep.

## Cross-cutting findings that also show here

- [S-7](../../findings/S-7.md) (P1) ~1 375 hardcoded French UI strings bypass translation (Arabic UI stays French)
- [S-18](../../findings/done/S-18.md) (P1) Header claims CNDP compliance on every page; the school has not filed
- [S-25](../../findings/done/S-25.md) (P2) Header shows a fake identity when the session call is slow
- [S-37](../../findings/S-37.md) (P2) Arabic: dashboard widgets stay French; brand renders "OSSchool" in RTL
- [S-41](../../findings/done/S-41.md) (P1) Auth rate limit counts every page's session check, per IP
