# `/dashboard/transport/guardian`

**Status: PASS** · Module: `transport` · Source: [`src/app/[locale]/(dashboard)/dashboard/transport/guardian/page.tsx`](<../../../../../src/app/[locale]/(dashboard)/dashboard/transport/guardian/page.tsx>)

Guard: `requireServerPage` · roles `parent`

**Verdict:** No page-specific finding. 1 sweep run(s): 0 clean or expected, 1 flagged. 1 screenshot(s).

## Findings on this page

None specific to this page.

## Sweep results

| Pass | Role | URL tested | Result |
|---|---|---|---|
| Pass B | parent | `/dashboard/transport/guardian` | **S-44**: 403 /api/settings/branches |

## Screenshots

**Pass B · seeded audit DB, all add-ons, 2026-09-23** · parent · fr · `/dashboard/transport/guardian`

![parent fr](../../shots/B__parent-fr-transport__guardian.jpg)

## Plan

- No action. Keep this page in the regression sweep.

## Cross-cutting findings that also show here

- [S-44](../../findings/done/S-44.md) (P2) Staff campus switcher renders for parents, students and super admin (403 on every page)
- [S-7](../../findings/S-7.md) (P1) ~1 375 hardcoded French UI strings bypass translation (Arabic UI stays French)
- [S-18](../../findings/done/S-18.md) (P1) Header claims CNDP compliance on every page; the school has not filed
- [S-25](../../findings/done/S-25.md) (P2) Header shows a fake identity when the session call is slow
- [S-37](../../findings/S-37.md) (P2) Arabic: dashboard widgets stay French; brand renders "OSSchool" in RTL
- [S-41](../../findings/done/S-41.md) (P1) Auth rate limit counts every page's session check, per IP
