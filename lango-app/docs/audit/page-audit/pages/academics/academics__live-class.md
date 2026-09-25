# `/dashboard/academics/live-class`

**Status: NEEDS FIX (P2)** · Module: `academics` · Source: [`src/app/[locale]/(dashboard)/dashboard/academics/live-class/page.tsx`](<../../../../../src/app/[locale]/(dashboard)/dashboard/academics/live-class/page.tsx>)

**Progress (2026-09-25):** S-46 PARTIAL









































































































































































Guard: `requireServerPage`, `requireLivePage` · capability `live.read`

**Verdict:** 1 finding(s), worst P2. 4 sweep run(s): 3 clean or expected, 1 flagged. 4 screenshot(s).

## Findings on this page

| ID | Sev | Problem | Fix | Code now |
|---|---|---|---|---|
| [S-46](../../findings/S-46.md) | P2 | Seed data contradicts itself (library loans, live-class dates) | Seed sets `checked_out` on loaned copies; live-class dates relative to `now()`. | Not re-checked since the sweep. |

## Sweep results

| Pass | Role | URL tested | Result |
|---|---|---|---|
| Pass A | school_admin | `/dashboard/academics/live-class` | expected: → /fr/dashboard/settings/entitlements (add-on off or access denied, correct gating) |
| Pass A | teacher | `/dashboard/academics/live-class` | expected: → /fr/dashboard/teacher (denied, sent to the role's own home; fine unless the sidebar shows this link, see S-32)<br>**S-41**: 429 /api/auth/get-session<br>**S-41**: 429 rate-limited |
| Pass B | school_admin | `/dashboard/academics/live-class` | ok |
| Pass B | teacher (prof.01) | `/dashboard/academics/live-class` | ok |

## Screenshots

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · school_admin · fr · `/dashboard/academics/live-class`

![school_admin fr](../../shots/A__school_admin-fr-academics__live-class.jpg)

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · teacher · fr · `/dashboard/academics/live-class`

![teacher fr](../../shots/A__teacher-fr-academics__live-class.jpg)

**Pass B · seeded audit DB, all add-ons, 2026-09-23** · school_admin · fr · `/dashboard/academics/live-class`

![school_admin fr](../../shots/B__school_admin-fr-academics__live-class.jpg)

**Pass B · seeded audit DB, all add-ons, 2026-09-23** · teacher · fr · `/dashboard/academics/live-class`

![teacher fr](../../shots/B__teacher-fr-academics__live-class.jpg)

## Plan

- [ ] **S-46 (P2)** Seed data contradicts itself (library loans, live-class dates)
  - [ ] Fix the seed.
  - [ ] Reseed and check the librarian home.
  - [ ] Accept: available = total − open loans.
- [ ] Re-run this page: `echo "/dashboard/academics/live-class" > r.txt && AUDIT_BASE=http://localhost:3333 node scripts/visual-sweep.mjs teacher r.txt`

## Cross-cutting findings that also show here

- [S-41](../../findings/done/S-41.md) (P1) Auth rate limit counts every page's session check, per IP
- [S-7](../../findings/S-7.md) (P1) ~1 375 hardcoded French UI strings bypass translation (Arabic UI stays French)
- [S-14](../../findings/done/S-14.md) (P2) Sidebar lists add-on modules the tenant has not enabled
- [S-18](../../findings/done/S-18.md) (P1) Header claims CNDP compliance on every page; the school has not filed
- [S-25](../../findings/done/S-25.md) (P2) Header shows a fake identity when the session call is slow
- [S-37](../../findings/S-37.md) (P2) Arabic: dashboard widgets stay French; brand renders "OSSchool" in RTL
