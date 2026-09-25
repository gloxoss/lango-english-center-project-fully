# `/dashboard/finance/receivables`

**Status: FIXED, pending re-sweep** · Module: `finance` · Source: [`src/app/[locale]/(dashboard)/dashboard/finance/receivables/page.tsx`](<../../../../../src/app/[locale]/(dashboard)/dashboard/finance/receivables/page.tsx>)

**Progress (2026-09-25):** S-28 DONE









































































































































































Guard: `requireServerPage` · capability `finance.read`

**Verdict:** 1 finding(s), worst P2. 2 sweep run(s): 2 clean or expected, 0 flagged. 2 screenshot(s).

## Findings on this page

| ID | Sev | Problem | Fix | Code now |
|---|---|---|---|---|
| [S-28](../../findings/done/S-28.md) | P2 | Receivables aging treats not-yet-due invoices as late and offers an SMS reminder | "Non échu" bucket; no reminder for not-due invoices; hide placeholder emails. | Not re-checked since the sweep. |

## Sweep results

| Pass | Role | URL tested | Result |
|---|---|---|---|
| Pass A | accountant | `/dashboard/finance/receivables` | ok |
| Pass A | school_admin | `/dashboard/finance/receivables` | ok |

## Screenshots

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · accountant · fr · `/dashboard/finance/receivables`

![accountant fr](../../shots/A__accountant-fr-finance__receivables.jpg)

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · school_admin · fr · `/dashboard/finance/receivables`

![school_admin fr](../../shots/A__school_admin-fr-finance__receivables.jpg)

## Plan

- [ ] **S-28 (P2)** Receivables aging treats not-yet-due invoices as late and offers an SMS reminder
  - [ ] Add the bucket.
  - [ ] Hide the action.
  - [ ] Test with a future due date.
  - [ ] Accept: Not-due invoices cannot be reminded.
- [ ] Re-run this page: `echo "/dashboard/finance/receivables" > r.txt && AUDIT_BASE=http://localhost:3333 node scripts/visual-sweep.mjs accountant r.txt`

## Cross-cutting findings that also show here

- [S-7](../../findings/S-7.md) (P1) ~1 375 hardcoded French UI strings bypass translation (Arabic UI stays French)
- [S-14](../../findings/done/S-14.md) (P2) Sidebar lists add-on modules the tenant has not enabled
- [S-18](../../findings/done/S-18.md) (P1) Header claims CNDP compliance on every page; the school has not filed
- [S-25](../../findings/done/S-25.md) (P2) Header shows a fake identity when the session call is slow
- [S-37](../../findings/S-37.md) (P2) Arabic: dashboard widgets stay French; brand renders "OSSchool" in RTL
- [S-41](../../findings/done/S-41.md) (P1) Auth rate limit counts every page's session check, per IP
