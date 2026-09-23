# `/dashboard/finance/bank-reconciliation`

**Status: PASS** · Module: `finance` · Source: [`src/app/[locale]/(dashboard)/dashboard/finance/bank-reconciliation/page.tsx`](<../../../../../src/app/[locale]/(dashboard)/dashboard/finance/bank-reconciliation/page.tsx>)

Guard: `requireServerPage` · capability `accounting.reconcile`

**Verdict:** No page-specific finding. 2 sweep run(s): 2 clean or expected, 0 flagged. 2 screenshot(s).

## Findings on this page

None specific to this page.

## Sweep results

| Pass | Role | URL tested | Result |
|---|---|---|---|
| Pass A | school_admin | `/dashboard/finance/bank-reconciliation` | ok |
| Pass A | accountant | `/dashboard/finance/bank-reconciliation` | ok |

## Screenshots

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · accountant · fr · `/dashboard/finance/bank-reconciliation`

![accountant fr](../../shots/A__accountant-fr-finance__bank-reconciliation.jpg)

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · school_admin · fr · `/dashboard/finance/bank-reconciliation`

![school_admin fr](../../shots/A__school_admin-fr-finance__bank-reconciliation.jpg)

## Plan

- No action. Keep this page in the regression sweep.

## Cross-cutting findings that also show here

- [S-7](../../findings/S-7.md) (P1) ~1 375 hardcoded French UI strings bypass translation (Arabic UI stays French)
- [S-14](../../findings/S-14.md) (P2) Sidebar lists add-on modules the tenant has not enabled
- [S-18](../../findings/S-18.md) (P1) Header claims CNDP compliance on every page; the school has not filed
- [S-25](../../findings/S-25.md) (P2) Header shows a fake identity when the session call is slow
- [S-37](../../findings/S-37.md) (P2) Arabic: dashboard widgets stay French; brand renders "OSSchool" in RTL
- [S-41](../../findings/S-41.md) (P1) Auth rate limit counts every page's session check, per IP
