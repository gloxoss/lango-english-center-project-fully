# `/dashboard/portals/leadership`

**Status: NEEDS FIX (P2)** · Module: `portals` · Source: [`src/app/[locale]/(dashboard)/dashboard/portals/leadership/page.tsx`](<../../../../../src/app/[locale]/(dashboard)/dashboard/portals/leadership/page.tsx>)

Guard: `requireLeadershipPage`

**Verdict:** 1 finding(s), worst P2. 1 sweep run(s): 1 clean or expected, 0 flagged. 1 screenshot(s).

## Findings on this page

| ID | Sev | Problem | Fix | Code now |
|---|---|---|---|---|
| [S-15](../../findings/S-15.md) | P2 | Two director dashboards with overlapping KPIs; IGP unexplained | Merge or clearly separate; explain IGP on screen; rename "Objectif". | Not re-checked since the sweep. |

## Sweep results

| Pass | Role | URL tested | Result |
|---|---|---|---|
| Pass A | school_admin | `/dashboard/portals/leadership` | ok |

## Screenshots

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · school_admin · fr · `/dashboard/portals/leadership`

![school_admin fr](../../shots/A__school_admin-fr-portals__leadership.jpg)

## Plan

- [ ] **S-15 (P2)** Two director dashboards with overlapping KPIs; IGP unexplained
  - [ ] Pick one home dashboard.
  - [ ] Add an IGP tooltip with weights.
  - [ ] Accept: Each KPI appears once with a clear definition.
- [ ] Re-run this page: `echo "/dashboard/portals/leadership" > r.txt && AUDIT_BASE=http://localhost:3333 node scripts/visual-sweep.mjs school_admin r.txt`

## Cross-cutting findings that also show here

- [S-7](../../findings/S-7.md) (P1) ~1 375 hardcoded French UI strings bypass translation (Arabic UI stays French)
- [S-14](../../findings/S-14.md) (P2) Sidebar lists add-on modules the tenant has not enabled
- [S-18](../../findings/S-18.md) (P1) Header claims CNDP compliance on every page; the school has not filed
- [S-25](../../findings/S-25.md) (P2) Header shows a fake identity when the session call is slow
- [S-37](../../findings/S-37.md) (P2) Arabic: dashboard widgets stay French; brand renders "OSSchool" in RTL
- [S-41](../../findings/S-41.md) (P1) Auth rate limit counts every page's session check, per IP
