# `/dashboard/students`

**Status: NEEDS FIX (P2)** · Module: `students` · Source: [`src/app/[locale]/(dashboard)/dashboard/students/page.tsx`](<../../../../../src/app/[locale]/(dashboard)/dashboard/students/page.tsx>)

**Progress (2026-09-24):** S-24 OPEN
































Guard: `requireServerPage` · capability `students.read`

**Verdict:** 1 finding(s), worst P2. 5 sweep run(s): 5 clean or expected, 0 flagged. 8 screenshot(s).

## Findings on this page

| ID | Sev | Problem | Fix | Code now |
|---|---|---|---|---|
| [S-24](../../findings/S-24.md) | P2 | Three matricule formats in one tenant | One generator driven by tenant settings; migrate or tag legacy values. | Not re-checked since the sweep. |

## Sweep results

| Pass | Role | URL tested | Result |
|---|---|---|---|
| Pass A | school_admin | `/dashboard/students` | expected: harness: warm-up request aborted by the measured reload (page renders its data) |
| Pass A | school_admin (ar) | `/dashboard/students` | ok |
| Pass A | school_admin (phone) | `/dashboard/students` | ok |
| Pass A | teacher | `/dashboard/students` | ok |
| Pass B | teacher (prof.01) | `/dashboard/students` | ok |

## Screenshots

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · school_admin · ar · `/dashboard/students`

![school_admin ar](../../shots/A__school_admin-ar-students.jpg)

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · school_admin · fr phone · `/dashboard/students`

![school_admin fr phone](../../shots/A__school_admin-fr-phone-students.jpg)

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · school_admin · fr · `/dashboard/students`

![school_admin fr](../../shots/A__school_admin-fr-students.jpg)

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · teacher · fr · `/dashboard/students`

![teacher fr](../../shots/A__teacher-fr-students.jpg)

**Pass B · seeded audit DB, all add-ons, 2026-09-23** · teacher · fr · `/dashboard/students`

![teacher fr](../../shots/B__teacher-fr-students.jpg)

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · school_admin · desktop · `/dashboard/students`

![school_admin desktop](../../shots/A__capture-school_admin-students-desktop.jpg)

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · school_admin · phone · `/dashboard/students`

![school_admin phone](../../shots/A__capture-school_admin-students-phone.jpg)

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · school_admin · ar · `/dashboard/students`

![school_admin ar](../../shots/A__capture-school_admin-students-ar.jpg)

## Plan

- [ ] **S-24 (P2)** Three matricule formats in one tenant
  - [ ] Unify generation.
  - [ ] Accept: New students get one format.
- [ ] Re-run this page: `echo "/dashboard/students" > r.txt && AUDIT_BASE=http://localhost:3333 node scripts/visual-sweep.mjs school_admin r.txt`

## Cross-cutting findings that also show here

- [S-7](../../findings/S-7.md) (P1) ~1 375 hardcoded French UI strings bypass translation (Arabic UI stays French)
- [S-14](../../findings/S-14.md) (P2) Sidebar lists add-on modules the tenant has not enabled
- [S-18](../../findings/done/S-18.md) (P1) Header claims CNDP compliance on every page; the school has not filed
- [S-25](../../findings/done/S-25.md) (P2) Header shows a fake identity when the session call is slow
- [S-37](../../findings/S-37.md) (P2) Arabic: dashboard widgets stay French; brand renders "OSSchool" in RTL
- [S-41](../../findings/done/S-41.md) (P1) Auth rate limit counts every page's session check, per IP
