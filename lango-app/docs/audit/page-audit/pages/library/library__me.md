# `/dashboard/library/me`

**Status: NEEDS FIX (P1)** · Module: `library` · Source: [`src/app/[locale]/(dashboard)/dashboard/library/me/page.tsx`](<../../../../../src/app/[locale]/(dashboard)/dashboard/library/me/page.tsx>)

Guard: `requireLibrarySelfPage`

**Verdict:** 1 finding(s), worst P1. 4 sweep run(s): 1 clean or expected, 3 flagged. 4 screenshot(s).

## Findings on this page

| ID | Sev | Problem | Fix | Code now |
|---|---|---|---|---|
| [S-32](../../findings/S-32.md) | P1 | Sidebar links looser than their page; denied users land on the public homepage | Derive the sidebar permission from the page guard; denial renders in-app "Accès refusé"; remove dead links; test that walks sidebar vs guards. | Not re-checked since the sweep. |

## Sweep results

| Pass | Role | URL tested | Result |
|---|---|---|---|
| Pass B | librarian | `/dashboard/library/me` | **S-32**: → /fr (public site) |
| Pass B | parent | `/dashboard/library/me` | expected: 404 /api/addons/library/me/charges (expected not-found)<br>expected: 404 /api/addons/library/me/home (expected not-found)<br>expected: 404 /api/addons/library/me/holds (expected not-found)<br>expected: 404 /api/addons/library/me/history (expected not-found)<br>**S-44**: 403 /api/settings/branches |
| Pass B | student | `/dashboard/library/me` | **S-44**: 403 /api/settings/branches |
| Pass B | teacher (prof.01) | `/dashboard/library/me` | expected: 404 /api/addons/library/me/holds (expected not-found)<br>expected: 404 /api/addons/library/me/charges (expected not-found)<br>expected: 404 /api/addons/library/me/history (expected not-found)<br>expected: 404 /api/addons/library/me/home (expected not-found) |

## Screenshots

**Pass B · seeded audit DB, all add-ons, 2026-09-23** · librarian · fr · `/dashboard/library/me`

![librarian fr](../../shots/B__librarian-fr-library__me.jpg)

**Pass B · seeded audit DB, all add-ons, 2026-09-23** · parent · fr · `/dashboard/library/me`

![parent fr](../../shots/B__parent-fr-library__me.jpg)

**Pass B · seeded audit DB, all add-ons, 2026-09-23** · student · fr · `/dashboard/library/me`

![student fr](../../shots/B__student-fr-library__me.jpg)

**Pass B · seeded audit DB, all add-ons, 2026-09-23** · teacher · fr · `/dashboard/library/me`

![teacher fr](../../shots/B__teacher-fr-library__me.jpg)

## Plan

- [ ] **S-32 (P1)** Sidebar links looser than their page; denied users land on the public homepage
  - [ ] Single permission source per route.
  - [ ] Access-denied page (now exists at `/dashboard/access-denied`, verify every guard uses it).
  - [ ] Sidebar-vs-guard unit test.
  - [ ] Accept: Re-sweep teacher/accountant: 0 redirects to `/fr`.
- [ ] Re-run this page: `echo "/dashboard/library/me" > r.txt && AUDIT_BASE=http://localhost:3333 node scripts/visual-sweep.mjs librarian r.txt`

## Cross-cutting findings that also show here

- [S-44](../../findings/S-44.md) (P2) Staff campus switcher renders for parents, students and super admin (403 on every page)
- [S-7](../../findings/S-7.md) (P1) ~1 375 hardcoded French UI strings bypass translation (Arabic UI stays French)
- [S-18](../../findings/S-18.md) (P1) Header claims CNDP compliance on every page; the school has not filed
- [S-25](../../findings/S-25.md) (P2) Header shows a fake identity when the session call is slow
- [S-37](../../findings/S-37.md) (P2) Arabic: dashboard widgets stay French; brand renders "OSSchool" in RTL
- [S-41](../../findings/S-41.md) (P1) Auth rate limit counts every page's session check, per IP
