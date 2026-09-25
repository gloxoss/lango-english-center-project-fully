# `/dashboard/teacher`

**Status: NEEDS FIX (P3)** · Module: `teacher` · Source: [`src/app/[locale]/(dashboard)/dashboard/teacher/page.tsx`](<../../../../../src/app/[locale]/(dashboard)/dashboard/teacher/page.tsx>)

**Progress (2026-09-25):** S-47 PARTIAL









































































































































































Guard: `requireServerPage` · roles `teacher`

**Verdict:** 1 finding(s), worst P3. 2 sweep run(s): 2 clean or expected, 0 flagged. 4 screenshot(s).

## Findings on this page

| ID | Sev | Problem | Fix | Code now |
|---|---|---|---|---|
| [S-47](../../findings/S-47.md) | P3 | Empty subtitle rendered as "—" (teacher class card, parent child picker) | Hide the empty part or show the class name. | Not re-checked since the sweep. |

## Sweep results

| Pass | Role | URL tested | Result |
|---|---|---|---|
| Pass A | teacher | `/dashboard/teacher` | ok |
| Pass B | teacher (prof.01) | `/dashboard/teacher` | ok |

## Screenshots

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · teacher · fr · `/dashboard/teacher`

![teacher fr](../../shots/A__teacher-fr-teacher.jpg)

**Pass B · seeded audit DB, all add-ons, 2026-09-23** · teacher · fr · `/dashboard/teacher`

![teacher fr](../../shots/B__teacher-fr-teacher.jpg)

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · teacher · desktop · `/dashboard/teacher`

![teacher desktop](../../shots/A__capture-teacher-home-desktop.jpg)

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · teacher · phone · `/dashboard/teacher`

![teacher phone](../../shots/A__capture-teacher-home-phone.jpg)

## Plan

- [ ] **S-47 (P3)** Empty subtitle rendered as "—" (teacher class card, parent child picker)
  - [ ] Fix both components.
  - [ ] Accept: No lone dash.
- [ ] Re-run this page: `echo "/dashboard/teacher" > r.txt && AUDIT_BASE=http://localhost:3333 node scripts/visual-sweep.mjs teacher r.txt`

## Cross-cutting findings that also show here

- [S-7](../../findings/S-7.md) (P1) ~1 375 hardcoded French UI strings bypass translation (Arabic UI stays French)
- [S-18](../../findings/done/S-18.md) (P1) Header claims CNDP compliance on every page; the school has not filed
- [S-25](../../findings/done/S-25.md) (P2) Header shows a fake identity when the session call is slow
- [S-37](../../findings/S-37.md) (P2) Arabic: dashboard widgets stay French; brand renders "OSSchool" in RTL
- [S-41](../../findings/done/S-41.md) (P1) Auth rate limit counts every page's session check, per IP
