# `/dashboard/certificates/issued/[id]`

**Status: FIXED, pending re-sweep** · Module: `certificates` · Source: [`src/app/[locale]/(dashboard)/dashboard/certificates/issued/[id]/page.tsx`](<../../../../../src/app/[locale]/(dashboard)/dashboard/certificates/issued/[id]/page.tsx>)

**Progress (2026-09-24):** S-6 DONE · S-42 DONE
































Guard: `requireServerPage` · capability `certificates.issue`

**Verdict:** 2 finding(s), worst P1. 2 sweep run(s): 1 clean or expected, 1 flagged. 2 screenshot(s).

## Findings on this page

| ID | Sev | Problem | Fix | Code now |
|---|---|---|---|---|
| [S-6](../../findings/done/S-6.md) | P1 | Translation keys used in code are missing (users see raw keys or blanks) | Add every missing key in fr, ar, en; fix formatting calls that omit their values. | LIKELY FIXED in the working tree |
| [S-42](../../findings/done/S-42.md) | P2 | Certificates module untranslated; raw keys on screen | Add all Certificates.* keys (fr/ar/en). | LIKELY FIXED in the working tree |

## Sweep results

| Pass | Role | URL tested | Result |
|---|---|---|---|
| Pass C | school_admin | `/dashboard/certificates/issued/b9d3e06c-b0ad-48df-a3d2-9a572a7901b8` | **S-6**: console: IntlError: MISSING_MESSAGE: Could not resolve `Certificates.tableLoading` in messages for locale `fr`. |
| Pass C | parent | `/dashboard/certificates/issued/b9d3e06c-b0ad-48df-a3d2-9a572a7901b8` | ok, blocked → /fr/dashboard/access-denied<br>ok, 403 /api/settings/branches (data blocked, expected) |

## Screenshots

**Pass C · detail + public pages, 2026-09-23** · school_admin · fr · `/dashboard/certificates/issued/b9d3e06c-b0ad-48df-a3d2-9a572a7901b8`

![school_admin fr](../../shots/C__school_admin-fr-certificates__issued__b9d3e06c-b0ad-48df-a3d2-9a572a7901b8.jpg)

**Pass C · parent typing staff URLs (expected: blocked)** · parent · fr · `/dashboard/certificates/issued/b9d3e06c-b0ad-48df-a3d2-9a572a7901b8`

![parent fr](../../shots/C-idor__parent-fr-certificates__issued__b9d3e06c-b0ad-48df-a3d2-9a572a7901b8.jpg)

## Plan

- [ ] **S-6 (P1)** Translation keys used in code are missing (users see raw keys or blanks)
  - [ ] Run the checker, add keys until it exits 0.
  - [ ] Re-run the runtime sweep on the listed pages; 0 `MISSING_MESSAGE`.
  - [ ] Add the checker to CI.
  - [ ] Accept: Checker exits 0 and the runtime sweep shows no raw keys.
- [ ] **S-42 (P2)** Certificates module untranslated; raw keys on screen
  - [ ] Add keys.
  - [ ] Runtime sweep of certificates pages.
  - [ ] Accept: 0 MISSING_MESSAGE on certificates pages.
- [ ] Re-run this page: `echo "/dashboard/certificates/issued/b9d3e06c-b0ad-48df-a3d2-9a572a7901b8" > r.txt && AUDIT_BASE=http://localhost:3333 node scripts/visual-sweep.mjs school_admin r.txt`

## Cross-cutting findings that also show here

- [S-7](../../findings/S-7.md) (P1) ~1 375 hardcoded French UI strings bypass translation (Arabic UI stays French)
- [S-14](../../findings/S-14.md) (P2) Sidebar lists add-on modules the tenant has not enabled
- [S-18](../../findings/done/S-18.md) (P1) Header claims CNDP compliance on every page; the school has not filed
- [S-25](../../findings/done/S-25.md) (P2) Header shows a fake identity when the session call is slow
- [S-37](../../findings/S-37.md) (P2) Arabic: dashboard widgets stay French; brand renders "OSSchool" in RTL
- [S-41](../../findings/done/S-41.md) (P1) Auth rate limit counts every page's session check, per IP
- [S-44](../../findings/S-44.md) (P2) Staff campus switcher renders for parents, students and super admin (403 on every page)
