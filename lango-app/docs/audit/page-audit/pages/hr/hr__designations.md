# `/dashboard/hr/designations`

**Status: FIXED, pending re-sweep** · Module: `hr` · Source: [`src/app/[locale]/(dashboard)/dashboard/hr/designations/page.tsx`](<../../../../../src/app/[locale]/(dashboard)/dashboard/hr/designations/page.tsx>)

**Progress (2026-09-25):** S-6 DONE · S-43 DONE









































































































































































Guard: `requireServerPage` · capability `hr.organization.manage`

**Verdict:** 2 finding(s), worst P1. 2 sweep run(s): 1 clean or expected, 1 flagged. 2 screenshot(s).

## Findings on this page

| ID | Sev | Problem | Fix | Code now |
|---|---|---|---|---|
| [S-6](../../findings/done/S-6.md) | P1 | Translation keys used in code are missing (users see raw keys or blanks) | Add every missing key in fr, ar, en; fix formatting calls that omit their values. | LIKELY FIXED in the working tree |
| [S-43](../../findings/done/S-43.md) | P2 | `HR.colStatus` missing on 3 HR pages | Add `HR.colStatus` (fr/ar/en). | LIKELY FIXED in the working tree |

## Sweep results

| Pass | Role | URL tested | Result |
|---|---|---|---|
| Pass A | school_admin | `/dashboard/hr/designations` | expected: → /fr/dashboard/settings/entitlements (add-on off or access denied, correct gating) |
| Pass B | school_admin | `/dashboard/hr/designations` | **S-6**: console: IntlError: MISSING_MESSAGE: Could not resolve `HR.colStatus` in messages for locale `fr`. |

## Screenshots

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · school_admin · fr · `/dashboard/hr/designations`

![school_admin fr](../../shots/A__school_admin-fr-hr__designations.jpg)

**Pass B · seeded audit DB, all add-ons, 2026-09-23** · school_admin · fr · `/dashboard/hr/designations`

![school_admin fr](../../shots/B__school_admin-fr-hr__designations.jpg)

## Plan

- [ ] **S-6 (P1)** Translation keys used in code are missing (users see raw keys or blanks)
  - [ ] Run the checker, add keys until it exits 0.
  - [ ] Re-run the runtime sweep on the listed pages; 0 `MISSING_MESSAGE`.
  - [ ] Add the checker to CI.
  - [ ] Accept: Checker exits 0 and the runtime sweep shows no raw keys.
- [ ] **S-43 (P2)** `HR.colStatus` missing on 3 HR pages
  - [ ] Add key.
  - [ ] Accept: Header visible.
- [ ] Re-run this page: `echo "/dashboard/hr/designations" > r.txt && AUDIT_BASE=http://localhost:3333 node scripts/visual-sweep.mjs school_admin r.txt`

## Cross-cutting findings that also show here

- [S-7](../../findings/S-7.md) (P1) ~1 375 hardcoded French UI strings bypass translation (Arabic UI stays French)
- [S-14](../../findings/done/S-14.md) (P2) Sidebar lists add-on modules the tenant has not enabled
- [S-18](../../findings/done/S-18.md) (P1) Header claims CNDP compliance on every page; the school has not filed
- [S-25](../../findings/done/S-25.md) (P2) Header shows a fake identity when the session call is slow
- [S-37](../../findings/S-37.md) (P2) Arabic: dashboard widgets stay French; brand renders "OSSchool" in RTL
- [S-41](../../findings/done/S-41.md) (P1) Auth rate limit counts every page's session check, per IP
