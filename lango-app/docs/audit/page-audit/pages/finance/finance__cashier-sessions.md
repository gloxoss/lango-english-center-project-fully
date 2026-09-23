# `/dashboard/finance/cashier-sessions`

**Status: FIXED, pending re-sweep** · Module: `finance` · Source: [`src/app/[locale]/(dashboard)/dashboard/finance/cashier-sessions/page.tsx`](<../../../../../src/app/[locale]/(dashboard)/dashboard/finance/cashier-sessions/page.tsx>)

**Progress (2026-09-23):** S-27 DONE











Guard: `requireServerPage` · capability `finance.manage`

**Verdict:** 1 finding(s), worst P2. 2 sweep run(s): 2 clean or expected, 0 flagged. 2 screenshot(s).

## Findings on this page

| ID | Sev | Problem | Fix | Code now |
|---|---|---|---|---|
| [S-27](../../findings/done/S-27.md) | P2 | Cashier sessions: green "Écart cumulé 0 MAD" with zero sessions | Neutral "Aucune session" state. | Not re-checked since the sweep. |

## Sweep results

| Pass | Role | URL tested | Result |
|---|---|---|---|
| Pass A | school_admin | `/dashboard/finance/cashier-sessions` | ok |
| Pass A | accountant | `/dashboard/finance/cashier-sessions` | ok |

## Screenshots

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · accountant · fr · `/dashboard/finance/cashier-sessions`

![accountant fr](../../shots/A__accountant-fr-finance__cashier-sessions.jpg)

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · school_admin · fr · `/dashboard/finance/cashier-sessions`

![school_admin fr](../../shots/A__school_admin-fr-finance__cashier-sessions.jpg)

## Plan

- [ ] **S-27 (P2)** Cashier sessions: green "Écart cumulé 0 MAD" with zero sessions
  - [ ] Guard the badge.
  - [ ] Accept: No green check with 0 sessions.
- [ ] Re-run this page: `echo "/dashboard/finance/cashier-sessions" > r.txt && AUDIT_BASE=http://localhost:3333 node scripts/visual-sweep.mjs school_admin r.txt`

## Cross-cutting findings that also show here

- [S-7](../../findings/S-7.md) (P1) ~1 375 hardcoded French UI strings bypass translation (Arabic UI stays French)
- [S-14](../../findings/S-14.md) (P2) Sidebar lists add-on modules the tenant has not enabled
- [S-18](../../findings/done/S-18.md) (P1) Header claims CNDP compliance on every page; the school has not filed
- [S-25](../../findings/done/S-25.md) (P2) Header shows a fake identity when the session call is slow
- [S-37](../../findings/S-37.md) (P2) Arabic: dashboard widgets stay French; brand renders "OSSchool" in RTL
- [S-41](../../findings/done/S-41.md) (P1) Auth rate limit counts every page's session check, per IP
