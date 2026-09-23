# `/dashboard/academics/classes`

**Status: NEEDS FIX (P1)** · Module: `academics` · Source: [`src/app/[locale]/(dashboard)/dashboard/academics/classes/page.tsx`](<../../../../../src/app/[locale]/(dashboard)/dashboard/academics/classes/page.tsx>)

**Progress (2026-09-23):** S-32 PARTIAL · S-17 PARTIAL











Guard: `requireServerPage` · capability `academics.manage`

**Verdict:** 2 finding(s), worst P1. 2 sweep run(s): 1 clean or expected, 1 flagged. 2 screenshot(s).

## Findings on this page

| ID | Sev | Problem | Fix | Code now |
|---|---|---|---|---|
| [S-32](../../findings/S-32.md) | P1 | Sidebar links looser than their page; denied users land on the public homepage | Derive the sidebar permission from the page guard; denial renders in-app "Accès refusé"; remove dead links; test that walks sidebar vs guards. | Not re-checked since the sweep. |
| [S-17](../../findings/S-17.md) | P2 | Classes page developer copy; Filière/Cycle empty for lycée classes | Remove copy; show filière/cycle. | Not re-checked since the sweep. |

## Sweep results

| Pass | Role | URL tested | Result |
|---|---|---|---|
| Pass A | school_admin | `/dashboard/academics/classes` | ok |
| Pass A | teacher | `/dashboard/academics/classes` | **S-32**: → /fr (public site) |

## Screenshots

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · school_admin · fr · `/dashboard/academics/classes`

![school_admin fr](../../shots/A__school_admin-fr-academics__classes.jpg)

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · teacher · fr · `/dashboard/academics/classes`

![teacher fr](../../shots/A__teacher-fr-academics__classes.jpg)

## Plan

- [ ] **S-32 (P1)** Sidebar links looser than their page; denied users land on the public homepage
  - [ ] Single permission source per route.
  - [ ] Access-denied page (now exists at `/dashboard/access-denied`, verify every guard uses it).
  - [ ] Sidebar-vs-guard unit test.
  - [ ] Accept: Re-sweep teacher/accountant: 0 redirects to `/fr`.
- [ ] **S-17 (P2)** Classes page developer copy; Filière/Cycle empty for lycée classes
  - [ ] Fix copy.
  - [ ] Join filière data.
  - [ ] Accept: Lycée classes show their filière.
- [ ] Re-run this page: `echo "/dashboard/academics/classes" > r.txt && AUDIT_BASE=http://localhost:3333 node scripts/visual-sweep.mjs teacher r.txt`

## Cross-cutting findings that also show here

- [S-7](../../findings/S-7.md) (P1) ~1 375 hardcoded French UI strings bypass translation (Arabic UI stays French)
- [S-14](../../findings/S-14.md) (P2) Sidebar lists add-on modules the tenant has not enabled
- [S-18](../../findings/done/S-18.md) (P1) Header claims CNDP compliance on every page; the school has not filed
- [S-25](../../findings/done/S-25.md) (P2) Header shows a fake identity when the session call is slow
- [S-37](../../findings/S-37.md) (P2) Arabic: dashboard widgets stay French; brand renders "OSSchool" in RTL
- [S-41](../../findings/done/S-41.md) (P1) Auth rate limit counts every page's session check, per IP
