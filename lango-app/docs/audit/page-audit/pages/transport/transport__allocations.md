# `/dashboard/transport/allocations`

**Status: NEEDS FIX (P3)** · Module: `transport` · Source: [`src/app/[locale]/(dashboard)/dashboard/transport/allocations/page.tsx`](<../../../../../src/app/[locale]/(dashboard)/dashboard/transport/allocations/page.tsx>)

Guard: `requireServerPage` · capability `transport.assignment.read`

**Verdict:** 1 finding(s), worst P3. 2 sweep run(s): 1 clean or expected, 1 flagged. 2 screenshot(s).

## Findings on this page

| ID | Sev | Problem | Fix | Code now |
|---|---|---|---|---|
| [S-50](../../findings/S-50.md) | P3 | Transport allocations list without React keys | Add stable keys. | Not re-checked since the sweep. |

## Sweep results

| Pass | Role | URL tested | Result |
|---|---|---|---|
| Pass A | school_admin | `/dashboard/transport/allocations` | expected: → /fr/dashboard/settings/entitlements (add-on off or access denied, correct gating) |
| Pass B | school_admin | `/dashboard/transport/allocations` | **S-50**: console: Each child in a list should have a unique "key" prop.%s%s See https://react.dev/link/warning-keys for more information. |

## Screenshots

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · school_admin · fr · `/dashboard/transport/allocations`

![school_admin fr](../../shots/A__school_admin-fr-transport__allocations.jpg)

**Pass B · seeded audit DB, all add-ons, 2026-09-23** · school_admin · fr · `/dashboard/transport/allocations`

![school_admin fr](../../shots/B__school_admin-fr-transport__allocations.jpg)

## Plan

- [ ] **S-50 (P3)** Transport allocations list without React keys
  - [ ] Add keys.
  - [ ] Accept: No console warning.
- [ ] Re-run this page: `echo "/dashboard/transport/allocations" > r.txt && AUDIT_BASE=http://localhost:3333 node scripts/visual-sweep.mjs school_admin r.txt`

## Cross-cutting findings that also show here

- [S-7](../../findings/S-7.md) (P1) ~1 375 hardcoded French UI strings bypass translation (Arabic UI stays French)
- [S-14](../../findings/S-14.md) (P2) Sidebar lists add-on modules the tenant has not enabled
- [S-18](../../findings/S-18.md) (P1) Header claims CNDP compliance on every page; the school has not filed
- [S-25](../../findings/S-25.md) (P2) Header shows a fake identity when the session call is slow
- [S-37](../../findings/S-37.md) (P2) Arabic: dashboard widgets stay French; brand renders "OSSchool" in RTL
- [S-41](../../findings/S-41.md) (P1) Auth rate limit counts every page's session check, per IP
