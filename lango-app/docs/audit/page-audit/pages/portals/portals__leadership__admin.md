# `/dashboard/portals/leadership/admin`

**Status: NEEDS FIX (P2)** · Module: `portals` · Source: [`src/app/[locale]/(dashboard)/dashboard/portals/leadership/admin/page.tsx`](<../../../../../src/app/[locale]/(dashboard)/dashboard/portals/leadership/admin/page.tsx>)

**Progress (2026-09-23):** S-22 OPEN











Guard: `requireLeadershipPage`

**Verdict:** 1 finding(s), worst P2. 1 sweep run(s): 0 clean or expected, 1 flagged. 1 screenshot(s).

## Findings on this page

| ID | Sev | Problem | Fix | Code now |
|---|---|---|---|---|
| [S-22](../../findings/S-22.md) | P2 | Leadership admin calls HR API when HR add-on is off | Check the add-on first; hide that section. | Not re-checked since the sweep. |

## Sweep results

| Pass | Role | URL tested | Result |
|---|---|---|---|
| Pass A | school_admin | `/dashboard/portals/leadership/admin` | **S-22**: 403 /api/hr/departments |

## Screenshots

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · school_admin · fr · `/dashboard/portals/leadership/admin`

![school_admin fr](../../shots/A__school_admin-fr-portals__leadership__admin.jpg)

## Plan

- [ ] **S-22 (P2)** Leadership admin calls HR API when HR add-on is off
  - [ ] Guard the fetch.
  - [ ] Accept: No 403 with HR off.
- [ ] Re-run this page: `echo "/dashboard/portals/leadership/admin" > r.txt && AUDIT_BASE=http://localhost:3333 node scripts/visual-sweep.mjs school_admin r.txt`

## Cross-cutting findings that also show here

- [S-7](../../findings/S-7.md) (P1) ~1 375 hardcoded French UI strings bypass translation (Arabic UI stays French)
- [S-14](../../findings/S-14.md) (P2) Sidebar lists add-on modules the tenant has not enabled
- [S-18](../../findings/done/S-18.md) (P1) Header claims CNDP compliance on every page; the school has not filed
- [S-25](../../findings/done/S-25.md) (P2) Header shows a fake identity when the session call is slow
- [S-37](../../findings/S-37.md) (P2) Arabic: dashboard widgets stay French; brand renders "OSSchool" in RTL
- [S-41](../../findings/done/S-41.md) (P1) Auth rate limit counts every page's session check, per IP
