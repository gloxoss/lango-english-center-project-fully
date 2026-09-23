# `/dashboard/portals/librarian/members/[id]`

**Status: PASS** · Module: `portals` · Source: [`src/app/[locale]/(dashboard)/dashboard/portals/librarian/members/[id]/page.tsx`](<../../../../../src/app/[locale]/(dashboard)/dashboard/portals/librarian/members/[id]/page.tsx>)

Guard: `requireLibraryPage` · capability `library.circulation.operate`

**Verdict:** No page-specific finding. 1 sweep run(s): 1 clean or expected, 0 flagged. 1 screenshot(s).

## Findings on this page

None specific to this page.

## Sweep results

| Pass | Role | URL tested | Result |
|---|---|---|---|
| Pass C | librarian | `/dashboard/portals/librarian/members/cc6395a0-e7aa-4371-b5db-d53294aa00a2` | ok |

## Screenshots

**Pass C · detail + public pages, 2026-09-23** · librarian · fr · `/dashboard/portals/librarian/members/cc6395a0-e7aa-4371-b5db-d53294aa00a2`

![librarian fr](../../shots/C__librarian-fr-portals__librarian__members__cc6395a0-e7aa-4371-b5db-d53294aa00a2.jpg)

## Plan

- No action. Keep this page in the regression sweep.

## Cross-cutting findings that also show here

- [S-7](../../findings/S-7.md) (P1) ~1 375 hardcoded French UI strings bypass translation (Arabic UI stays French)
- [S-18](../../findings/done/S-18.md) (P1) Header claims CNDP compliance on every page; the school has not filed
- [S-25](../../findings/done/S-25.md) (P2) Header shows a fake identity when the session call is slow
- [S-37](../../findings/S-37.md) (P2) Arabic: dashboard widgets stay French; brand renders "OSSchool" in RTL
- [S-41](../../findings/done/S-41.md) (P1) Auth rate limit counts every page's session check, per IP
