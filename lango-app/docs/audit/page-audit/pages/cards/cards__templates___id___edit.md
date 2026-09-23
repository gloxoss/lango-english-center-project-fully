# `/dashboard/cards/templates/[id]/edit`

**Status: PASS** · Module: `cards` · Source: [`src/app/[locale]/(dashboard)/dashboard/cards/templates/[id]/edit/page.tsx`](<../../../../../src/app/[locale]/(dashboard)/dashboard/cards/templates/[id]/edit/page.tsx>)

Guard: `requireServerPage` · capability `cards.templates.manage`

**Verdict:** No page-specific finding. 2 sweep run(s): 2 clean or expected, 0 flagged. 2 screenshot(s).

## Findings on this page

None specific to this page.

## Sweep results

| Pass | Role | URL tested | Result |
|---|---|---|---|
| Pass C | school_admin | `/dashboard/cards/templates/1c1ce805-8966-4736-84f4-29656a6fa6c2/edit` | ok |
| Pass C | parent | `/dashboard/cards/templates/1c1ce805-8966-4736-84f4-29656a6fa6c2/edit` | ok, blocked → /fr/dashboard/access-denied<br>ok, 403 /api/settings/branches (data blocked, expected) |

## Screenshots

**Pass C · detail + public pages, 2026-09-23** · school_admin · fr · `/dashboard/cards/templates/1c1ce805-8966-4736-84f4-29656a6fa6c2/edit`

![school_admin fr](../../shots/C__school_admin-fr-cards__templates__1c1ce805-8966-4736-84f4-29656a6fa6c2__edit.jpg)

**Pass C · parent typing staff URLs (expected: blocked)** · parent · fr · `/dashboard/cards/templates/1c1ce805-8966-4736-84f4-29656a6fa6c2/edit`

![parent fr](../../shots/C-idor__parent-fr-cards__templates__1c1ce805-8966-4736-84f4-29656a6fa6c2__edit.jpg)

## Plan

- No action. Keep this page in the regression sweep.

## Cross-cutting findings that also show here

- [S-7](../../findings/S-7.md) (P1) ~1 375 hardcoded French UI strings bypass translation (Arabic UI stays French)
- [S-14](../../findings/S-14.md) (P2) Sidebar lists add-on modules the tenant has not enabled
- [S-18](../../findings/S-18.md) (P1) Header claims CNDP compliance on every page; the school has not filed
- [S-25](../../findings/S-25.md) (P2) Header shows a fake identity when the session call is slow
- [S-37](../../findings/S-37.md) (P2) Arabic: dashboard widgets stay French; brand renders "OSSchool" in RTL
- [S-41](../../findings/S-41.md) (P1) Auth rate limit counts every page's session check, per IP
- [S-44](../../findings/S-44.md) (P2) Staff campus switcher renders for parents, students and super admin (403 on every page)
