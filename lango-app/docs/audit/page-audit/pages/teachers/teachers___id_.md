# `/dashboard/teachers/[id]`

**Status: NEEDS FIX (P3)** · Module: `teachers` · Source: [`src/app/[locale]/(dashboard)/dashboard/teachers/[id]/page.tsx`](<../../../../../src/app/[locale]/(dashboard)/dashboard/teachers/[id]/page.tsx>)

**Progress (2026-09-23):** S-57 OPEN











Guard: `requireServerPage` · capability `teachers.read`

**Verdict:** 1 finding(s), worst P3. 2 sweep run(s): 2 clean or expected, 0 flagged. 2 screenshot(s).

## Findings on this page

| ID | Sev | Problem | Fix | Code now |
|---|---|---|---|---|
| [S-57](../../findings/S-57.md) | P3 | Raw enum values, two money formats, stale "current" year, overlapping widget | Translate enums; one MAD formatter; check active year; move the widget. | Not re-checked since the sweep. |

## Sweep results

| Pass | Role | URL tested | Result |
|---|---|---|---|
| Pass C | school_admin | `/dashboard/teachers/USR-TCH-01` | ok |
| Pass C | parent | `/dashboard/teachers/USR-TCH-01` | ok, blocked → /fr/dashboard/access-denied<br>ok, 403 /api/settings/branches (data blocked, expected) |

## Screenshots

**Pass C · detail + public pages, 2026-09-23** · school_admin · fr · `/dashboard/teachers/USR-TCH-01`

![school_admin fr](../../shots/C__school_admin-fr-teachers__USR-TCH-01.jpg)

**Pass C · parent typing staff URLs (expected: blocked)** · parent · fr · `/dashboard/teachers/USR-TCH-01`

![parent fr](../../shots/C-idor__parent-fr-teachers__USR-TCH-01.jpg)

## Plan

- [ ] **S-57 (P3)** Raw enum values, two money formats, stale "current" year, overlapping widget
  - [ ] Enum label maps.
  - [ ] Single formatter.
  - [ ] Accept: No raw enum values on these pages.
- [ ] Re-run this page: `echo "/dashboard/teachers/USR-TCH-01" > r.txt && AUDIT_BASE=http://localhost:3333 node scripts/visual-sweep.mjs school_admin r.txt`

## Cross-cutting findings that also show here

- [S-7](../../findings/S-7.md) (P1) ~1 375 hardcoded French UI strings bypass translation (Arabic UI stays French)
- [S-14](../../findings/S-14.md) (P2) Sidebar lists add-on modules the tenant has not enabled
- [S-18](../../findings/done/S-18.md) (P1) Header claims CNDP compliance on every page; the school has not filed
- [S-25](../../findings/done/S-25.md) (P2) Header shows a fake identity when the session call is slow
- [S-37](../../findings/S-37.md) (P2) Arabic: dashboard widgets stay French; brand renders "OSSchool" in RTL
- [S-41](../../findings/done/S-41.md) (P1) Auth rate limit counts every page's session check, per IP
- [S-44](../../findings/S-44.md) (P2) Staff campus switcher renders for parents, students and super admin (403 on every page)
