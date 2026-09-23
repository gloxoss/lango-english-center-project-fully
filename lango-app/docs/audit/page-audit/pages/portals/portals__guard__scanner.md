# `/dashboard/portals/guard/scanner`

**Status: PASS** · Module: `portals` · Source: [`src/app/[locale]/(dashboard)/dashboard/portals/guard/scanner/page.tsx`](<../../../../../src/app/[locale]/(dashboard)/dashboard/portals/guard/scanner/page.tsx>)

Guard: `requireServerPage` · capability `guard.portal.use` · roles `guard`

**Verdict:** No page-specific finding. 1 sweep run(s): 1 clean or expected, 0 flagged. 1 screenshot(s).

## Findings on this page

None specific to this page.

## Sweep results

| Pass | Role | URL tested | Result |
|---|---|---|---|
| Pass B | guard | `/dashboard/portals/guard/scanner` | ok |

## Screenshots

**Pass B · seeded audit DB, all add-ons, 2026-09-23** · guard · fr · `/dashboard/portals/guard/scanner`

![guard fr](../../shots/B__guard-fr-portals__guard__scanner.jpg)

## Plan

- No action. Keep this page in the regression sweep.

## Cross-cutting findings that also show here

- [S-7](../../findings/S-7.md) (P1) ~1 375 hardcoded French UI strings bypass translation (Arabic UI stays French)
- [S-18](../../findings/done/S-18.md) (P1) Header claims CNDP compliance on every page; the school has not filed
- [S-25](../../findings/done/S-25.md) (P2) Header shows a fake identity when the session call is slow
- [S-37](../../findings/S-37.md) (P2) Arabic: dashboard widgets stay French; brand renders "OSSchool" in RTL
- [S-41](../../findings/done/S-41.md) (P1) Auth rate limit counts every page's session check, per IP
