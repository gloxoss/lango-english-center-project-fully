# `/dashboard/portals/librarian`

**Status: NEEDS FIX (P2)** · Module: `portals` · Source: [`src/app/[locale]/(dashboard)/dashboard/portals/librarian/page.tsx`](<../../../../../src/app/[locale]/(dashboard)/dashboard/portals/librarian/page.tsx>)

**Progress (2026-09-23):** S-46 OPEN











Guard: `requireLibraryPage` · capability `library.report.read`

**Verdict:** 1 finding(s), worst P2. 1 sweep run(s): 1 clean or expected, 0 flagged. 1 screenshot(s).

## Findings on this page

| ID | Sev | Problem | Fix | Code now |
|---|---|---|---|---|
| [S-46](../../findings/S-46.md) | P2 | Seed data contradicts itself (library loans, live-class dates) | Seed sets `checked_out` on loaned copies; live-class dates relative to `now()`. | Not re-checked since the sweep. |

## Sweep results

| Pass | Role | URL tested | Result |
|---|---|---|---|
| Pass B | librarian | `/dashboard/portals/librarian` | ok |

## Screenshots

**Pass B · seeded audit DB, all add-ons, 2026-09-23** · librarian · fr · `/dashboard/portals/librarian`

![librarian fr](../../shots/B__librarian-fr-portals__librarian.jpg)

## Plan

- [ ] **S-46 (P2)** Seed data contradicts itself (library loans, live-class dates)
  - [ ] Fix the seed.
  - [ ] Reseed and check the librarian home.
  - [ ] Accept: available = total − open loans.
- [ ] Re-run this page: `echo "/dashboard/portals/librarian" > r.txt && AUDIT_BASE=http://localhost:3333 node scripts/visual-sweep.mjs librarian r.txt`

## Cross-cutting findings that also show here

- [S-7](../../findings/S-7.md) (P1) ~1 375 hardcoded French UI strings bypass translation (Arabic UI stays French)
- [S-18](../../findings/done/S-18.md) (P1) Header claims CNDP compliance on every page; the school has not filed
- [S-25](../../findings/done/S-25.md) (P2) Header shows a fake identity when the session call is slow
- [S-37](../../findings/S-37.md) (P2) Arabic: dashboard widgets stay French; brand renders "OSSchool" in RTL
- [S-41](../../findings/done/S-41.md) (P1) Auth rate limit counts every page's session check, per IP
