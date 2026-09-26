# `/dashboard/academics/schedule`

**Status: NEEDS FIX (P1)** · Module: `academics` · Source: [`src/app/[locale]/(dashboard)/dashboard/academics/schedule/page.tsx`](<../../../../../src/app/[locale]/(dashboard)/dashboard/academics/schedule/page.tsx>)

**Progress (2026-09-26):** S-6 DONE · S-32 PARTIAL · S-12 DONE























































































































































































Guard: `requireServerPage` · capability `academics.manage`

**Verdict:** 3 finding(s), worst P1. 2 sweep run(s): 0 clean or expected, 2 flagged. 2 screenshot(s).

## Findings on this page

| ID | Sev | Problem | Fix | Code now |
|---|---|---|---|---|
| [S-6](../../findings/done/S-6.md) | P1 | Translation keys used in code are missing (users see raw keys or blanks) | Add every missing key in fr, ar, en; fix formatting calls that omit their values. | LIKELY FIXED in the working tree |
| [S-32](../../findings/S-32.md) | P1 | Sidebar links looser than their page; denied users land on the public homepage | Derive the sidebar permission from the page guard; denial renders in-app "Accès refusé"; remove dead links; test that walks sidebar vs guards. | Not re-checked since the sweep. |
| [S-12](../../findings/done/S-12.md) | P2 | Timetable: duplicate generate buttons, 2-hour grid | One generate button; slot size from school settings (hourly default). | Not re-checked since the sweep. |

## Sweep results

| Pass | Role | URL tested | Result |
|---|---|---|---|
| Pass A | school_admin | `/dashboard/academics/schedule` | **S-6**: console: IntlError: MISSING_MESSAGE: Could not resolve `Academics.scheduleModuleTag` in messages for locale `fr`. |
| Pass A | teacher | `/dashboard/academics/schedule` | **S-32**: → /fr (public site) |

## Screenshots

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · school_admin · fr · `/dashboard/academics/schedule`

![school_admin fr](../../shots/A__school_admin-fr-academics__schedule.jpg)

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · teacher · fr · `/dashboard/academics/schedule`

![teacher fr](../../shots/A__teacher-fr-academics__schedule.jpg)

## Plan

- [ ] **S-6 (P1)** Translation keys used in code are missing (users see raw keys or blanks)
  - [ ] Run the checker, add keys until it exits 0.
  - [ ] Re-run the runtime sweep on the listed pages; 0 `MISSING_MESSAGE`.
  - [ ] Add the checker to CI.
  - [ ] Accept: Checker exits 0 and the runtime sweep shows no raw keys.
- [ ] **S-32 (P1)** Sidebar links looser than their page; denied users land on the public homepage
  - [ ] Single permission source per route.
  - [ ] Access-denied page (now exists at `/dashboard/access-denied`, verify every guard uses it).
  - [ ] Sidebar-vs-guard unit test.
  - [ ] Accept: Re-sweep teacher/accountant: 0 redirects to `/fr`.
- [ ] **S-12 (P2)** Timetable: duplicate generate buttons, 2-hour grid
  - [ ] Remove the duplicate.
  - [ ] Read slot length from settings.
  - [ ] Accept: Hourly timetable renders.
- [ ] Re-run this page: `echo "/dashboard/academics/schedule" > r.txt && AUDIT_BASE=http://localhost:3333 node scripts/visual-sweep.mjs school_admin r.txt`

## Cross-cutting findings that also show here

- [S-7](../../findings/S-7.md) (P1) ~1 375 hardcoded French UI strings bypass translation (Arabic UI stays French)
- [S-14](../../findings/done/S-14.md) (P2) Sidebar lists add-on modules the tenant has not enabled
- [S-18](../../findings/done/S-18.md) (P1) Header claims CNDP compliance on every page; the school has not filed
- [S-25](../../findings/done/S-25.md) (P2) Header shows a fake identity when the session call is slow
- [S-37](../../findings/S-37.md) (P2) Arabic: dashboard widgets stay French; brand renders "OSSchool" in RTL
- [S-41](../../findings/done/S-41.md) (P1) Auth rate limit counts every page's session check, per IP
