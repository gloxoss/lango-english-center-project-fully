# `/dashboard/library`

**Status: PASS** · Module: `library` · Source: [`src/app/[locale]/(dashboard)/dashboard/library/page.tsx`](<../../../../../src/app/[locale]/(dashboard)/dashboard/library/page.tsx>)

Guard: `requireServerPage` · capability `library.catalog.read` · redirect-only page

**Verdict:** No page-specific finding. 4 sweep run(s): 3 clean or expected, 1 flagged. 4 screenshot(s).

## Findings on this page

None specific to this page.

## Sweep results

| Pass | Role | URL tested | Result |
|---|---|---|---|
| Pass A | school_admin | `/dashboard/library` | expected: → /fr/dashboard/settings/entitlements (add-on off or access denied, correct gating) |
| Pass B | school_admin | `/dashboard/library` | expected: → /fr/dashboard/portals/librarian (staff land on the librarian portal)<br>**S-41**: 429 /api/auth/get-session<br>**S-41**: 429 rate-limited |
| Pass B | librarian | `/dashboard/library` | expected: → /fr/dashboard/portals/librarian (staff land on the librarian portal) |
| Pass C | school_admin | `/dashboard/library` | expected: → /fr/dashboard/portals/librarian (staff land on the librarian portal) |

## Screenshots

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · school_admin · fr · `/dashboard/library`

![school_admin fr](../../shots/A__school_admin-fr-library.jpg)

**Pass B · seeded audit DB, all add-ons, 2026-09-23** · librarian · fr · `/dashboard/library`

![librarian fr](../../shots/B__librarian-fr-library.jpg)

**Pass B · seeded audit DB, all add-ons, 2026-09-23** · school_admin · fr · `/dashboard/library`

![school_admin fr](../../shots/B__school_admin-fr-library.jpg)

**Pass C · detail + public pages, 2026-09-23** · school_admin · fr · `/dashboard/library`

![school_admin fr](../../shots/C__school_admin-fr-library.jpg)

## Plan

- No action. Keep this page in the regression sweep.

## Cross-cutting findings that also show here

- [S-41](../../findings/done/S-41.md) (P1) Auth rate limit counts every page's session check, per IP
- [S-7](../../findings/S-7.md) (P1) ~1 375 hardcoded French UI strings bypass translation (Arabic UI stays French)
- [S-14](../../findings/done/S-14.md) (P2) Sidebar lists add-on modules the tenant has not enabled
- [S-18](../../findings/done/S-18.md) (P1) Header claims CNDP compliance on every page; the school has not filed
- [S-25](../../findings/done/S-25.md) (P2) Header shows a fake identity when the session call is slow
- [S-37](../../findings/S-37.md) (P2) Arabic: dashboard widgets stay French; brand renders "OSSchool" in RTL
