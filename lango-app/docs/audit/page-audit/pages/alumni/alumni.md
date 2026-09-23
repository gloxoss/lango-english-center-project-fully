# `/alumni`

**Status: PASS** · Module: `alumni` · Source: [`src/app/[locale]/(alumni-portal)/alumni/page.tsx`](<../../../../../src/app/[locale]/(alumni-portal)/alumni/page.tsx>)

Guard: no guard in page.tsx (public page, or protected by its layout or client)

**Verdict:** No page-specific finding. 1 sweep run(s): 1 clean or expected, 0 flagged. 1 screenshot(s).

## Findings on this page

None specific to this page.

## Sweep results

| Pass | Role | URL tested | Result |
|---|---|---|---|
| Pass B | alumni | `/alumni` | ok |

## Screenshots

**Pass B · seeded audit DB, all add-ons, 2026-09-23** · alumni · fr · `/alumni`

![alumni fr](../../shots/B__alumni-fr-__alumni.jpg)

## Plan

- No action. Keep this page in the regression sweep.

## Cross-cutting findings that also show here

- [S-7](../../findings/S-7.md) (P1) ~1 375 hardcoded French UI strings bypass translation (Arabic UI stays French)
- [S-18](../../findings/S-18.md) (P1) Header claims CNDP compliance on every page; the school has not filed
- [S-25](../../findings/S-25.md) (P2) Header shows a fake identity when the session call is slow
- [S-37](../../findings/S-37.md) (P2) Arabic: dashboard widgets stay French; brand renders "OSSchool" in RTL
- [S-41](../../findings/S-41.md) (P1) Auth rate limit counts every page's session check, per IP
- [S-44](../../findings/S-44.md) (P2) Staff campus switcher renders for parents, students and super admin (403 on every page)
