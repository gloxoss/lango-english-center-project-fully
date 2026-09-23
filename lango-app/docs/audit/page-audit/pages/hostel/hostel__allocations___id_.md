# `/dashboard/hostel/allocations/[id]`

**Status: NEEDS FIX (P2)** · Module: `hostel` · Source: [`src/app/[locale]/(dashboard)/dashboard/hostel/allocations/[id]/page.tsx`](<../../../../../src/app/[locale]/(dashboard)/dashboard/hostel/allocations/[id]/page.tsx>)

**Progress (2026-09-23):** S-54 OPEN











Guard: `requireServerPage` · capability `hostel.allocation.read`

**Verdict:** 1 finding(s), worst P2. 2 sweep run(s): 2 clean or expected, 0 flagged. 2 screenshot(s).

## Findings on this page

| ID | Sev | Problem | Fix | Code now |
|---|---|---|---|---|
| [S-54](../../findings/S-54.md) | P2 | Expired hostel stays stay "checked_in" forever | Overdue-checkout list and alert; seed dates relative to `now()`. | Not re-checked since the sweep. |

## Sweep results

| Pass | Role | URL tested | Result |
|---|---|---|---|
| Pass C | school_admin | `/dashboard/hostel/allocations/bae24d76-c954-44c2-9dd6-1f2ce12631fe` | ok |
| Pass C | parent | `/dashboard/hostel/allocations/bae24d76-c954-44c2-9dd6-1f2ce12631fe` | ok, blocked → /fr/dashboard/access-denied<br>ok, 403 /api/settings/branches (data blocked, expected) |

## Screenshots

**Pass C · detail + public pages, 2026-09-23** · school_admin · fr · `/dashboard/hostel/allocations/bae24d76-c954-44c2-9dd6-1f2ce12631fe`

![school_admin fr](../../shots/C__school_admin-fr-hostel__allocations__bae24d76-c954-44c2-9dd6-1f2ce12631fe.jpg)

**Pass C · parent typing staff URLs (expected: blocked)** · parent · fr · `/dashboard/hostel/allocations/bae24d76-c954-44c2-9dd6-1f2ce12631fe`

![parent fr](../../shots/C-idor__parent-fr-hostel__allocations__bae24d76-c954-44c2-9dd6-1f2ce12631fe.jpg)

## Plan

- [ ] **S-54 (P2)** Expired hostel stays stay "checked_in" forever
  - [ ] Query checked_in with end_date <= today.
  - [ ] Surface on hostel home.
  - [ ] Fix seed.
  - [ ] Accept: Expired stays are listed as overdue checkout.
- [ ] Re-run this page: `echo "/dashboard/hostel/allocations/bae24d76-c954-44c2-9dd6-1f2ce12631fe" > r.txt && AUDIT_BASE=http://localhost:3333 node scripts/visual-sweep.mjs school_admin r.txt`

## Cross-cutting findings that also show here

- [S-7](../../findings/S-7.md) (P1) ~1 375 hardcoded French UI strings bypass translation (Arabic UI stays French)
- [S-14](../../findings/S-14.md) (P2) Sidebar lists add-on modules the tenant has not enabled
- [S-18](../../findings/done/S-18.md) (P1) Header claims CNDP compliance on every page; the school has not filed
- [S-25](../../findings/done/S-25.md) (P2) Header shows a fake identity when the session call is slow
- [S-37](../../findings/S-37.md) (P2) Arabic: dashboard widgets stay French; brand renders "OSSchool" in RTL
- [S-41](../../findings/done/S-41.md) (P1) Auth rate limit counts every page's session check, per IP
- [S-44](../../findings/S-44.md) (P2) Staff campus switcher renders for parents, students and super admin (403 on every page)
