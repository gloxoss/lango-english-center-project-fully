# `/dashboard/inventory/overview`

**Status: NEEDS FIX (P2)** · Module: `inventory` · Source: [`src/app/[locale]/(dashboard)/dashboard/inventory/overview/page.tsx`](<../../../../../src/app/[locale]/(dashboard)/dashboard/inventory/overview/page.tsx>)

Guard: `requireServerPage` · capability `inventory.read`

**Verdict:** 1 finding(s), worst P2. 2 sweep run(s): 2 clean or expected, 0 flagged. 2 screenshot(s).

## Findings on this page

| ID | Sev | Problem | Fix | Code now |
|---|---|---|---|---|
| [S-56](../../findings/S-56.md) | P2 | Inventory quantities read as thousands ("+12.000" for 12) | Locale-aware quantity formatting without trailing zeros; plural fix. | Not re-checked since the sweep. |

## Sweep results

| Pass | Role | URL tested | Result |
|---|---|---|---|
| Pass A | school_admin | `/dashboard/inventory/overview` | expected: → /fr/dashboard/settings/entitlements (add-on off or access denied, correct gating) |
| Pass B | school_admin | `/dashboard/inventory/overview` | ok |

## Screenshots

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · school_admin · fr · `/dashboard/inventory/overview`

![school_admin fr](../../shots/A__school_admin-fr-inventory__overview.jpg)

**Pass B · seeded audit DB, all add-ons, 2026-09-23** · school_admin · fr · `/dashboard/inventory/overview`

![school_admin fr](../../shots/B__school_admin-fr-inventory__overview.jpg)

## Plan

- [ ] **S-56 (P2)** Inventory quantities read as thousands ("+12.000" for 12)
  - [ ] Shared quantity formatter.
  - [ ] Apply in inventory views.
  - [ ] Accept: "+12" shown.
- [ ] Re-run this page: `echo "/dashboard/inventory/overview" > r.txt && AUDIT_BASE=http://localhost:3333 node scripts/visual-sweep.mjs school_admin r.txt`

## Cross-cutting findings that also show here

- [S-7](../../findings/S-7.md) (P1) ~1 375 hardcoded French UI strings bypass translation (Arabic UI stays French)
- [S-14](../../findings/S-14.md) (P2) Sidebar lists add-on modules the tenant has not enabled
- [S-18](../../findings/S-18.md) (P1) Header claims CNDP compliance on every page; the school has not filed
- [S-25](../../findings/S-25.md) (P2) Header shows a fake identity when the session call is slow
- [S-37](../../findings/S-37.md) (P2) Arabic: dashboard widgets stay French; brand renders "OSSchool" in RTL
- [S-41](../../findings/S-41.md) (P1) Auth rate limit counts every page's session check, per IP
