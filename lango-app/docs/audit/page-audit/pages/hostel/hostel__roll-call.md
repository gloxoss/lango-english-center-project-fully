# `/dashboard/hostel/roll-call`

**Status: NEEDS FIX (P1)** · Module: `hostel` · Source: [`src/app/[locale]/(dashboard)/dashboard/hostel/roll-call/page.tsx`](<../../../../../src/app/[locale]/(dashboard)/dashboard/hostel/roll-call/page.tsx>)

**Progress (2026-09-26):** S-32 PARTIAL · S-54 DONE






















































































































































































Guard: `requireServerPage` · capability `hostel.supervision.manage`

**Verdict:** 2 finding(s), worst P1. 2 sweep run(s): 2 clean or expected, 0 flagged. 2 screenshot(s).

## Findings on this page

| ID | Sev | Problem | Fix | Code now |
|---|---|---|---|---|
| [S-32](../../findings/S-32.md) | P1 | Sidebar links looser than their page; denied users land on the public homepage | Derive the sidebar permission from the page guard; denial renders in-app "Accès refusé"; remove dead links; test that walks sidebar vs guards. | Not re-checked since the sweep. |
| [S-54](../../findings/done/S-54.md) | P2 | Expired hostel stays stay "checked_in" forever | Overdue-checkout list and alert; seed dates relative to `now()`. | Not re-checked since the sweep. |

## Sweep results

| Pass | Role | URL tested | Result |
|---|---|---|---|
| Pass A | school_admin | `/dashboard/hostel/roll-call` | expected: → /fr/dashboard/settings/entitlements (add-on off or access denied, correct gating) |
| Pass B | school_admin | `/dashboard/hostel/roll-call` | ok |

## Screenshots

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · school_admin · fr · `/dashboard/hostel/roll-call`

![school_admin fr](../../shots/A__school_admin-fr-hostel__roll-call.jpg)

**Pass B · seeded audit DB, all add-ons, 2026-09-23** · school_admin · fr · `/dashboard/hostel/roll-call`

![school_admin fr](../../shots/B__school_admin-fr-hostel__roll-call.jpg)

## Plan

- [ ] **S-32 (P1)** Sidebar links looser than their page; denied users land on the public homepage
  - [ ] Single permission source per route.
  - [ ] Access-denied page (now exists at `/dashboard/access-denied`, verify every guard uses it).
  - [ ] Sidebar-vs-guard unit test.
  - [ ] Accept: Re-sweep teacher/accountant: 0 redirects to `/fr`.
- [ ] **S-54 (P2)** Expired hostel stays stay "checked_in" forever
  - [ ] Query checked_in with end_date <= today.
  - [ ] Surface on hostel home.
  - [ ] Fix seed.
  - [ ] Accept: Expired stays are listed as overdue checkout.
- [ ] Re-run this page: `echo "/dashboard/hostel/roll-call" > r.txt && AUDIT_BASE=http://localhost:3333 node scripts/visual-sweep.mjs school_admin r.txt`

## Cross-cutting findings that also show here

- [S-7](../../findings/S-7.md) (P1) ~1 375 hardcoded French UI strings bypass translation (Arabic UI stays French)
- [S-14](../../findings/done/S-14.md) (P2) Sidebar lists add-on modules the tenant has not enabled
- [S-18](../../findings/done/S-18.md) (P1) Header claims CNDP compliance on every page; the school has not filed
- [S-25](../../findings/done/S-25.md) (P2) Header shows a fake identity when the session call is slow
- [S-37](../../findings/S-37.md) (P2) Arabic: dashboard widgets stay French; brand renders "OSSchool" in RTL
- [S-41](../../findings/done/S-41.md) (P1) Auth rate limit counts every page's session check, per IP
