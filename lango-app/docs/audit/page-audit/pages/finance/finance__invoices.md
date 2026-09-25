# `/dashboard/finance/invoices`
<!-- swept: 2026-09-24 claude-finance | school_admin+accountant sweep :3466 schoolos_audit 2026-09-24: loads, no failed API, no h-scroll, no text defects -->

**Status: NEEDS FIX (P2)** · Module: `finance` · Source: [`src/app/[locale]/(dashboard)/dashboard/finance/invoices/page.tsx`](<../../../../../src/app/[locale]/(dashboard)/dashboard/finance/invoices/page.tsx>)

**Progress (2026-09-25):** S-31 DONE · S-36 PARTIAL









































































































































































Guard: `requireServerPage` · capability `finance.read`

**Verdict:** 2 finding(s), worst P2. 4 sweep run(s): 4 clean or expected, 0 flagged. 4 screenshot(s).

## Findings on this page

| ID | Sev | Problem | Fix | Code now |
|---|---|---|---|---|
| [S-31](../../findings/done/S-31.md) | P2 | Developer copy on finance screens | User-facing wording; distinct titles. | Not re-checked since the sweep. |
| [S-36](../../findings/S-36.md) | P2 | Invoices on phone: desktop table squeezed, status off-screen | Card layout like the students list. | Not re-checked since the sweep. |

## Sweep results

| Pass | Role | URL tested | Result |
|---|---|---|---|
| Pass A | school_admin | `/dashboard/finance/invoices` | expected: harness: warm-up request aborted by the measured reload (page renders its data) |
| Pass A | accountant | `/dashboard/finance/invoices` | ok |
| Pass A | school_admin (ar) | `/dashboard/finance/invoices` | ok |
| Pass A | school_admin (phone) | `/dashboard/finance/invoices` | ok |

## Screenshots

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · accountant · fr · `/dashboard/finance/invoices`

![accountant fr](../../shots/A__accountant-fr-finance__invoices.jpg)

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · school_admin · ar · `/dashboard/finance/invoices`

![school_admin ar](../../shots/A__school_admin-ar-finance__invoices.jpg)

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · school_admin · fr · `/dashboard/finance/invoices`

![school_admin fr](../../shots/A__school_admin-fr-finance__invoices.jpg)

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · school_admin · fr phone · `/dashboard/finance/invoices`

![school_admin fr phone](../../shots/A__school_admin-fr-phone-finance__invoices.jpg)

## Plan

- [ ] **S-31 (P2)** Developer copy on finance screens
  - [ ] Edit copy.
  - [ ] Accept: No developer wording.
- [ ] **S-36 (P2)** Invoices on phone: desktop table squeezed, status off-screen
  - [ ] Add responsive cards.
  - [ ] Accept: Phone sweep shows status without horizontal scroll.
- [ ] Re-run this page: `echo "/dashboard/finance/invoices" > r.txt && AUDIT_BASE=http://localhost:3333 node scripts/visual-sweep.mjs school_admin r.txt`

## Cross-cutting findings that also show here

- [S-7](../../findings/S-7.md) (P1) ~1 375 hardcoded French UI strings bypass translation (Arabic UI stays French)
- [S-14](../../findings/done/S-14.md) (P2) Sidebar lists add-on modules the tenant has not enabled
- [S-18](../../findings/done/S-18.md) (P1) Header claims CNDP compliance on every page; the school has not filed
- [S-25](../../findings/done/S-25.md) (P2) Header shows a fake identity when the session call is slow
- [S-37](../../findings/S-37.md) (P2) Arabic: dashboard widgets stay French; brand renders "OSSchool" in RTL
- [S-41](../../findings/done/S-41.md) (P1) Auth rate limit counts every page's session check, per IP
