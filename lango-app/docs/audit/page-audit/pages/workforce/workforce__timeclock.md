# `/dashboard/workforce/timeclock`

**Status: NEEDS FIX (P1)** · Module: `workforce` · Source: [`src/app/[locale]/(dashboard)/dashboard/workforce/timeclock/page.tsx`](<../../../../../src/app/[locale]/(dashboard)/dashboard/workforce/timeclock/page.tsx>)

**Progress (2026-09-25):** S-32 PARTIAL









































































































































































Guard: `requireServerPage` · capability `payroll.review`

**Verdict:** 1 finding(s), worst P1. 3 sweep run(s): 3 clean or expected, 0 flagged. 3 screenshot(s).

## Findings on this page

| ID | Sev | Problem | Fix | Code now |
|---|---|---|---|---|
| [S-32](../../findings/S-32.md) | P1 | Sidebar links looser than their page; denied users land on the public homepage | Derive the sidebar permission from the page guard; denial renders in-app "Accès refusé"; remove dead links; test that walks sidebar vs guards. | Not re-checked since the sweep. |

## Sweep results

| Pass | Role | URL tested | Result |
|---|---|---|---|
| Pass A | accountant | `/dashboard/workforce/timeclock` | expected: → /fr/dashboard/finance (denied, sent to the role's own home; fine unless the sidebar shows this link, see S-32) |
| Pass A | school_admin | `/dashboard/workforce/timeclock` | expected: → /fr/dashboard/settings/entitlements (add-on off or access denied, correct gating) |
| Pass B | school_admin | `/dashboard/workforce/timeclock` | ok |

## Screenshots

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · accountant · fr · `/dashboard/workforce/timeclock`

![accountant fr](../../shots/A__accountant-fr-workforce__timeclock.jpg)

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · school_admin · fr · `/dashboard/workforce/timeclock`

![school_admin fr](../../shots/A__school_admin-fr-workforce__timeclock.jpg)

**Pass B · seeded audit DB, all add-ons, 2026-09-23** · school_admin · fr · `/dashboard/workforce/timeclock`

![school_admin fr](../../shots/B__school_admin-fr-workforce__timeclock.jpg)

## Plan

- [ ] **S-32 (P1)** Sidebar links looser than their page; denied users land on the public homepage
  - [ ] Single permission source per route.
  - [ ] Access-denied page (now exists at `/dashboard/access-denied`, verify every guard uses it).
  - [ ] Sidebar-vs-guard unit test.
  - [ ] Accept: Re-sweep teacher/accountant: 0 redirects to `/fr`.
- [ ] Re-run this page: `echo "/dashboard/workforce/timeclock" > r.txt && AUDIT_BASE=http://localhost:3333 node scripts/visual-sweep.mjs accountant r.txt`

## Cross-cutting findings that also show here

- [S-7](../../findings/S-7.md) (P1) ~1 375 hardcoded French UI strings bypass translation (Arabic UI stays French)
- [S-14](../../findings/done/S-14.md) (P2) Sidebar lists add-on modules the tenant has not enabled
- [S-18](../../findings/done/S-18.md) (P1) Header claims CNDP compliance on every page; the school has not filed
- [S-25](../../findings/done/S-25.md) (P2) Header shows a fake identity when the session call is slow
- [S-37](../../findings/S-37.md) (P2) Arabic: dashboard widgets stay French; brand renders "OSSchool" in RTL
- [S-41](../../findings/done/S-41.md) (P1) Auth rate limit counts every page's session check, per IP
