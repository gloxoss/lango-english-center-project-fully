# `/dashboard/super-admin/waitlist`

**Status: PASS** · Module: `super-admin` · Source: [`src/app/[locale]/(dashboard)/dashboard/super-admin/waitlist/page.tsx`](<../../../../../src/app/[locale]/(dashboard)/dashboard/super-admin/waitlist/page.tsx>)

Guard: `requireServerPage` · roles `super_admin`

**Verdict:** No page-specific finding. 2 sweep run(s): 1 clean or expected, 1 flagged. 2 screenshot(s).

## Findings on this page

None specific to this page.

## Sweep results

| Pass | Role | URL tested | Result |
|---|---|---|---|
| Pass A | super_admin | `/dashboard/super-admin/waitlist` | ok |
| Pass B | super_admin | `/dashboard/super-admin/waitlist` | **S-44**: 403 /api/settings/branches |

## Screenshots

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · super_admin · fr · `/dashboard/super-admin/waitlist`

![super_admin fr](../../shots/A__super_admin-fr-super-admin__waitlist.jpg)

**Pass B · seeded audit DB, all add-ons, 2026-09-23** · super_admin · fr · `/dashboard/super-admin/waitlist`

![super_admin fr](../../shots/B__super_admin-fr-super-admin__waitlist.jpg)

## Plan

- No action. Keep this page in the regression sweep.

## Cross-cutting findings that also show here

- [S-44](../../findings/done/S-44.md) (P2) Staff campus switcher renders for parents, students and super admin (403 on every page)
- [S-7](../../findings/S-7.md) (P1) ~1 375 hardcoded French UI strings bypass translation (Arabic UI stays French)
- [S-18](../../findings/done/S-18.md) (P1) Header claims CNDP compliance on every page; the school has not filed
- [S-25](../../findings/done/S-25.md) (P2) Header shows a fake identity when the session call is slow
- [S-37](../../findings/S-37.md) (P2) Arabic: dashboard widgets stay French; brand renders "OSSchool" in RTL
- [S-41](../../findings/done/S-41.md) (P1) Auth rate limit counts every page's session check, per IP
