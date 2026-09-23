# `/dashboard/broadcast/campaigns/[id]`

**Status: PASS** · Module: `broadcast` · Source: [`src/app/[locale]/(dashboard)/dashboard/broadcast/campaigns/[id]/page.tsx`](<../../../../../src/app/[locale]/(dashboard)/dashboard/broadcast/campaigns/[id]/page.tsx>)

Guard: `requireServerPage` · capability `broadcast.manage`

**Verdict:** No page-specific finding. 2 sweep run(s): 2 clean or expected, 0 flagged. 2 screenshot(s).

## Findings on this page

None specific to this page.

## Sweep results

| Pass | Role | URL tested | Result |
|---|---|---|---|
| Pass C | school_admin | `/dashboard/broadcast/campaigns/a3f4d3db-65e9-4348-8746-9a12eaeb79cd` | ok |
| Pass C | parent | `/dashboard/broadcast/campaigns/a3f4d3db-65e9-4348-8746-9a12eaeb79cd` | ok, blocked → /fr/dashboard/access-denied<br>ok, 403 /api/settings/branches (data blocked, expected) |

## Screenshots

**Pass C · detail + public pages, 2026-09-23** · school_admin · fr · `/dashboard/broadcast/campaigns/a3f4d3db-65e9-4348-8746-9a12eaeb79cd`

![school_admin fr](../../shots/C__school_admin-fr-broadcast__campaigns__a3f4d3db-65e9-4348-8746-9a12eaeb79cd.jpg)

**Pass C · parent typing staff URLs (expected: blocked)** · parent · fr · `/dashboard/broadcast/campaigns/a3f4d3db-65e9-4348-8746-9a12eaeb79cd`

![parent fr](../../shots/C-idor__parent-fr-broadcast__campaigns__a3f4d3db-65e9-4348-8746-9a12eaeb79cd.jpg)

## Plan

- No action. Keep this page in the regression sweep.

## Cross-cutting findings that also show here

- [S-7](../../findings/S-7.md) (P1) ~1 375 hardcoded French UI strings bypass translation (Arabic UI stays French)
- [S-14](../../findings/S-14.md) (P2) Sidebar lists add-on modules the tenant has not enabled
- [S-18](../../findings/done/S-18.md) (P1) Header claims CNDP compliance on every page; the school has not filed
- [S-25](../../findings/done/S-25.md) (P2) Header shows a fake identity when the session call is slow
- [S-37](../../findings/S-37.md) (P2) Arabic: dashboard widgets stay French; brand renders "OSSchool" in RTL
- [S-41](../../findings/done/S-41.md) (P1) Auth rate limit counts every page's session check, per IP
- [S-44](../../findings/S-44.md) (P2) Staff campus switcher renders for parents, students and super admin (403 on every page)
