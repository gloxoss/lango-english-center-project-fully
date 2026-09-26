# `/dashboard/documents/generator`

**Status: NEEDS FIX (P1)** · Module: `documents` · Source: [`src/app/[locale]/(dashboard)/dashboard/documents/generator/page.tsx`](<../../../../../src/app/[locale]/(dashboard)/dashboard/documents/generator/page.tsx>)

**Progress (2026-09-26):** S-5 DONE · S-32 PARTIAL























































































































































































Guard: `requireServerPage` · capability `cards.templates.manage`

**Verdict:** 2 finding(s), worst P1. 2 sweep run(s): 2 clean or expected, 0 flagged. 2 screenshot(s).

## Findings on this page

| ID | Sev | Problem | Fix | Code now |
|---|---|---|---|---|
| [S-5](../../findings/done/S-5.md) | P1 | Report card generator: "Moyenne générale 0.00/20" with no marks, print enabled | Show "—" and disable print/PDF when no subject is graded. Add a term selector passing `examTermId`. | Not re-checked since the sweep. |
| [S-32](../../findings/S-32.md) | P1 | Sidebar links looser than their page; denied users land on the public homepage | Derive the sidebar permission from the page guard; denial renders in-app "Accès refusé"; remove dead links; test that walks sidebar vs guards. | Not re-checked since the sweep. |

## Sweep results

| Pass | Role | URL tested | Result |
|---|---|---|---|
| Pass A | school_admin | `/dashboard/documents/generator` | ok |
| Pass B | school_admin | `/dashboard/documents/generator` | ok |

## Screenshots

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · school_admin · fr · `/dashboard/documents/generator`

![school_admin fr](../../shots/A__school_admin-fr-documents__generator.jpg)

**Pass B · seeded audit DB, all add-ons, 2026-09-23** · school_admin · fr · `/dashboard/documents/generator`

![school_admin fr](../../shots/B__school_admin-fr-documents__generator.jpg)

## Plan

- [ ] **S-5 (P1)** Report card generator: "Moyenne générale 0.00/20" with no marks, print enabled
  - [ ] Guard the average and buttons on graded count > 0.
  - [ ] Add the term selector and pass `examTermId` to the API.
  - [ ] Test: a student with no marks gets "—" and disabled buttons.
  - [ ] Accept: No 0.00/20 for ungraded students; the term changes the report.
- [ ] **S-32 (P1)** Sidebar links looser than their page; denied users land on the public homepage
  - [ ] Single permission source per route.
  - [ ] Access-denied page (now exists at `/dashboard/access-denied`, verify every guard uses it).
  - [ ] Sidebar-vs-guard unit test.
  - [ ] Accept: Re-sweep teacher/accountant: 0 redirects to `/fr`.
- [ ] Re-run this page: `echo "/dashboard/documents/generator" > r.txt && AUDIT_BASE=http://localhost:3333 node scripts/visual-sweep.mjs school_admin r.txt`

## Cross-cutting findings that also show here

- [S-7](../../findings/S-7.md) (P1) ~1 375 hardcoded French UI strings bypass translation (Arabic UI stays French)
- [S-14](../../findings/done/S-14.md) (P2) Sidebar lists add-on modules the tenant has not enabled
- [S-18](../../findings/done/S-18.md) (P1) Header claims CNDP compliance on every page; the school has not filed
- [S-25](../../findings/done/S-25.md) (P2) Header shows a fake identity when the session call is slow
- [S-37](../../findings/S-37.md) (P2) Arabic: dashboard widgets stay French; brand renders "OSSchool" in RTL
- [S-41](../../findings/done/S-41.md) (P1) Auth rate limit counts every page's session check, per IP
