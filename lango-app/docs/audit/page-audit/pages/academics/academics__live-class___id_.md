# `/dashboard/academics/live-class/[id]`

**Status: NEEDS FIX (P2)** · Module: `academics` · Source: [`src/app/[locale]/(dashboard)/dashboard/academics/live-class/[id]/page.tsx`](<../../../../../src/app/[locale]/(dashboard)/dashboard/academics/live-class/[id]/page.tsx>)

**Progress (2026-09-24):** S-46 REVIEW
































Guard: `requireServerPage`, `requireLivePage` · capability `live.read`

**Verdict:** 1 finding(s), worst P2. 2 sweep run(s): 2 clean or expected, 0 flagged. 2 screenshot(s).

## Findings on this page

| ID | Sev | Problem | Fix | Code now |
|---|---|---|---|---|
| [S-46](../../findings/S-46.md) | P2 | Seed data contradicts itself (library loans, live-class dates) | Seed sets `checked_out` on loaned copies; live-class dates relative to `now()`. | Not re-checked since the sweep. |

## Sweep results

| Pass | Role | URL tested | Result |
|---|---|---|---|
| Pass C | school_admin | `/dashboard/academics/live-class/724aa76c-3475-43f8-9aef-a52d62e7f55d` | ok |
| Pass C | parent | `/dashboard/academics/live-class/724aa76c-3475-43f8-9aef-a52d62e7f55d` | ok, blocked → /fr/dashboard/access-denied<br>ok, 403 /api/settings/branches (data blocked, expected) |

## Screenshots

**Pass C · detail + public pages, 2026-09-23** · school_admin · fr · `/dashboard/academics/live-class/724aa76c-3475-43f8-9aef-a52d62e7f55d`

![school_admin fr](../../shots/C__school_admin-fr-academics__live-class__724aa76c-3475-43f8-9aef-a52d62e7f55d.jpg)

**Pass C · parent typing staff URLs (expected: blocked)** · parent · fr · `/dashboard/academics/live-class/724aa76c-3475-43f8-9aef-a52d62e7f55d`

![parent fr](../../shots/C-idor__parent-fr-academics__live-class__724aa76c-3475-43f8-9aef-a52d62e7f55d.jpg)

## Plan

- [ ] **S-46 (P2)** Seed data contradicts itself (library loans, live-class dates)
  - [ ] Fix the seed.
  - [ ] Reseed and check the librarian home.
  - [ ] Accept: available = total − open loans.
- [ ] Re-run this page: `echo "/dashboard/academics/live-class/724aa76c-3475-43f8-9aef-a52d62e7f55d" > r.txt && AUDIT_BASE=http://localhost:3333 node scripts/visual-sweep.mjs school_admin r.txt`

## Cross-cutting findings that also show here

- [S-7](../../findings/S-7.md) (P1) ~1 375 hardcoded French UI strings bypass translation (Arabic UI stays French)
- [S-14](../../findings/S-14.md) (P2) Sidebar lists add-on modules the tenant has not enabled
- [S-18](../../findings/done/S-18.md) (P1) Header claims CNDP compliance on every page; the school has not filed
- [S-25](../../findings/done/S-25.md) (P2) Header shows a fake identity when the session call is slow
- [S-37](../../findings/S-37.md) (P2) Arabic: dashboard widgets stay French; brand renders "OSSchool" in RTL
- [S-41](../../findings/done/S-41.md) (P1) Auth rate limit counts every page's session check, per IP
- [S-44](../../findings/S-44.md) (P2) Staff campus switcher renders for parents, students and super admin (403 on every page)
