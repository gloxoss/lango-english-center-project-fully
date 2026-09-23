# `/dashboard/finance/invoices/[id]`

**Status: PASS** · Module: `finance` · Source: [`src/app/[locale]/(dashboard)/dashboard/finance/invoices/[id]/page.tsx`](<../../../../../src/app/[locale]/(dashboard)/dashboard/finance/invoices/[id]/page.tsx>)

Guard: `requireServerPage` · capability `finance.read`

**Verdict:** No page-specific finding. 3 sweep run(s): 3 clean or expected, 0 flagged. 3 screenshot(s).

## Findings on this page

None specific to this page.

## Sweep results

| Pass | Role | URL tested | Result |
|---|---|---|---|
| Pass C | school_admin | `/dashboard/finance/invoices/d7b64a9d-5f9c-4c59-8f92-5662b3869bcc` | ok |
| Pass C | school_admin | `/dashboard/finance/invoices/00000000-0000-4000-8000-000000000000` | expected: 404 /api/finance/invoices (expected not-found) |
| Pass C | parent | `/dashboard/finance/invoices/d7b64a9d-5f9c-4c59-8f92-5662b3869bcc` | ok, 403 /api/settings/branches (data blocked, expected)<br>ok, 403 /api/finance/invoices (data blocked, expected) |

## Screenshots

**Pass C · detail + public pages, 2026-09-23** · school_admin · fr · `/dashboard/finance/invoices/00000000-0000-4000-8000-000000000000`

![school_admin fr](../../shots/C__school_admin-fr-finance__invoices__00000000-0000-4000-8000-000000000000.jpg)

**Pass C · detail + public pages, 2026-09-23** · school_admin · fr · `/dashboard/finance/invoices/d7b64a9d-5f9c-4c59-8f92-5662b3869bcc`

![school_admin fr](../../shots/C__school_admin-fr-finance__invoices__d7b64a9d-5f9c-4c59-8f92-5662b3869bcc.jpg)

**Pass C · parent typing staff URLs (expected: blocked)** · parent · fr · `/dashboard/finance/invoices/d7b64a9d-5f9c-4c59-8f92-5662b3869bcc`

![parent fr](../../shots/C-idor__parent-fr-finance__invoices__d7b64a9d-5f9c-4c59-8f92-5662b3869bcc.jpg)

## Plan

- No action. Keep this page in the regression sweep.

## Cross-cutting findings that also show here

- [S-7](../../findings/S-7.md) (P1) ~1 375 hardcoded French UI strings bypass translation (Arabic UI stays French)
- [S-14](../../findings/S-14.md) (P2) Sidebar lists add-on modules the tenant has not enabled
- [S-18](../../findings/done/S-18.md) (P1) Header claims CNDP compliance on every page; the school has not filed
- [S-25](../../findings/done/S-25.md) (P2) Header shows a fake identity when the session call is slow
- [S-37](../../findings/S-37.md) (P2) Arabic: dashboard widgets stay French; brand renders "OSSchool" in RTL
- [S-41](../../findings/done/S-41.md) (P1) Auth rate limit counts every page's session check, per IP
- [S-44](../../findings/S-44.md) (P2) Staff campus switcher renders for parents, students and super admin (403 on every page)
