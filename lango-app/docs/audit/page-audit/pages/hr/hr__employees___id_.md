# `/dashboard/hr/employees/[id]`

**Status: NEEDS FIX (P3)** · Module: `hr` · Source: [`src/app/[locale]/(dashboard)/dashboard/hr/employees/[id]/page.tsx`](<../../../../../src/app/[locale]/(dashboard)/dashboard/hr/employees/[id]/page.tsx>)

**Progress (2026-09-23):** S-6 DONE · S-57 OPEN











Guard: `requireServerPage` · capability `hr.manage`

**Verdict:** 2 finding(s), worst P1. 3 sweep run(s): 2 clean or expected, 1 flagged. 3 screenshot(s).

## Findings on this page

| ID | Sev | Problem | Fix | Code now |
|---|---|---|---|---|
| [S-6](../../findings/done/S-6.md) | P1 | Translation keys used in code are missing (users see raw keys or blanks) | Add every missing key in fr, ar, en; fix formatting calls that omit their values. | LIKELY FIXED in the working tree |
| [S-57](../../findings/S-57.md) | P3 | Raw enum values, two money formats, stale "current" year, overlapping widget | Translate enums; one MAD formatter; check active year; move the widget. | Not re-checked since the sweep. |

## Sweep results

| Pass | Role | URL tested | Result |
|---|---|---|---|
| Pass C | school_admin | `/dashboard/hr/employees/f2e312d5-7ee6-4fff-8b33-d6a4b24c064d` | **S-6**: console: IntlError: MISSING_MESSAGE: Could not resolve `HR.colDate` in messages for locale `fr`. |
| Pass C | school_admin | `/dashboard/hr/employees/00000000-0000-4000-8000-000000000000` | expected: 404 /api/hr/employees/00000000-0000-4000-8000-000000000000 (expected not-found)<br>expected: 404 /api/hr/employees/00000000-0000-4000-8000-000000000000/payroll-attendance (expected not-found) |
| Pass C | parent | `/dashboard/hr/employees/f2e312d5-7ee6-4fff-8b33-d6a4b24c064d` | ok, blocked → /fr/dashboard/access-denied<br>ok, 403 /api/settings/branches (data blocked, expected) |

## Screenshots

**Pass C · detail + public pages, 2026-09-23** · school_admin · fr · `/dashboard/hr/employees/00000000-0000-4000-8000-000000000000`

![school_admin fr](../../shots/C__school_admin-fr-hr__employees__00000000-0000-4000-8000-000000000000.jpg)

**Pass C · detail + public pages, 2026-09-23** · school_admin · fr · `/dashboard/hr/employees/f2e312d5-7ee6-4fff-8b33-d6a4b24c064d`

![school_admin fr](../../shots/C__school_admin-fr-hr__employees__f2e312d5-7ee6-4fff-8b33-d6a4b24c064d.jpg)

**Pass C · parent typing staff URLs (expected: blocked)** · parent · fr · `/dashboard/hr/employees/f2e312d5-7ee6-4fff-8b33-d6a4b24c064d`

![parent fr](../../shots/C-idor__parent-fr-hr__employees__f2e312d5-7ee6-4fff-8b33-d6a4b24c064d.jpg)

## Plan

- [ ] **S-6 (P1)** Translation keys used in code are missing (users see raw keys or blanks)
  - [ ] Run the checker, add keys until it exits 0.
  - [ ] Re-run the runtime sweep on the listed pages; 0 `MISSING_MESSAGE`.
  - [ ] Add the checker to CI.
  - [ ] Accept: Checker exits 0 and the runtime sweep shows no raw keys.
- [ ] **S-57 (P3)** Raw enum values, two money formats, stale "current" year, overlapping widget
  - [ ] Enum label maps.
  - [ ] Single formatter.
  - [ ] Accept: No raw enum values on these pages.
- [ ] Re-run this page: `echo "/dashboard/hr/employees/f2e312d5-7ee6-4fff-8b33-d6a4b24c064d" > r.txt && AUDIT_BASE=http://localhost:3333 node scripts/visual-sweep.mjs school_admin r.txt`

## Cross-cutting findings that also show here

- [S-7](../../findings/S-7.md) (P1) ~1 375 hardcoded French UI strings bypass translation (Arabic UI stays French)
- [S-14](../../findings/S-14.md) (P2) Sidebar lists add-on modules the tenant has not enabled
- [S-18](../../findings/done/S-18.md) (P1) Header claims CNDP compliance on every page; the school has not filed
- [S-25](../../findings/done/S-25.md) (P2) Header shows a fake identity when the session call is slow
- [S-37](../../findings/S-37.md) (P2) Arabic: dashboard widgets stay French; brand renders "OSSchool" in RTL
- [S-41](../../findings/done/S-41.md) (P1) Auth rate limit counts every page's session check, per IP
- [S-44](../../findings/S-44.md) (P2) Staff campus switcher renders for parents, students and super admin (403 on every page)
