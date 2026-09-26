# `/dashboard/inventory/products`
<!-- swept: 2026-09-24 claude-finance | school_admin sweep :3466 schoolos_audit 2026-09-24: loads, no failed API, no h-scroll, no text defects -->

**Status: NEEDS FIX (P1)** · Module: `inventory` · Source: [`src/app/[locale]/(dashboard)/dashboard/inventory/products/page.tsx`](<../../../../../src/app/[locale]/(dashboard)/dashboard/inventory/products/page.tsx>)

**Progress (2026-09-26):** S-32 PARTIAL · S-56 DONE






















































































































































































Guard: `requireServerPage` · capability `inventory.catalog.manage`

**Verdict:** 2 finding(s), worst P1. 2 sweep run(s): 2 clean or expected, 0 flagged. 2 screenshot(s).

## Findings on this page

| ID | Sev | Problem | Fix | Code now |
|---|---|---|---|---|
| [S-32](../../findings/S-32.md) | P1 | Sidebar links looser than their page; denied users land on the public homepage | Derive the sidebar permission from the page guard; denial renders in-app "Accès refusé"; remove dead links; test that walks sidebar vs guards. | Not re-checked since the sweep. |
| [S-56](../../findings/done/S-56.md) | P2 | Inventory quantities read as thousands ("+12.000" for 12) | Locale-aware quantity formatting without trailing zeros; plural fix. | Not re-checked since the sweep. |

## Sweep results

| Pass | Role | URL tested | Result |
|---|---|---|---|
| Pass A | school_admin | `/dashboard/inventory/products` | expected: → /fr/dashboard/settings/entitlements (add-on off or access denied, correct gating) |
| Pass B | school_admin | `/dashboard/inventory/products` | ok |

## Screenshots

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · school_admin · fr · `/dashboard/inventory/products`

![school_admin fr](../../shots/A__school_admin-fr-inventory__products.jpg)

**Pass B · seeded audit DB, all add-ons, 2026-09-23** · school_admin · fr · `/dashboard/inventory/products`

![school_admin fr](../../shots/B__school_admin-fr-inventory__products.jpg)

## Plan

- [ ] **S-32 (P1)** Sidebar links looser than their page; denied users land on the public homepage
  - [ ] Single permission source per route.
  - [ ] Access-denied page (now exists at `/dashboard/access-denied`, verify every guard uses it).
  - [ ] Sidebar-vs-guard unit test.
  - [ ] Accept: Re-sweep teacher/accountant: 0 redirects to `/fr`.
- [ ] **S-56 (P2)** Inventory quantities read as thousands ("+12.000" for 12)
  - [ ] Shared quantity formatter.
  - [ ] Apply in inventory views.
  - [ ] Accept: "+12" shown.
- [ ] Re-run this page: `echo "/dashboard/inventory/products" > r.txt && AUDIT_BASE=http://localhost:3333 node scripts/visual-sweep.mjs school_admin r.txt`

## Cross-cutting findings that also show here

- [S-7](../../findings/S-7.md) (P1) ~1 375 hardcoded French UI strings bypass translation (Arabic UI stays French)
- [S-14](../../findings/done/S-14.md) (P2) Sidebar lists add-on modules the tenant has not enabled
- [S-18](../../findings/done/S-18.md) (P1) Header claims CNDP compliance on every page; the school has not filed
- [S-25](../../findings/done/S-25.md) (P2) Header shows a fake identity when the session call is slow
- [S-37](../../findings/S-37.md) (P2) Arabic: dashboard widgets stay French; brand renders "OSSchool" in RTL
- [S-41](../../findings/done/S-41.md) (P1) Auth rate limit counts every page's session check, per IP
