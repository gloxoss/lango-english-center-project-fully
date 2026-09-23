# `/dashboard/workforce/awards`

**Status: PASS** · Module: `workforce` · Source: [`src/app/[locale]/(dashboard)/dashboard/workforce/awards/page.tsx`](<../../../../../src/app/[locale]/(dashboard)/dashboard/workforce/awards/page.tsx>)

Guard: `requireServerPage` · capability `payroll.awards.manage`

**Verdict:** No page-specific finding. 3 sweep run(s): 3 clean or expected, 0 flagged. 3 screenshot(s).

## Findings on this page

None specific to this page.

## Sweep results

| Pass | Role | URL tested | Result |
|---|---|---|---|
| Pass A | accountant | `/dashboard/workforce/awards` | expected: → /fr/dashboard/finance (denied, sent to the role's own home; fine unless the sidebar shows this link, see S-32) |
| Pass A | school_admin | `/dashboard/workforce/awards` | expected: → /fr/dashboard/settings/entitlements (add-on off or access denied, correct gating) |
| Pass B | school_admin | `/dashboard/workforce/awards` | ok |

## Screenshots

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · accountant · fr · `/dashboard/workforce/awards`

![accountant fr](../../shots/A__accountant-fr-workforce__awards.jpg)

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · school_admin · fr · `/dashboard/workforce/awards`

![school_admin fr](../../shots/A__school_admin-fr-workforce__awards.jpg)

**Pass B · seeded audit DB, all add-ons, 2026-09-23** · school_admin · fr · `/dashboard/workforce/awards`

![school_admin fr](../../shots/B__school_admin-fr-workforce__awards.jpg)

## Plan

- No action. Keep this page in the regression sweep.

## Cross-cutting findings that also show here

- [S-7](../../findings/S-7.md) (P1) ~1 375 hardcoded French UI strings bypass translation (Arabic UI stays French)
- [S-14](../../findings/S-14.md) (P2) Sidebar lists add-on modules the tenant has not enabled
- [S-18](../../findings/done/S-18.md) (P1) Header claims CNDP compliance on every page; the school has not filed
- [S-25](../../findings/done/S-25.md) (P2) Header shows a fake identity when the session call is slow
- [S-37](../../findings/S-37.md) (P2) Arabic: dashboard widgets stay French; brand renders "OSSchool" in RTL
- [S-41](../../findings/done/S-41.md) (P1) Auth rate limit counts every page's session check, per IP
