# `/dashboard/settings`

**Status: NEEDS FIX (P1)** · Module: `settings` · Source: [`src/app/[locale]/(dashboard)/dashboard/settings/page.tsx`](<../../../../../src/app/[locale]/(dashboard)/dashboard/settings/page.tsx>)

**Progress (2026-09-23):** S-32 PARTIAL · S-26 OPEN











Guard: `requireServerPage` · capability `settings.organization.manage`

**Verdict:** 2 finding(s), worst P1. 3 sweep run(s): 3 clean or expected, 0 flagged. 3 screenshot(s).

## Findings on this page

| ID | Sev | Problem | Fix | Code now |
|---|---|---|---|---|
| [S-32](../../findings/S-32.md) | P1 | Sidebar links looser than their page; denied users land on the public homepage | Derive the sidebar permission from the page guard; denial renders in-app "Accès refusé"; remove dead links; test that walks sidebar vs guards. | Not re-checked since the sweep. |
| [S-26](../../findings/S-26.md) | P2 | Settings page: wrong "Configuré" state, raw English actions, spec codes | Real states, translated actions, no spec codes, over-quota warning. | Not re-checked since the sweep. |

## Sweep results

| Pass | Role | URL tested | Result |
|---|---|---|---|
| Pass A | school_admin | `/dashboard/settings` | expected: false positive: provider name "SMS.ma" |
| Pass A | school_admin (ar) | `/dashboard/settings` | expected: false positive: provider name "SMS.ma" |
| Pass A | school_admin (phone) | `/dashboard/settings` | expected: false positive: provider name "SMS.ma" |

## Screenshots

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · school_admin · ar · `/dashboard/settings`

![school_admin ar](../../shots/A__school_admin-ar-settings.jpg)

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · school_admin · fr phone · `/dashboard/settings`

![school_admin fr phone](../../shots/A__school_admin-fr-phone-settings.jpg)

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · school_admin · fr · `/dashboard/settings`

![school_admin fr](../../shots/A__school_admin-fr-settings.jpg)

## Plan

- [ ] **S-32 (P1)** Sidebar links looser than their page; denied users land on the public homepage
  - [ ] Single permission source per route.
  - [ ] Access-denied page (now exists at `/dashboard/access-denied`, verify every guard uses it).
  - [ ] Sidebar-vs-guard unit test.
  - [ ] Accept: Re-sweep teacher/accountant: 0 redirects to `/fr`.
- [ ] **S-26 (P2)** Settings page: wrong "Configuré" state, raw English actions, spec codes
  - [ ] Fix each item.
  - [ ] Accept: Settings reflects real state.
- [ ] Re-run this page: `echo "/dashboard/settings" > r.txt && AUDIT_BASE=http://localhost:3333 node scripts/visual-sweep.mjs school_admin r.txt`

## Cross-cutting findings that also show here

- [S-7](../../findings/S-7.md) (P1) ~1 375 hardcoded French UI strings bypass translation (Arabic UI stays French)
- [S-14](../../findings/S-14.md) (P2) Sidebar lists add-on modules the tenant has not enabled
- [S-18](../../findings/done/S-18.md) (P1) Header claims CNDP compliance on every page; the school has not filed
- [S-25](../../findings/done/S-25.md) (P2) Header shows a fake identity when the session call is slow
- [S-37](../../findings/S-37.md) (P2) Arabic: dashboard widgets stay French; brand renders "OSSchool" in RTL
- [S-41](../../findings/done/S-41.md) (P1) Auth rate limit counts every page's session check, per IP
