# `/dashboard/cards`

**Status: NEEDS FIX (P3)** · Module: `cards` · Source: [`src/app/[locale]/(dashboard)/dashboard/cards/page.tsx`](<../../../../../src/app/[locale]/(dashboard)/dashboard/cards/page.tsx>)

**Progress (2026-09-24):** S-51 REVIEW
































Guard: `requireServerPage` · capability `cards.issue`

**Verdict:** 1 finding(s), worst P3. 2 sweep run(s): 2 clean or expected, 0 flagged. 2 screenshot(s).

## Findings on this page

| ID | Sev | Problem | Fix | Code now |
|---|---|---|---|---|
| [S-51](../../findings/S-51.md) | P3 | Cards "Émissions récentes" never shows the recipient | Show the student/employee name. | Not re-checked since the sweep. |

## Sweep results

| Pass | Role | URL tested | Result |
|---|---|---|---|
| Pass A | school_admin | `/dashboard/cards` | expected: → /fr/dashboard/settings/entitlements (add-on off or access denied, correct gating) |
| Pass B | school_admin | `/dashboard/cards` | ok |

## Screenshots

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · school_admin · fr · `/dashboard/cards`

![school_admin fr](../../shots/A__school_admin-fr-cards.jpg)

**Pass B · seeded audit DB, all add-ons, 2026-09-23** · school_admin · fr · `/dashboard/cards`

![school_admin fr](../../shots/B__school_admin-fr-cards.jpg)

## Plan

- [ ] **S-51 (P3)** Cards "Émissions récentes" never shows the recipient
  - [ ] Join and render.
  - [ ] Accept: Each row names its holder.
- [ ] Re-run this page: `echo "/dashboard/cards" > r.txt && AUDIT_BASE=http://localhost:3333 node scripts/visual-sweep.mjs school_admin r.txt`

## Cross-cutting findings that also show here

- [S-7](../../findings/S-7.md) (P1) ~1 375 hardcoded French UI strings bypass translation (Arabic UI stays French)
- [S-14](../../findings/S-14.md) (P2) Sidebar lists add-on modules the tenant has not enabled
- [S-18](../../findings/done/S-18.md) (P1) Header claims CNDP compliance on every page; the school has not filed
- [S-25](../../findings/done/S-25.md) (P2) Header shows a fake identity when the session call is slow
- [S-37](../../findings/S-37.md) (P2) Arabic: dashboard widgets stay French; brand renders "OSSchool" in RTL
- [S-41](../../findings/done/S-41.md) (P1) Auth rate limit counts every page's session check, per IP
